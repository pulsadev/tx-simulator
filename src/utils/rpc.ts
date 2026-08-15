import type { Hex, Address } from '../types/index.js'

let rpcId = 1

export async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
  })
  const json = (await response.json()) as { result?: unknown; error?: { message: string; data?: string; code?: number } }
  if (json.error) {
    const dataStr = json.error.data ? ` data:${json.error.data}` : ''
    throw new Error(`RPC error: ${json.error.message}${dataStr}`)
  }
  return json.result
}

export async function rpcCallSafe(url: string, method: string, params: unknown[]): Promise<{ result: unknown; error: string | null }> {
  try {
    const result = await rpcCall(url, method, params)
    return { result, error: null }
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : String(e) }
  }
}

export function formatTx(tx: { from?: Address; to: Address; data?: Hex; value?: bigint; gas?: bigint; gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }): Record<string, string> {
  const formatted: Record<string, string> = { to: tx.to }
  if (tx.from) formatted['from'] = tx.from
  if (tx.data) formatted['data'] = tx.data
  if (tx.value !== undefined) formatted['value'] = '0x' + tx.value.toString(16)
  if (tx.gas) formatted['gas'] = '0x' + tx.gas.toString(16)
  if (tx.gasPrice) formatted['gasPrice'] = '0x' + tx.gasPrice.toString(16)
  if (tx.maxFeePerGas) formatted['maxFeePerGas'] = '0x' + tx.maxFeePerGas.toString(16)
  if (tx.maxPriorityFeePerGas) formatted['maxPriorityFeePerGas'] = '0x' + tx.maxPriorityFeePerGas.toString(16)
  return formatted
}

export function decodeRevertReason(data: string): string | null {
  const clean = data.startsWith('0x') ? data.slice(2) : data
  if (clean.length < 8) return null

  const selector = clean.slice(0, 8)

  // Error(string) = 0x08c379a0
  if (selector === '08c379a0' && clean.length >= 136) {
    try {
      const offset = Number(BigInt('0x' + clean.slice(8, 72)))
      const startHex = (offset + 4) * 2
      if (startHex + 64 > clean.length) return null
      const length = Number(BigInt('0x' + clean.slice(startHex, startHex + 64)))
      if (length === 0) return 'Error()'
      const dataStart = startHex + 64
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) bytes[i] = parseInt(clean.slice(dataStart + i * 2, dataStart + i * 2 + 2), 16)
      return new TextDecoder().decode(bytes)
    } catch {
      return null
    }
  }

  // Panic(uint256) = 0x4e487b71
  if (selector === '4e487b71' && clean.length >= 72) {
    const code = Number(BigInt('0x' + clean.slice(8, 72)))
    const reasons: Record<number, string> = {
      0x00: 'generic compiler panic',
      0x01: 'assert failed',
      0x11: 'arithmetic overflow/underflow',
      0x12: 'division by zero',
      0x21: 'invalid enum value',
      0x22: 'invalid storage byte array',
      0x31: 'pop on empty array',
      0x32: 'array out of bounds',
      0x41: 'out of memory',
      0x51: 'uninitialized function pointer',
    }
    return `Panic(${reasons[code] ?? `0x${code.toString(16)}`})`
  }

  return `custom error: 0x${selector}`
}
