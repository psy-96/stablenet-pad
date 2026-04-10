import { describe, it, expect } from 'vitest'
import type { Abi } from 'viem'
import type { ContractParams } from '@/types'
import { buildConstructorArgs } from '@/hooks/useDeploy'

// ── 픽스처 ─────────────────────────────────────────────────────────────────

/** 단일 컨트랙트 .sol: constructor(address _feeToSetter) */
const singleContractAbi: Abi = [
  {
    type: 'constructor',
    inputs: [{ name: '_feeToSetter', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
]

/**
 * 다중 컨트랙트 .sol 시나리오 (UniswapV2Factory.sol).
 * ABI에는 Factory constructor만 포함되어 있고 Pair 등 내부 컨트랙트는 별도 artifact.
 */
const multiContractAbi: Abi = [
  // factory constructor
  {
    type: 'constructor',
    inputs: [{ name: '_feeToSetter', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  // 임의의 write 함수 (다중 컨트랙트 .sol에서 흔한 패턴)
  {
    type: 'function',
    name: 'createPair',
    inputs: [
      { name: 'tokenA', type: 'address', internalType: 'address' },
      { name: 'tokenB', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
]

/** OZ Upgradeable 패턴: constructor 비어 있음 */
const upgradeableAbi: Abi = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
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

/** constructor 항목 자체가 없는 ABI */
const noConstructorAbi: Abi = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
]

const ADDR = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

// ── 단일 컨트랙트 .sol ───────────────────────────────────────────────────────

describe('buildConstructorArgs — 단일 컨트랙트 (constructor(address))', () => {
  it('address 파라미터를 args 배열로 반환한다', () => {
    const params: ContractParams = { _feeToSetter: ADDR }
    const result = buildConstructorArgs(singleContractAbi, params)
    expect(result).toEqual([ADDR])
  })

  it('결과 배열 길이가 constructor inputs 개수와 일치한다', () => {
    const params: ContractParams = { _feeToSetter: ADDR }
    expect(buildConstructorArgs(singleContractAbi, params)).toHaveLength(1)
  })

  it('파라미터 누락 시 에러를 던진다', () => {
    expect(() => buildConstructorArgs(singleContractAbi, {})).toThrow('constructor 파라미터 누락')
  })

  it('빈 문자열 값도 누락으로 처리한다', () => {
    expect(() => buildConstructorArgs(singleContractAbi, { _feeToSetter: '' })).toThrow(
      'constructor 파라미터 누락'
    )
  })
})

// ── 다중 컨트랙트 .sol (UniswapV2Factory 시나리오) ──────────────────────────

describe('buildConstructorArgs — 다중 컨트랙트 .sol (UniswapV2Factory 시나리오)', () => {
  it('다중 함수 ABI에서도 constructor args를 정확히 인코딩한다', () => {
    const params: ContractParams = { _feeToSetter: ADDR }
    const result = buildConstructorArgs(multiContractAbi, params)
    expect(result).toEqual([ADDR])
  })

  it('encodeDeployData args가 빈 배열이 되지 않는다 (ISSUE-6 회귀 방지)', () => {
    const params: ContractParams = { _feeToSetter: ADDR }
    const result = buildConstructorArgs(multiContractAbi, params)
    expect(result.length).toBeGreaterThan(0)
  })
})

// ── OZ Upgradeable (빈 constructor) ─────────────────────────────────────────

describe('buildConstructorArgs — OZ Upgradeable (빈 constructor)', () => {
  it('빈 constructor는 [] 반환한다', () => {
    expect(buildConstructorArgs(upgradeableAbi, {})).toEqual([])
  })

  it('params가 채워져 있어도 빈 constructor면 [] 반환한다', () => {
    const params: ContractParams = { name: 'Token', symbol: 'TKN', initialSupply: '1000' }
    expect(buildConstructorArgs(upgradeableAbi, params)).toEqual([])
  })
})

// ── constructor 항목 없는 ABI ─────────────────────────────────────────────

describe('buildConstructorArgs — constructor 없는 ABI', () => {
  it('constructor 항목이 없으면 [] 반환한다', () => {
    expect(buildConstructorArgs(noConstructorAbi, {})).toEqual([])
  })

  it('빈 ABI는 [] 반환한다', () => {
    expect(buildConstructorArgs([], {})).toEqual([])
  })
})

// ── 타입 변환 ─────────────────────────────────────────────────────────────

describe('buildConstructorArgs — 타입 변환', () => {
  it('uint256 파라미터는 BigInt로 변환한다', () => {
    const uintAbi: Abi = [
      {
        type: 'constructor',
        inputs: [{ name: 'supply', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'nonpayable',
      },
    ]
    const result = buildConstructorArgs(uintAbi, { supply: '1000000' })
    expect(result).toEqual([BigInt('1000000')])
  })

  it('uint24 파라미터는 BigInt로 변환한다', () => {
    const uint24Abi: Abi = [
      {
        type: 'constructor',
        inputs: [{ name: 'fee', type: 'uint24', internalType: 'uint24' }],
        stateMutability: 'nonpayable',
      },
    ]
    const result = buildConstructorArgs(uint24Abi, { fee: '3000' })
    expect(result).toEqual([BigInt(3000)])
  })

  it('string 파라미터는 그대로 반환한다', () => {
    const strAbi: Abi = [
      {
        type: 'constructor',
        inputs: [{ name: 'name', type: 'string', internalType: 'string' }],
        stateMutability: 'nonpayable',
      },
    ]
    const result = buildConstructorArgs(strAbi, { name: 'MyToken' })
    expect(result).toEqual(['MyToken'])
  })

  it('지원하지 않는 타입(bytes32)은 에러를 던진다', () => {
    const badAbi: Abi = [
      {
        type: 'constructor',
        inputs: [{ name: 'data', type: 'bytes32', internalType: 'bytes32' }],
        stateMutability: 'nonpayable',
      },
    ]
    expect(() => buildConstructorArgs(badAbi, { data: '0xdeadbeef' })).toThrow(
      '지원하지 않는 constructor 타입'
    )
  })
})
