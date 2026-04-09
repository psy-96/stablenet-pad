import { describe, it, expect } from 'vitest'
import { abiWriteFunctionsToActions } from '@/lib/template-registry'

const SAMPLE_ABI = [
  { type: 'constructor', inputs: [] },
  { type: 'function', name: 'initialize', stateMutability: 'nonpayable', inputs: [{ name: 'owner_', type: 'address' }] },
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }] },
  { type: 'function', name: 'pause', stateMutability: 'nonpayable', inputs: [] },
  { type: 'function', name: 'setFlag', stateMutability: 'nonpayable', inputs: [{ name: 'flag', type: 'bool' }] },
  { type: 'function', name: 'setData', stateMutability: 'nonpayable', inputs: [{ name: 'data', type: 'bytes32' }] },
  { type: 'function', name: 'setConfig', stateMutability: 'nonpayable', inputs: [{ name: 'cfg', type: 'tuple' }] },
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [] },
  { type: 'function', name: 'upgradeTo', stateMutability: 'nonpayable', inputs: [{ name: 'impl', type: 'address' }] },
  { type: 'function', name: 'swap', stateMutability: 'nonpayable', inputs: [{ name: 'path', type: 'address[]' }, { name: 'amounts', type: 'uint256[]' }] },
  { type: 'function', name: 'setTupleArr', stateMutability: 'nonpayable', inputs: [{ name: 'cfgs', type: 'tuple[]' }] },
  { type: 'event', name: 'Transfer', inputs: [] },
]

describe('abiWriteFunctionsToActions', () => {
  it('excludes initialize()', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    expect(fns.find((f) => f.name === 'initialize')).toBeUndefined()
  })

  it('excludes view functions', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    expect(fns.find((f) => f.name === 'balanceOf')).toBeUndefined()
  })

  it('excludes constructor and events', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    for (const f of fns) {
      expect(f.name).not.toBe('constructor')
    }
    expect(fns.length).toBeGreaterThan(0)
  })

  it('includes nonpayable and payable write functions', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    expect(fns.find((f) => f.name === 'mint')).toBeDefined()
    expect(fns.find((f) => f.name === 'deposit')).toBeDefined()
    expect(fns.find((f) => f.name === 'upgradeTo')).toBeDefined()
  })

  it('includes pause() with empty params', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const pauseFn = fns.find((f) => f.name === 'pause')
    expect(pauseFn).toBeDefined()
    expect(pauseFn!.params).toHaveLength(0)
  })

  it('correctly builds signature string', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const mintFn = fns.find((f) => f.name === 'mint')
    expect(mintFn!.signature).toBe('mint(address,uint256)')
  })

  it('classifies address type correctly', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const mintFn = fns.find((f) => f.name === 'mint')!
    expect(mintFn.params[0]).toMatchObject({ key: 'to', solType: 'address', type: 'address' })
  })

  it('classifies uint256 type correctly', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const mintFn = fns.find((f) => f.name === 'mint')!
    expect(mintFn.params[1]).toMatchObject({ key: 'amount', solType: 'uint256', type: 'uint256' })
  })

  it('classifies bool type correctly', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const setFlag = fns.find((f) => f.name === 'setFlag')!
    expect(setFlag.params[0]).toMatchObject({ key: 'flag', solType: 'bool', type: 'bool' })
  })

  it('classifies bytes32 as raw-hex', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const setData = fns.find((f) => f.name === 'setData')!
    expect(setData.params[0]).toMatchObject({ key: 'data', solType: 'bytes32', type: 'raw-hex' })
  })

  it('classifies tuple as disabled', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const setConfig = fns.find((f) => f.name === 'setConfig')!
    expect(setConfig.params[0]).toMatchObject({ key: 'cfg', solType: 'tuple', type: 'disabled' })
  })

  it('sets stateMutability correctly', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const deposit = fns.find((f) => f.name === 'deposit')!
    expect(deposit.stateMutability).toBe('payable')
    const mint = fns.find((f) => f.name === 'mint')!
    expect(mint.stateMutability).toBe('nonpayable')
  })

  it('returns empty array for ABI with no write functions', () => {
    const viewOnlyAbi = [
      { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [] },
      { type: 'function', name: 'totalSupply', stateMutability: 'pure', inputs: [] },
    ]
    expect(abiWriteFunctionsToActions(viewOnlyAbi)).toHaveLength(0)
  })

  it('handles empty ABI', () => {
    expect(abiWriteFunctionsToActions([])).toHaveLength(0)
  })

  it('classifies address[] as array with arrayItemSolType=address', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const swapFn = fns.find((f) => f.name === 'swap')!
    expect(swapFn.params[0]).toMatchObject({ key: 'path', solType: 'address[]', type: 'array', arrayItemSolType: 'address' })
  })

  it('classifies uint256[] as array with arrayItemSolType=uint256', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const swapFn = fns.find((f) => f.name === 'swap')!
    expect(swapFn.params[1]).toMatchObject({ key: 'amounts', solType: 'uint256[]', type: 'array', arrayItemSolType: 'uint256' })
  })

  it('classifies tuple[] as disabled (complex array)', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    const fn = fns.find((f) => f.name === 'setTupleArr')!
    expect(fn.params[0]).toMatchObject({ solType: 'tuple[]', type: 'disabled' })
  })

  it('swap() appears in write functions list', () => {
    const fns = abiWriteFunctionsToActions(SAMPLE_ABI)
    expect(fns.find((f) => f.name === 'swap')).toBeDefined()
  })

  it('classifies uint8, uint24, int128 variants as uint256 type', () => {
    const abi = [
      { type: 'function', name: 'setFee', stateMutability: 'nonpayable', inputs: [{ name: 'fee', type: 'uint24' }] },
      { type: 'function', name: 'setDecimals', stateMutability: 'nonpayable', inputs: [{ name: 'dec', type: 'uint8' }] },
      { type: 'function', name: 'setInt', stateMutability: 'nonpayable', inputs: [{ name: 'val', type: 'int128' }] },
    ]
    const fns = abiWriteFunctionsToActions(abi)
    expect(fns.find((f) => f.name === 'setFee')!.params[0].type).toBe('uint256')
    expect(fns.find((f) => f.name === 'setDecimals')!.params[0].type).toBe('uint256')
    expect(fns.find((f) => f.name === 'setInt')!.params[0].type).toBe('uint256')
  })
})
