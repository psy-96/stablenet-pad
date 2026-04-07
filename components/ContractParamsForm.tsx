'use client'

import { useState, useEffect, useRef } from 'react'
import type { ContractParams, DeploymentResult } from '@/types'
import type { TemplateParam } from '@/lib/template-registry'

interface Props {
  params: TemplateParam[]
  onChange: (params: ContractParams | null, valid: boolean) => void
}

interface AddressOption {
  contractName: string
  address: string
}

export default function ContractParamsForm({ params, onChange }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  // fetchUrl별 옵션 캐시 — 동일 fetchUrl 중복 요청 방지
  const [selectOptions, setSelectOptions] = useState<Record<string, AddressOption[]>>({})
  const [selectLoading, setSelectLoading] = useState<Record<string, boolean>>({})
  const [selectError, setSelectError] = useState<Record<string, boolean>>({})
  // 이미 fetch 요청한 fetchUrl 추적
  const fetchedUrls = useRef<Set<string>>(new Set())

  // params 변경(템플릿 전환) 시 상태 초기화
  useEffect(() => {
    setValues({})
    setSelectOptions({})
    setSelectError({})
    fetchedUrls.current = new Set()
  }, [params])

  // address-select 필드 fetchUrl 로드 (중복 요청 방지)
  useEffect(() => {
    params.forEach((p) => {
      if (p.type !== 'address-select' || !p.fetchUrl) return
      const url = p.fetchUrl
      if (fetchedUrls.current.has(url)) return
      fetchedUrls.current.add(url)

      setSelectLoading((prev) => ({ ...prev, [url]: true }))
      fetch(url)
        .then((r) => r.json())
        .then((data: { deployments: DeploymentResult[] }) => {
          const options = (data.deployments ?? [])
            .filter((d) => d.proxyAddress ?? d.implementationAddress)
            .map((d) => ({
              contractName: d.contractName,
              address: (d.proxyAddress ?? d.implementationAddress)!,
            }))
          setSelectOptions((prev) => ({ ...prev, [url]: options }))
          // 해당 fetchUrl을 사용하는 필드에 기본값 설정
          const fields = params.filter((fp) => fp.type === 'address-select' && fp.fetchUrl === url)
          if (options.length >= fields.length) {
            setValues((prev) => {
              const next = { ...prev }
              fields.forEach((fp, i) => {
                if (!next[fp.key]) next[fp.key] = options[i]?.address ?? ''
              })
              return next
            })
          }
        })
        .catch(() => {
          setSelectError((prev) => ({ ...prev, [url]: true }))
        })
        .finally(() => {
          setSelectLoading((prev) => ({ ...prev, [url]: false }))
        })
    })
  }, [params])

  // 유효성 검사 + 부모에 알림
  useEffect(() => {
    let valid = true

    for (const p of params) {
      const val = values[p.key] ?? ''

      if (p.type === 'address-select') {
        const url = p.fetchUrl ?? ''
        if (selectError[url]) { valid = false; break }
        const opts = selectOptions[url] ?? []
        if (opts.length < 2) { valid = false; break }
        if (!val) { valid = false; break }
      } else if (p.type === 'uint256') {
        if (!/^\d+$/.test(val) || BigInt(val || '0') <= 0n) { valid = false; break }
      } else if (p.type === 'address') {
        if (!val.startsWith('0x') || val.length !== 42) { valid = false; break }
      } else {
        // text
        if (!val.trim()) { valid = false; break }
      }
    }

    // address-select tokenA === tokenB 방지
    const selectFields = params.filter((p) => p.type === 'address-select')
    if (selectFields.length >= 2) {
      const [a, b] = selectFields
      if (values[a.key] && values[b.key] && values[a.key] === values[b.key]) {
        valid = false
      }
    }

    onChange(valid ? { ...values } : null, valid)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, selectOptions, selectError, params])

  function setValue(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  if (params.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {params.map((p) => {
        const val = values[p.key] ?? ''

        if (p.type === 'address-select') {
          const url = p.fetchUrl ?? ''
          const loading = selectLoading[url]
          const error = selectError[url]
          const opts = selectOptions[url] ?? []

          if (loading) {
            return (
              <div key={p.key}>
                <label className="block text-xs text-gray-400 mb-1">{p.label} *</label>
                <p className="text-sm text-gray-500">토큰 목록 로딩 중...</p>
              </div>
            )
          }
          if (error) {
            return (
              <div key={p.key}>
                <label className="block text-xs text-gray-400 mb-1">{p.label} *</label>
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-400">
                  토큰 목록을 불러오지 못했습니다. 페이지를 새로고침하세요.
                </div>
              </div>
            )
          }
          if (opts.length < 2) {
            return (
              <div key={p.key}>
                <label className="block text-xs text-gray-400 mb-1">{p.label} *</label>
                <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-sm text-yellow-400">
                  ERC20 토큰이 최소 2개 이상 배포되어 있어야 합니다.
                </div>
              </div>
            )
          }

          // tokenA === tokenB 경고 (같은 fetchUrl 쓰는 두 번째 필드 대상)
          const sameUrlFields = params.filter((fp) => fp.type === 'address-select' && fp.fetchUrl === url)
          const otherField = sameUrlFields.find((fp) => fp.key !== p.key)
          const isDuplicate = otherField && values[otherField.key] === val && val !== ''

          return (
            <div key={p.key}>
              <label className="block text-xs text-gray-400 mb-1">{p.label} *</label>
              <select
                value={val}
                onChange={(e) => setValue(p.key, e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">선택</option>
                {opts.map((opt) => (
                  <option key={opt.address} value={opt.address}>
                    {opt.contractName} ({opt.address.slice(0, 8)}...)
                  </option>
                ))}
              </select>
              {isDuplicate && (
                <p className="text-red-400 text-xs mt-1">Token A와 Token B는 다른 주소여야 합니다</p>
              )}
            </div>
          )
        }

        if (p.type === 'uint256') {
          return (
            <div key={p.key}>
              <label className="block text-xs text-gray-400 mb-1">{p.label} *</label>
              <input
                type="text"
                value={val}
                onChange={(e) => setValue(p.key, e.target.value.replace(/\D/g, ''))}
                placeholder="숫자 입력"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          )
        }

        if (p.type === 'address') {
          const invalid = val !== '' && (!val.startsWith('0x') || val.length !== 42)
          return (
            <div key={p.key}>
              <label className="block text-xs text-gray-400 mb-1">{p.label} *</label>
              <input
                type="text"
                value={val}
                onChange={(e) => setValue(p.key, e.target.value)}
                placeholder="0x..."
                className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 ${invalid ? 'border-red-700' : 'border-gray-700'}`}
              />
              {invalid && (
                <p className="text-red-400 text-xs mt-1">올바른 주소 형식이 아닙니다 (0x + 40자)</p>
              )}
            </div>
          )
        }

        // text (기본)
        return (
          <div key={p.key}>
            <label className="block text-xs text-gray-400 mb-1">{p.label} *</label>
            <input
              type="text"
              value={val}
              onChange={(e) => setValue(p.key, e.target.value)}
              placeholder={p.label}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
        )
      })}
    </div>
  )
}
