export type Hex = `0x${string}`
export type Address = `0x${string}`

export interface SimulationTx {
  from?: Address
  to: Address
  data?: Hex
  value?: bigint
  gas?: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

export interface SimulationResult {
  success: boolean
  returnData: Hex
  gasUsed: bigint
  error: string | null
  revertReason: string | null
  logs: SimulationLog[]
}

export interface SimulationLog {
  address: Address
  topics: Hex[]
  data: Hex
}

export interface TraceResult {
  success: boolean
  returnData: Hex
  gasUsed: bigint
  error: string | null
  revertReason: string | null
  calls: TraceCall[]
  logs: SimulationLog[]
}

export interface TraceCall {
  from: Address
  to: Address
  type: string
  gas: bigint
  gasUsed: bigint
  value: bigint
  input: Hex
  output: Hex
  error: string | null
  calls?: TraceCall[]
}

export interface AccessListItem {
  address: Address
  storageKeys: Hex[]
}

export interface GasEstimate {
  gasLimit: bigint
  baseFee: bigint | null
  priorityFee: bigint | null
  totalCost: bigint | null
}

export interface SimulatorOptions {
  rpcUrl: string
  blockTag?: string
}
