'use client'

import { useState, useEffect } from 'react'
import type { ContractType, ContractParams, ERC20Params, LiquidityPoolParams, DeploymentResult } from '@/types'

interface Props {
  contractType: ContractType
  onChange: (params: ContractParams, valid: boolean) => void
}

interface ERC20Option {
  contractName: string
  address: string // proxy_address 우선, fallback implementation_address
}

export default function ContractParamsForm({ contractType, onChange }: Props) {
  // ERC20 폼 상태
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [initialSupply, setInitialSupply] = useState('')

  // LiquidityPool 폼 상태
  const [tokenA, setTokenA] = useState('')
  const [tokenB, setTokenB] = useState('')
  const [fee, setFee] = useState('3000')
  const [erc20Options, setErc20Options] = useState<ERC20Option[]>([])
  const [loadingTokens, setLoadingTokens] = useState(false)

  // LiquidityPool: Supabase에서 배포된 ERC20 목록 로드
  useEffect(() => {
    if (contractType !== 'LiquidityPool') return
    setLoadingTokens(true)
    fetch('/api/deployments?type=ERC20')
      .then((r) => r.json())
      .then((data: { deployments: DeploymentResult[] }) => {
        const options = (data.deployments ?? [])
          .filter((d) => d.proxyAddress ?? d.implementationAddress)
          .map((d) => ({
            contractName: d.contractName,
            address: (d.proxyAddress ?? d.implementationAddress)!,
          }))
        setErc20Options(options)
        // 기본값 설정
        if (options.length >= 2) {
          setTokenA(options[0].address)
          setTokenB(options[1].address)
        }
      })
      .catch(() => setErc20Options([]))
      .finally(() => setLoadingTokens(false))
  }, [contractType])

  // 유효성 검사 + 부모에 알림
  useEffect(() => {
    if (contractType === 'ERC20') {
      const params: ERC20Params = { name, symbol, initialSupply }
      const isSupplyValid = /^\d+$/.test(initialSupply) && BigInt(initialSupply || '0') > 0n
      const valid = name.trim() !== '' && symbol.trim() !== '' && isSupplyValid
      onChange(params, valid)
    } else {
      const params: LiquidityPoolParams = { tokenA, tokenB, fee }
      const valid =
        tokenA !== '' &&
        tokenB !== '' &&
        tokenA !== tokenB &&
        /^\d+$/.test(fee) &&
        Number(fee) > 0
      onChange(params, valid)
    }
  // onChange는 deps에서 제외 — 부모 렌더링마다 새 함수 레퍼런스가 생겨 무한 루프 유발
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractType, name, symbol, initialSupply, tokenA, tokenB, fee])

  if (contractType === 'ERC20') {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">토큰 이름 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: KRW Token"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">심볼 *</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="예: KRW"
            maxLength={10}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">초기 발행량 * (최소 단위)</label>
          <input
            type="text"
            value={initialSupply}
            onChange={(e) => setInitialSupply(e.target.value.replace(/\D/g, ''))}
            placeholder="예: 1000000000000000000000000"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-600 mt-1">BigInt로 변환됩니다 (18 decimals = ×10^18)</p>
        </div>
      </div>
    )
  }

  // LiquidityPool
  if (loadingTokens) {
    return <p className="text-sm text-gray-500">ERC20 목록 로딩 중...</p>
  }

  if (erc20Options.length < 2) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-sm text-yellow-400">
        LiquidityPool을 배포하려면 ERC20 토큰이 최소 2개 이상 배포되어 있어야 합니다.
      </div>
    )
  }

  const tokenAEqualsTokenB = tokenA === tokenB && tokenA !== ''

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Token A *</label>
        <select
          value={tokenA}
          onChange={(e) => setTokenA(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">선택</option>
          {erc20Options.map((opt) => (
            <option key={opt.address} value={opt.address}>
              {opt.contractName} ({opt.address.slice(0, 8)}...)
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Token B *</label>
        <select
          value={tokenB}
          onChange={(e) => setTokenB(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">선택</option>
          {erc20Options.map((opt) => (
            <option key={opt.address} value={opt.address}>
              {opt.contractName} ({opt.address.slice(0, 8)}...)
            </option>
          ))}
        </select>
      </div>
      {tokenAEqualsTokenB && (
        <p className="text-red-400 text-xs">Token A와 Token B는 다른 주소여야 합니다</p>
      )}
      <div>
        <label className="block text-xs text-gray-400 mb-1">수수료 (uint24) *</label>
        <input
          type="text"
          value={fee}
          onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))}
          placeholder="예: 3000 (0.3%)"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <p className="text-xs text-gray-600 mt-1">500 = 0.05% / 3000 = 0.3% / 10000 = 1%</p>
      </div>
    </div>
  )
}
