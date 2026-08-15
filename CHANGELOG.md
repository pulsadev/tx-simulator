# Changelog

## [0.1.0] - 2026-08-15

### Added

- Transaction simulation via eth_call with result parsing
- Revert reason decoding: Error(string), Panic(uint256), custom errors
- Gas estimation with baseFee + priorityFee + total cost breakdown
- Call tracing via debug_traceCall with callTracer
- Access list creation via eth_createAccessList
- Batch simulation for multiple transactions
- Quick revert check (willRevert)
- ESM + CJS dual format with full TypeScript declarations
- 13 tests passing (unit + Ethereum mainnet integration)
- Zero runtime dependencies (~8 KB bundled)
