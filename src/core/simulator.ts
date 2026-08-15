import type {
  Hex, Address, SimulationTx, SimulationResult, TraceResult, TraceCall,
  SimulationLog, AccessListItem, GasEstimate, SimulatorOptions,
} from '../types/index.js'
import { rpcCall, rpcCallSafe, formatTx, decodeRevertReason } from '../utils/rpc.js'

export async function simulate(
  tx: SimulationTx,
  options: SimulatorOptions,
): Promise<SimulationResult> {
  const formatted = formatTx(tx)
  const blockTag = options.blockTag ?? 'latest'

  const { result, error } = await rpcCallSafe(options.rpcUrl, 'eth_call', [formatted, blockTag])

  if (error) {
    const revertData = extractRevertData(error)
    const revertReason = revertData ? decodeRevertReason(revertData) : extractRevertMessage(error)

    return {
      success: false,
      returnData: '0x' as Hex,
      gasUsed: 0n,
      error,
      revertReason,
      logs: [],
    }
  }

  const gasEstimate = await estimateGas(tx, options)

  return {
    success: true,
    returnData: (result as Hex) ?? '0x',
    gasUsed: gasEstimate.gasLimit,
    error: null,
    revertReason: null,
    logs: [],
  }
}

export async function simulateWithTrace(
  tx: SimulationTx,
  options: SimulatorOptions,
): Promise<TraceResult> {
  const formatted = formatTx(tx)
  const blockTag = options.blockTag ?? 'latest'

  const { result, error } = await rpcCallSafe(
    options.rpcUrl,
    'debug_traceCall',
    [formatted, blockTag, { tracer: 'callTracer', tracerConfig: { withLog: true } }],
  )

  if (error) {
    const revertData = extractRevertData(error)
    return {
      success: false,
      returnData: '0x' as Hex,
      gasUsed: 0n,
      error,
      revertReason: revertData ? decodeRevertReason(revertData) : extractRevertMessage(error),
      calls: [],
      logs: [],
    }
  }

  const trace = result as Record<string, unknown>
  return parseCallTrace(trace)
}

export async function estimateGas(
  tx: SimulationTx,
  options: SimulatorOptions,
): Promise<GasEstimate> {
  const formatted = formatTx(tx)

  const { result: gasResult } = await rpcCallSafe(
    options.rpcUrl, 'eth_estimateGas', [formatted],
  )

  const gasLimit = gasResult ? BigInt(gasResult as string) : 0n

  let baseFee: bigint | null = null
  let priorityFee: bigint | null = null

  try {
    const block = (await rpcCall(options.rpcUrl, 'eth_getBlockByNumber', ['latest', false])) as Record<string, string>
    if (block && block['baseFeePerGas']) {
      baseFee = BigInt(block['baseFeePerGas'])
    }
  } catch { /* pre-EIP-1559 chain */ }

  try {
    const pf = (await rpcCall(options.rpcUrl, 'eth_maxPriorityFeePerGas', [])) as string
    priorityFee = BigInt(pf)
  } catch { /* not supported */ }

  const totalCost = baseFee !== null && priorityFee !== null
    ? gasLimit * (baseFee + priorityFee)
    : null

  return {
    gasLimit,
    baseFee,
    priorityFee,
    totalCost,
  }
}

export async function createAccessList(
  tx: SimulationTx,
  options: SimulatorOptions,
): Promise<{ accessList: AccessListItem[]; gasUsed: bigint }> {
  const formatted = formatTx(tx)
  const blockTag = options.blockTag ?? 'latest'

  const { result, error } = await rpcCallSafe(
    options.rpcUrl, 'eth_createAccessList', [formatted, blockTag],
  )

  if (error || !result) return { accessList: [], gasUsed: 0n }

  const data = result as Record<string, unknown>
  const accessList = ((data['accessList'] as Record<string, unknown>[]) ?? []).map(item => ({
    address: item['address'] as Address,
    storageKeys: (item['storageKeys'] as Hex[]) ?? [],
  }))
  const gasUsed = data['gasUsed'] ? BigInt(data['gasUsed'] as string) : 0n

  return { accessList, gasUsed }
}

export async function simulateBatch(
  txs: SimulationTx[],
  options: SimulatorOptions,
): Promise<SimulationResult[]> {
  const results: SimulationResult[] = []
  for (const tx of txs) {
    results.push(await simulate(tx, options))
  }
  return results
}

export async function willRevert(
  tx: SimulationTx,
  options: SimulatorOptions,
): Promise<{ reverts: boolean; reason: string | null }> {
  const result = await simulate(tx, options)
  return {
    reverts: !result.success,
    reason: result.revertReason,
  }
}

function parseCallTrace(trace: Record<string, unknown>): TraceResult {
  const error = trace['error'] as string | undefined
  const output = (trace['output'] as string) ?? '0x'
  const revertReason = error ? decodeRevertReason(output) ?? error : null

  const logs: SimulationLog[] = []
  collectLogs(trace, logs)

  return {
    success: !error,
    returnData: output as Hex,
    gasUsed: trace['gasUsed'] ? BigInt(trace['gasUsed'] as string) : 0n,
    error: error ?? null,
    revertReason,
    calls: parseSubCalls(trace),
    logs,
  }
}

function parseSubCalls(trace: Record<string, unknown>): TraceCall[] {
  const calls = trace['calls'] as Record<string, unknown>[] | undefined
  if (!calls) return []

  return calls.map(call => ({
    from: (call['from'] as Address) ?? ('0x' as Address),
    to: (call['to'] as Address) ?? ('0x' as Address),
    type: (call['type'] as string) ?? 'CALL',
    gas: call['gas'] ? BigInt(call['gas'] as string) : 0n,
    gasUsed: call['gasUsed'] ? BigInt(call['gasUsed'] as string) : 0n,
    value: call['value'] ? BigInt(call['value'] as string) : 0n,
    input: (call['input'] as Hex) ?? '0x',
    output: (call['output'] as Hex) ?? '0x',
    error: (call['error'] as string) ?? null,
    calls: parseSubCalls(call),
  }))
}

function collectLogs(trace: Record<string, unknown>, logs: SimulationLog[]): void {
  const traceLogs = trace['logs'] as Record<string, unknown>[] | undefined
  if (traceLogs) {
    for (const log of traceLogs) {
      logs.push({
        address: (log['address'] as Address) ?? ('0x' as Address),
        topics: (log['topics'] as Hex[]) ?? [],
        data: (log['data'] as Hex) ?? '0x',
      })
    }
  }
  const calls = trace['calls'] as Record<string, unknown>[] | undefined
  if (calls) {
    for (const call of calls) collectLogs(call, logs)
  }
}

function extractRevertData(error: string): string | null {
  const match = error.match(/data:(0x[0-9a-fA-F]+)/)
  if (match) return match[1]!
  const match2 = error.match(/0x(08c379a0|4e487b71)[0-9a-fA-F]+/)
  if (match2) return match2[0]!
  return null
}

function extractRevertMessage(error: string): string | null {
  const match = error.match(/execution reverted:?\s*(.+?)(?:\s*data:|$)/i)
  if (match && match[1]) return match[1].trim()
  if (error.includes('execution reverted')) return 'execution reverted'
  return null
}
