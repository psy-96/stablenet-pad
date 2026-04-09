import { describe, it, expect } from 'vitest'
import { selectArtifactFile } from '@/lib/hardhat'

describe('selectArtifactFile', () => {
  it('prefers exact contractName match over other json files', () => {
    // UniswapV2Factory.sol 시나리오: 여러 컨트랙트 artifact가 섞여 있음
    const files = [
      'UniswapV2ERC20.dbg.json',
      'UniswapV2ERC20.json',
      'UniswapV2Factory.dbg.json',
      'UniswapV2Factory.json',
      'UniswapV2Pair.dbg.json',
      'UniswapV2Pair.json',
    ]
    expect(selectArtifactFile(files, 'UniswapV2Factory')).toBe('UniswapV2Factory.json')
  })

  it('prefers exact match even when it appears later in the list', () => {
    const files = [
      'AnotherContract.json',
      'MyToken.dbg.json',
      'MyToken.json',
    ]
    expect(selectArtifactFile(files, 'MyToken')).toBe('MyToken.json')
  })

  it('falls back to first non-dbg json when no exact match (single-contract file)', () => {
    // contractName이 내부 이름과 다른 경우 (e.g. ERC20.sol → ERC20Token.json)
    const files = ['ERC20Token.dbg.json', 'ERC20Token.json']
    expect(selectArtifactFile(files, 'ERC20')).toBe('ERC20Token.json')
  })

  it('excludes .dbg.json in fallback', () => {
    const files = ['Foo.dbg.json', 'Foo.json']
    expect(selectArtifactFile(files, 'Unknown')).toBe('Foo.json')
  })

  it('returns undefined for empty file list', () => {
    expect(selectArtifactFile([], 'MyContract')).toBeUndefined()
  })

  it('returns undefined when only dbg files exist', () => {
    expect(selectArtifactFile(['Foo.dbg.json'], 'Foo')).toBeUndefined()
  })

  it('handles exact match when alphabetically first', () => {
    const files = ['AAA.json', 'BBB.json', 'CCC.json']
    expect(selectArtifactFile(files, 'BBB')).toBe('BBB.json')
  })

  it('handles exact match when alphabetically last', () => {
    const files = ['AAA.json', 'BBB.json', 'ZZZ.json']
    expect(selectArtifactFile(files, 'ZZZ')).toBe('ZZZ.json')
  })
})
