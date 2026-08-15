# @pulsadev/tx-simulator

Transaction simulation — preview results, revert reasons, gas usage, access lists before sending. Zero dependencies, pure RPC.

Know if your transaction will succeed before you send it. Decode revert reasons. Estimate gas costs. No ethers, no viem.

## Features

- **Transaction simulation** — `eth_call` with full result parsing
- **Revert reason decoding** — Error(string), Panic(uint256), custom errors
- **Gas estimation** — gas limit + baseFee + priorityFee + total cost
- **Call tracing** — `debug_traceCall` with callTracer and logs
- **Access list creation** — `eth_createAccessList` for gas optimization
- **Batch simulation** — simulate multiple transactions sequentially
- **Will it revert?** — simple boolean check with reason
- **Zero dependencies** — ~8 KB bundled, ESM + CJS, pure TypeScript

## Install

```bash
npm install @pulsadev/tx-simulator
```

## Quick Start

### Simulate a transaction

```typescript
import { simulate } from '@pulsadev/tx-simulator'

const result = await simulate({
  from: '0xYourAddress...',
  to: '0xContractAddress...',
  data: '0xCalldata...',
  value: 0n,
}, { rpcUrl: 'https://ethereum-rpc.publicnode.com' })

console.log(result.success)      // true/false
console.log(result.returnData)   // '0x...'
console.log(result.gasUsed)      // 45000n
console.log(result.revertReason) // null or 'Insufficient balance'
```

### Will it revert?

```typescript
import { willRevert } from '@pulsadev/tx-simulator'

const { reverts, reason } = await willRevert({
  to: tokenAddress,
  data: transferCalldata,
}, { rpcUrl: '...' })

if (reverts) console.log('Will fail:', reason)
```

### Estimate gas with cost breakdown

```typescript
import { estimateGas } from '@pulsadev/tx-simulator'

const estimate = await estimateGas(tx, { rpcUrl: '...' })
console.log(`Gas limit: ${estimate.gasLimit}`)
console.log(`Base fee: ${estimate.baseFee} wei`)
console.log(`Priority fee: ${estimate.priorityFee} wei`)
console.log(`Total cost: ${estimate.totalCost} wei`)
```

### Trace a transaction

```typescript
import { simulateWithTrace } from '@pulsadev/tx-simulator'

const trace = await simulateWithTrace(tx, { rpcUrl: '...' })
console.log(trace.calls)  // internal calls tree
console.log(trace.logs)   // emitted events
```

### Batch simulate

```typescript
import { simulateBatch } from '@pulsadev/tx-simulator'

const results = await simulateBatch([tx1, tx2, tx3], { rpcUrl: '...' })
results.forEach(r => console.log(r.success, r.gasUsed))
```

### Decode revert reasons

```typescript
import { decodeRevertReason } from '@pulsadev/tx-simulator'

decodeRevertReason('0x08c379a0...')  // 'Insufficient balance'
decodeRevertReason('0x4e487b71...')  // 'Panic(arithmetic overflow/underflow)'
decodeRevertReason('0xdeadbeef...')  // 'custom error: 0xdeadbeef'
```

## API

| Function | Description |
|----------|-------------|
| `simulate(tx, options)` | Simulate via eth_call with revert decoding |
| `simulateWithTrace(tx, options)` | Simulate with debug_traceCall (callTracer) |
| `estimateGas(tx, options)` | Gas limit + fee breakdown |
| `createAccessList(tx, options)` | Generate EIP-2930 access list |
| `simulateBatch(txs, options)` | Simulate multiple txs sequentially |
| `willRevert(tx, options)` | Quick revert check |
| `decodeRevertReason(data)` | Decode Error/Panic/custom revert data |

## License

MIT © [Yuto Nakamura](https://github.com/yutonakamura-dev)
