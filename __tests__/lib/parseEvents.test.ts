import { describe, it, expect } from 'vitest'
import { serializeEventArgs, parseReceiptEvents } from '@/lib/parse-events'
import type { Abi, Log } from 'viem'

// ── serializeEventArgs ────────────────────────────────────────────────────

describe('serializeEventArgs', () => {
  it('converts bigint values to string', () => {
    const result = serializeEventArgs({ amount: BigInt('1000000000000000000') })
    expect(result.amount).toBe('1000000000000000000')
  })

  it('keeps address values as-is', () => {
    const addr = '0xAbCdEf0123456789AbCdEf0123456789AbCdEf01'
    const result = serializeEventArgs({ to: addr })
    expect(result.to).toBe(addr)
  })

  it('handles boolean values', () => {
    const result = serializeEventArgs({ flag: true })
    expect(result.flag).toBe('true')
  })

  it('handles array-style args (positional)', () => {
    const result = serializeEventArgs(['0xABC', BigInt(42)])
    expect(result['0']).toBe('0xABC')
    expect(result['1']).toBe('42')
  })

  it('returns {} for undefined args', () => {
    const result = serializeEventArgs(undefined)
    expect(result).toEqual({})
  })

  it('handles empty object', () => {
    expect(serializeEventArgs({})).toEqual({})
  })

  it('handles multiple named fields', () => {
    const result = serializeEventArgs({
      token0: '0xAAA',
      token1: '0xBBB',
      pair: '0xCCC',
      fee: BigInt(3000),
    })
    expect(result.token0).toBe('0xAAA')
    expect(result.token1).toBe('0xBBB')
    expect(result.pair).toBe('0xCCC')
    expect(result.fee).toBe('3000')
  })
})

// ── parseReceiptEvents ────────────────────────────────────────────────────

describe('parseReceiptEvents', () => {
  const ERC20_ABI: Abi = [
    {
      type: 'event',
      name: 'Transfer',
      inputs: [
        { name: 'from', type: 'address', indexed: true },
        { name: 'to', type: 'address', indexed: true },
        { name: 'value', type: 'uint256', indexed: false },
      ],
    },
  ]

  it('returns [] for empty logs array', () => {
    expect(parseReceiptEvents([], ERC20_ABI)).toHaveLength(0)
  })

  it('filters out logs that do not match ABI (wrong topics)', () => {
    // A log with wrong/random topics — decodeEventLog will throw → filtered out
    const badLog: Log = {
      address: '0x0000000000000000000000000000000000000001',
      topics: ['0x0000000000000000000000000000000000000000000000000000000000000000'],
      data: '0x',
      blockNumber: 1n,
      transactionHash: '0x1234',
      transactionIndex: 0,
      blockHash: '0x5678',
      logIndex: 0,
      removed: false,
    }
    const result = parseReceiptEvents([badLog], ERC20_ABI)
    expect(result).toHaveLength(0)
  })

  it('filters out logs when ABI is empty', () => {
    const log: Log = {
      address: '0x0000000000000000000000000000000000000001',
      topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
      data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
      blockNumber: 1n,
      transactionHash: '0x1234',
      transactionIndex: 0,
      blockHash: '0x5678',
      logIndex: 0,
      removed: false,
    }
    // Empty ABI — no events to match against
    const result = parseReceiptEvents([log], [])
    expect(result).toHaveLength(0)
  })

  it('does not throw when a log fails to decode', () => {
    const malformedLog: Log = {
      address: '0x0000000000000000000000000000000000000001',
      // Valid Transfer topic but malformed data
      topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
      data: '0xinvalid',
      blockNumber: 1n,
      transactionHash: '0x1234',
      transactionIndex: 0,
      blockHash: '0x5678',
      logIndex: 0,
      removed: false,
    }
    expect(() => parseReceiptEvents([malformedLog], ERC20_ABI)).not.toThrow()
  })
})
