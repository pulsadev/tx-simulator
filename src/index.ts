export {
  simulate,
  simulateWithTrace,
  estimateGas,
  createAccessList,
  simulateBatch,
  willRevert,
} from './core/simulator.js'

export { decodeRevertReason } from './utils/rpc.js'

export type {
  Hex,
  Address,
  SimulationTx,
  SimulationResult,
  TraceResult,
  TraceCall,
  SimulationLog,
  AccessListItem,
  GasEstimate,
  SimulatorOptions,
} from './types/index.js'
