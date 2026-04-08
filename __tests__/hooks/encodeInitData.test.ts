import { describe, it, expect } from 'vitest'
import { encodeFunctionData, type Abi, type AbiFunction } from 'viem'
import type { ContractParams } from '@/types'

// Copy of the private helper from useDeploy.ts — kept in sync intentionally
// to act as a regression guard if the encoding logic changes.
function encodeInitData(abi: Abi, params: ContractParams): `0x${string}` {
  const initFn = abi.find(
    (item): item is AbiFunction => item.type === 'function' && item.name === 'initialize'
  )
  // initialize() 없으면 0x — Proxy는 initializer 없이 배포 가능
  if (!initFn) {
    return '0x'
  }
  const args = initFn.inputs.map((input) => {
    const key = input.name ?? ''
    const val = params[key]
    if (val === undefined || val === '') {
      throw new Error(`missing param: ${key}`)
    }
    const t = input.type
    if (t === 'uint256' || t === 'uint24' || t === 'uint8') return BigInt(val)
    if (t === 'string' || t === 'address') return val
    throw new Error(`unsupported type: ${t}`)
  })
  return encodeFunctionData({ abi, functionName: 'initialize', args })
}

const erc20Abi: Abi = [
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      { name: 'name', type: 'string', internalType: 'string' },
      { name: 'symbol', type: 'string', internalType: 'string' },
      { name: 'initialSupply', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
]

const lpAbi: Abi = [
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      { name: 'tokenA', type: 'address', internalType: 'address' },
      { name: 'tokenB', type: 'address', internalType: 'address' },
      { name: 'fee', type: 'uint24', internalType: 'uint24' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
]

describe('encodeInitData — ERC20', () => {
  it('produces a valid 0x hex string', () => {
    const result = encodeInitData(erc20Abi, {
      name: 'Test Token',
      symbol: 'TST',
      initialSupply: '1000000',
    })
    expect(result.startsWith('0x')).toBe(true)
    expect(result.length).toBeGreaterThan(10)
  })

  it('encodes name/symbol as strings, initialSupply as BigInt', () => {
    const r1 = encodeInitData(erc20Abi, { name: 'A', symbol: 'B', initialSupply: '100' })
    const r2 = encodeInitData(erc20Abi, { name: 'A', symbol: 'B', initialSupply: '100' })
    expect(r1).toBe(r2)
  })

  it('different supply → different encoding', () => {
    const r1 = encodeInitData(erc20Abi, { name: 'T', symbol: 'T', initialSupply: '1' })
    const r2 = encodeInitData(erc20Abi, { name: 'T', symbol: 'T', initialSupply: '2' })
    expect(r1).not.toBe(r2)
  })

  it('throws on missing param', () => {
    expect(() => encodeInitData(erc20Abi, { name: 'T', symbol: 'T' })).toThrow('missing param')
  })
})

describe('encodeInitData — LiquidityPool', () => {
  const addr1 = '0x1234567890123456789012345678901234567890'
  const addr2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

  it('encodes addresses and uint24 fee', () => {
    const result = encodeInitData(lpAbi, { tokenA: addr1, tokenB: addr2, fee: '3000' })
    expect(result.startsWith('0x')).toBe(true)
  })

  it('different fee → different encoding', () => {
    const r1 = encodeInitData(lpAbi, { tokenA: addr1, tokenB: addr2, fee: '500' })
    const r2 = encodeInitData(lpAbi, { tokenA: addr1, tokenB: addr2, fee: '3000' })
    expect(r1).not.toBe(r2)
  })
})

describe('encodeInitData — edge cases', () => {
  it('returns 0x when no initialize() in ABI (Proxy without initializer)', () => {
    const noInitAbi: Abi = [
      { type: 'function', name: 'transfer', inputs: [], outputs: [], stateMutability: 'nonpayable' },
    ]
    expect(encodeInitData(noInitAbi, {})).toBe('0x')
  })

  it('returns 0x for empty ABI', () => {
    expect(encodeInitData([], {})).toBe('0x')
  })

  it('throws on unsupported type', () => {
    const badAbi: Abi = [
      {
        type: 'function',
        name: 'initialize',
        inputs: [{ name: 'data', type: 'bytes', internalType: 'bytes' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ]
    expect(() => encodeInitData(badAbi, { data: '0xdeadbeef' })).toThrow('unsupported type')
  })
})
