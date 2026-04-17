import { describe, it, expect } from 'vitest'
import { abiWriteFunctionsToActions } from '@/lib/template-registry'
import { abiReadFunctionsToActions } from '@/lib/abi-utils'

/**
 * ISSUE-10: 같은 타입/이름 파라미터가 2개 이상일 때 독립 state 보장
 *
 * 근본 원인: key가 input.name 기반이라 빈 이름 또는 중복 이름 시 state 충돌
 * 수정: key를 index 기반(`param_${idx}`)으로, name을 별도 필드로 분리
 */

// V2 Factory getPair — 파라미터 이름 없는 케이스
const FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPair',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'address' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
]

// 이름이 같은 파라미터 2개
const DUPLICATE_NAME_ABI = [
  {
    type: 'function',
    name: 'doSomething',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
  },
]

// deadline 파라미터 — PARAM_DEFAULTS 매칭 확인용
const DEADLINE_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
]

// tuple 내부에 같은 이름 중복
const TUPLE_DUPLICATE_ABI = [
  {
    type: 'function',
    name: 'multiRoute',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
  },
]

describe('ISSUE-10: 파라미터 key 고유성', () => {
  it('빈 이름 파라미터 2개: 각각 독립 key (getPair)', () => {
    const fns = abiReadFunctionsToActions(FACTORY_ABI)
    const getPair = fns.find((f) => f.name === 'getPair')!
    expect(getPair.params).toHaveLength(2)
    expect(getPair.params[0].key).toBe('param_0')
    expect(getPair.params[1].key).toBe('param_1')
    // key가 서로 다름
    expect(getPair.params[0].key).not.toBe(getPair.params[1].key)
    // name은 둘 다 빈 문자열
    expect(getPair.params[0].name).toBe('')
    expect(getPair.params[1].name).toBe('')
  })

  it('빈 이름 파라미터의 label은 [idx] 형태', () => {
    const fns = abiReadFunctionsToActions(FACTORY_ABI)
    const getPair = fns.find((f) => f.name === 'getPair')!
    expect(getPair.params[0].label).toBe('[0]')
    expect(getPair.params[1].label).toBe('[1]')
  })

  it('같은 name "amount" 파라미터 2개: 각각 독립 key', () => {
    const fns = abiWriteFunctionsToActions(DUPLICATE_NAME_ABI)
    const fn = fns.find((f) => f.name === 'doSomething')!
    expect(fn.params).toHaveLength(2)
    expect(fn.params[0].key).toBe('param_0')
    expect(fn.params[1].key).toBe('param_1')
    expect(fn.params[0].key).not.toBe(fn.params[1].key)
    // name은 둘 다 'amount'
    expect(fn.params[0].name).toBe('amount')
    expect(fn.params[1].name).toBe('amount')
  })

  it('PARAM_DEFAULTS가 name 기반으로 매칭 (deadline)', () => {
    const fns = abiWriteFunctionsToActions(DEADLINE_ABI)
    const fn = fns.find((f) => f.name === 'execute')!
    // deadline 파라미터의 name이 'deadline'
    expect(fn.params[1].name).toBe('deadline')
    expect(fn.params[1].key).toBe('param_1')
    // key는 index 기반이지만 name으로 PARAM_DEFAULTS 매칭 가능
    expect(fn.params[1].name).toBe('deadline')
  })

  it('이름이 있는 파라미터의 label은 원본 이름', () => {
    const fns = abiWriteFunctionsToActions(DEADLINE_ABI)
    const fn = fns.find((f) => f.name === 'execute')!
    expect(fn.params[0].label).toBe('recipient')
    expect(fn.params[1].label).toBe('deadline')
  })

  it('tuple 내부 같은 이름 중복: 각각 독립 key', () => {
    const fns = abiWriteFunctionsToActions(TUPLE_DUPLICATE_ABI)
    const fn = fns.find((f) => f.name === 'multiRoute')!
    const comps = fn.params[0].components!
    expect(comps).toHaveLength(3)
    expect(comps[0].key).toBe('param_0')
    expect(comps[1].key).toBe('param_1')
    expect(comps[2].key).toBe('param_2')
    expect(comps[0].key).not.toBe(comps[1].key)
    // name은 중복
    expect(comps[0].name).toBe('token')
    expect(comps[1].name).toBe('token')
  })

  it('tuple 부모 key도 index 기반이므로 subKey가 고유', () => {
    const fns = abiWriteFunctionsToActions(TUPLE_DUPLICATE_ABI)
    const fn = fns.find((f) => f.name === 'multiRoute')!
    const parentKey = fn.params[0].key // 'param_0'
    const comps = fn.params[0].components!
    const subKey0 = `${parentKey}.${comps[0].key}` // 'param_0.param_0'
    const subKey1 = `${parentKey}.${comps[1].key}` // 'param_0.param_1'
    expect(subKey0).not.toBe(subKey1)
  })
})
