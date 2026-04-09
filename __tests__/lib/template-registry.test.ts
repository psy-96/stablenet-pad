import { describe, it, expect } from 'vitest'
import {
  TEMPLATE_REGISTRY,
  getTemplateById,
  abiInputsToTemplateParams,
  abiConstructorToTemplateParams,
  type TemplateDefinition,
  type TemplateParam,
} from '@/lib/template-registry'

describe('TEMPLATE_REGISTRY', () => {
  it('has at least ERC20 and LiquidityPool', () => {
    const ids = TEMPLATE_REGISTRY.map((t) => t.id)
    expect(ids).toContain('ERC20')
    expect(ids).toContain('LiquidityPool')
  })

  it('every entry has required fields', () => {
    for (const t of TEMPLATE_REGISTRY) {
      expect(typeof t.id).toBe('string')
      expect(typeof t.label).toBe('string')
      expect(typeof t.solFile).toBe('string')
      expect(t.solFile.endsWith('.sol')).toBe(true)
      expect(Array.isArray(t.params)).toBe(true)
      expect(typeof t.useProxy).toBe('boolean')
    }
  })

  it('ERC20 has name, symbol, initialSupply params', () => {
    const erc20 = TEMPLATE_REGISTRY.find((t) => t.id === 'ERC20')!
    const keys = erc20.params.map((p: TemplateParam) => p.key)
    expect(keys).toContain('name')
    expect(keys).toContain('symbol')
    expect(keys).toContain('initialSupply')
  })

  it('LiquidityPool has _tokenA, _tokenB, _fee params (ABI key names)', () => {
    const lp = TEMPLATE_REGISTRY.find((t) => t.id === 'LiquidityPool')!
    const keys = lp.params.map((p: TemplateParam) => p.key)
    expect(keys).toContain('_tokenA')
    expect(keys).toContain('_tokenB')
    expect(keys).toContain('_fee')
  })

  it('LiquidityPool address-select params have fetchUrl', () => {
    const lp = TEMPLATE_REGISTRY.find((t) => t.id === 'LiquidityPool')!
    const selectParams = lp.params.filter((p: TemplateParam) => p.type === 'address-select')
    expect(selectParams.length).toBeGreaterThanOrEqual(2)
    for (const p of selectParams) {
      expect(typeof p.fetchUrl).toBe('string')
      expect(p.fetchUrl!.length).toBeGreaterThan(0)
    }
  })

  it('all param types are valid', () => {
    const validTypes = new Set(['text', 'address', 'uint256', 'address-select'])
    for (const t of TEMPLATE_REGISTRY) {
      for (const p of t.params) {
        expect(validTypes.has(p.type), `${t.id}.${p.key} has invalid type: ${p.type}`).toBe(true)
      }
    }
  })
})

describe('abiInputsToTemplateParams', () => {
  const makeAbi = (inputs: { name: string; type: string }[]) => [
    { type: 'function', name: 'initialize', inputs },
  ]

  it('converts string/address/uint256/uint24/uint8 to correct TemplateParam types', () => {
    const abi = makeAbi([
      { name: 'tokenName', type: 'string' },
      { name: 'tokenAddr', type: 'address' },
      { name: 'supply', type: 'uint256' },
      { name: 'fee', type: 'uint24' },
      { name: 'decimals', type: 'uint8' },
    ])
    const result = abiInputsToTemplateParams(abi)
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params).toHaveLength(5)
    expect(result.params[0]).toMatchObject({ key: 'tokenName', type: 'text' })
    expect(result.params[1]).toMatchObject({ key: 'tokenAddr', type: 'address' })
    expect(result.params[2]).toMatchObject({ key: 'supply', type: 'uint256' })
    expect(result.params[3]).toMatchObject({ key: 'fee', type: 'uint256' })
    expect(result.params[4]).toMatchObject({ key: 'decimals', type: 'uint256' })
  })

  it('returns empty params when no initialize() in ABI', () => {
    const abi = [{ type: 'function', name: 'transfer', inputs: [] }]
    const result = abiInputsToTemplateParams(abi)
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params).toHaveLength(0)
  })

  it('returns empty params for empty ABI', () => {
    const result = abiInputsToTemplateParams([])
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params).toHaveLength(0)
  })

  it('returns empty params when initialize() has no inputs', () => {
    const abi = makeAbi([])
    const result = abiInputsToTemplateParams(abi)
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params).toHaveLength(0)
  })

  it('returns error for unsupported type bytes32', () => {
    const abi = makeAbi([{ name: 'data', type: 'bytes32' }])
    const result = abiInputsToTemplateParams(abi)
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toContain('bytes32')
  })

  it('returns error for unsupported type bool', () => {
    const abi = makeAbi([{ name: 'flag', type: 'bool' }])
    const result = abiInputsToTemplateParams(abi)
    expect('error' in result).toBe(true)
  })

  it('returns error for tuple type', () => {
    const abi = makeAbi([{ name: 'config', type: 'tuple' }])
    const result = abiInputsToTemplateParams(abi)
    expect('error' in result).toBe(true)
  })

  it('param key matches ABI input name', () => {
    const abi = makeAbi([{ name: '_owner', type: 'address' }])
    const result = abiInputsToTemplateParams(abi)
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params[0].key).toBe('_owner')
  })
})

