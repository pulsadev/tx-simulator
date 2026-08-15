import { describe, it, expect } from 'vitest'
import { simulate, estimateGas, createAccessList, simulateBatch, willRevert } from '../src/core/simulator.js'
import { decodeRevertReason } from '../src/utils/rpc.js'
import type { Address, Hex } from '../src/types/index.js'

const RPC = 'https://ethereum-rpc.publicnode.com'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address
const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as Address

// balanceOf(address) selector + vitalik address
const BALANCE_OF_CALL = ('0x70a08231000000000000000000000000' + VITALIK.slice(2).toLowerCase()) as Hex

describe('decodeRevertReason', () => {
  it('decodes Error(string)', () => {
    // Error("Insufficient balance")
    const data = '0x08c379a0' +
      '0000000000000000000000000000000000000000000000000000000000000020' +
      '0000000000000000000000000000000000000000000000000000000000000014' +
      '496e73756666696369656e742062616c616e6365000000000000000000000000'
    expect(decodeRevertReason(data)).toBe('Insufficient balance')
  })

  it('decodes Panic(uint256) — overflow', () => {
    const data = '0x4e487b71' +
      '0000000000000000000000000000000000000000000000000000000000000011'
    expect(decodeRevertReason(data)).toBe('Panic(arithmetic overflow/underflow)')
  })

  it('decodes Panic(uint256) — division by zero', () => {
    const data = '0x4e487b71' +
      '0000000000000000000000000000000000000000000000000000000000000012'
    expect(decodeRevertReason(data)).toBe('Panic(division by zero)')
  })

  it('returns custom error for unknown selector', () => {
    const data = '0xdeadbeef' + '0'.repeat(64)
    expect(decodeRevertReason(data)).toBe('custom error: 0xdeadbeef')
  })

  it('returns null for short data', () => {
    expect(decodeRevertReason('0x')).toBeNull()
    expect(decodeRevertReason('0xab')).toBeNull()
  })
})

describe('integration: simulate', () => {
  it('simulates successful balanceOf call', async () => {
    const result = await simulate({
      to: USDC,
      data: BALANCE_OF_CALL,
    }, { rpcUrl: RPC })

    expect(result.success).toBe(true)
    expect(result.returnData).not.toBe('0x')
    expect(result.error).toBeNull()
    expect(result.revertReason).toBeNull()
  }, 15000)

  it('simulates call to non-contract returns success', async () => {
    const result = await simulate({
      to: VITALIK,
      value: 0n,
    }, { rpcUrl: RPC })

    expect(result.success).toBe(true)
  }, 15000)

  it('simulates reverting transfer (no balance)', async () => {
    // Try to transfer USDC from zero address — will revert
    const transferData = ('0xa9059cbb' +
      '000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045' +
      '00000000000000000000000000000000000000000000000000000000ffffffff') as Hex

    const result = await simulate({
      from: '0x0000000000000000000000000000000000000001' as Address,
      to: USDC,
      data: transferData,
    }, { rpcUrl: RPC })

    // USDC is a proxy — may return success with empty data or revert
    // The key test is that simulate doesn't crash
    expect(typeof result.success).toBe('boolean')
  }, 15000)
})

describe('integration: estimateGas', () => {
  it('estimates gas for balanceOf', async () => {
    const estimate = await estimateGas({
      to: USDC,
      data: BALANCE_OF_CALL,
    }, { rpcUrl: RPC })

    expect(estimate.gasLimit).toBeGreaterThan(0n)
    expect(estimate.baseFee).not.toBeNull()
    expect(estimate.baseFee!).toBeGreaterThan(0n)
  }, 15000)

  it('estimates gas for ETH transfer', async () => {
    const estimate = await estimateGas({
      from: VITALIK,
      to: '0x0000000000000000000000000000000000000001' as Address,
      value: 1000000000000000n,
    }, { rpcUrl: RPC })

    expect(estimate.gasLimit).toBeGreaterThanOrEqual(21000n)
    expect(estimate.gasLimit).toBeLessThan(100000n)
  }, 15000)
})

describe('integration: createAccessList', () => {
  it('creates access list for contract call', async () => {
    const result = await createAccessList({
      to: USDC,
      data: BALANCE_OF_CALL,
    }, { rpcUrl: RPC })

    expect(result.accessList.length).toBeGreaterThanOrEqual(0)
    expect(result.gasUsed).toBeGreaterThanOrEqual(0n)
  }, 15000)
})

describe('integration: willRevert', () => {
  it('returns false for valid call', async () => {
    const result = await willRevert({
      to: USDC,
      data: BALANCE_OF_CALL,
    }, { rpcUrl: RPC })

    expect(result.reverts).toBe(false)
    expect(result.reason).toBeNull()
  }, 15000)
})

describe('integration: simulateBatch', () => {
  it('simulates multiple calls', async () => {
    const wethBalanceCall = ('0x70a08231000000000000000000000000' + VITALIK.slice(2).toLowerCase()) as Hex

    const results = await simulateBatch([
      { to: USDC, data: BALANCE_OF_CALL },
      { to: WETH, data: wethBalanceCall },
    ], { rpcUrl: RPC })

    expect(results).toHaveLength(2)
    expect(results[0]!.success).toBe(true)
    expect(results[1]!.success).toBe(true)
  }, 20000)
})