describe('abiConstructorToTemplateParams', () => {
  const makeAbi = (inputs: { name: string; type: string }[]) => [
    { type: 'constructor', inputs },
  ]

  it('parses address constructor param (UniswapV2Factory scenario)', () => {
    const abi = makeAbi([{ name: '_feeToSetter', type: 'address' }])
    const result = abiConstructorToTemplateParams(abi)
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params).toHaveLength(1)
    expect(result.params[0]).toMatchObject({ key: '_feeToSetter', type: 'address' })
  })

  it('parses multiple supported constructor params', () => {
    const abi = makeAbi([
      { name: 'owner', type: 'address' },
      { name: 'supply', type: 'uint256' },
      { name: 'name', type: 'string' },
    ])
    const result = abiConstructorToTemplateParams(abi)
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params).toHaveLength(3)
    expect(result.params[0]).toMatchObject({ key: 'owner', type: 'address' })
    expect(result.params[1]).toMatchObject({ key: 'supply', type: 'uint256' })
    expect(result.params[2]).toMatchObject({ key: 'name', type: 'text' })
  })

  it('returns empty params when no constructor in ABI', () => {
    const abi = [{ type: 'function', name: 'foo', inputs: [] }]
    const result = abiConstructorToTemplateParams(abi)
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params).toHaveLength(0)
  })

  it('returns empty params when constructor has no inputs', () => {
    const result = abiConstructorToTemplateParams(makeAbi([]))
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params).toHaveLength(0)
  })

  it('returns error for unsupported type (bytes32)', () => {
    const abi = makeAbi([{ name: 'data', type: 'bytes32' }])
    const result = abiConstructorToTemplateParams(abi)
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toContain('bytes32')
  })

  it('returns error for tuple type', () => {
    const abi = makeAbi([{ name: 'cfg', type: 'tuple' }])
    const result = abiConstructorToTemplateParams(abi)
    expect('error' in result).toBe(true)
  })

  it('returns empty params for empty ABI', () => {
    const result = abiConstructorToTemplateParams([])
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params).toHaveLength(0)
  })

  it('maps uint24/uint8 to uint256 type', () => {
    const abi = makeAbi([{ name: 'fee', type: 'uint24' }])
    const result = abiConstructorToTemplateParams(abi)
    expect('params' in result).toBe(true)
    if (!('params' in result)) return
    expect(result.params[0]).toMatchObject({ key: 'fee', type: 'uint256' })
  })
})

describe('getTemplateById', () => {
  it('returns template for known id', () => {
    const t = getTemplateById('ERC20')
    expect(t).toBeDefined()
    expect((t as TemplateDefinition).id).toBe('ERC20')
  })

  it('returns undefined for unknown id', () => {
    expect(getTemplateById('NonExistent')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(getTemplateById('')).toBeUndefined()
  })
})
