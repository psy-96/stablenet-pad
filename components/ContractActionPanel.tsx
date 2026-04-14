'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import type { DeploymentResult, ActionFunctionDef, ReadFunctionDef, ActionHistoryItem, ActionHistoryResponse } from '@/types'
import { abiWriteFunctionsToActions } from '@/lib/template-registry'
import { abiReadFunctionsToActions } from '@/lib/abi-utils'
import { useContractAction } from '@/hooks/useContractAction'
import type { ParsedEvent } from '@/types'
import { explorerAddressUrl, explorerTxUrl } from '@/lib/stablenet'

type Tab = 'write' | 'read' | 'history'

/** 파라미터 이름 기반 기본값 */
const PARAM_DEFAULTS: Record<string, string> = {
  deadline: '99999999999999',
  amountMin: '0',
  amount0Min: '0',
  amount1Min: '0',
  amountOutMinimum: '0',
  sqrtPriceLimitX96: '0',
}

const PARAM_PLACEHOLDERS: Record<string, string> = {
  deadline: '기본: 99999999999999',
  amountMin: '기본: 0 (슬리피지 미제한)',
  amount0Min: '기본: 0 (슬리피지 미제한)',
  amount1Min: '기본: 0 (슬리피지 미제한)',
  amountOutMinimum: '기본: 0',
  sqrtPriceLimitX96: '기본: 0 (제한 없음)',
}

interface Props {
  deployment: DeploymentResult
  onClose: () => void
  onActionSuccess?: (fnName: string, events: ParsedEvent[] | null) => void
}

export default function ContractActionPanel({ deployment, onClose, onActionSuccess }: Props) {
  const [tab, setTab] = useState<Tab>('write')

  // Write tab state
  const [selectedFn, setSelectedFn] = useState<ActionFunctionDef | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  // Read tab state
  const [selectedReadFn, setSelectedReadFn] = useState<ReadFunctionDef | null>(null)
  const [readFormValues, setReadFormValues] = useState<Record<string, string>>({})
  const [readResult, setReadResult] = useState<string | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)

  // History tab state
  const [historyItems, setHistoryItems] = useState<ActionHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { actionLogs, isExecuting, lastEvents, executeAction, clearActionLogs } = useContractAction()

  const contractAddress = deployment.proxyAddress ?? deployment.implementationAddress

  const writeFunctions = useMemo(() => {
    if (!deployment.abi) return []
    return abiWriteFunctionsToActions(deployment.abi as Parameters<typeof abiWriteFunctionsToActions>[0])
  }, [deployment.abi])

  const readFunctions = useMemo(() => {
    if (!deployment.abi) return []
    return abiReadFunctionsToActions(deployment.abi as Parameters<typeof abiReadFunctionsToActions>[0])
  }, [deployment.abi])

  function selectFn(fn: ActionFunctionDef) {
    setSelectedFn(fn)
    const initial: Record<string, string> = {}
    for (const p of fn.params) {
      if (p.type === 'tuple' && p.components) {
        for (const c of p.components) {
          if (c.key in PARAM_DEFAULTS) {
            initial[`${p.key}.${c.key}`] = PARAM_DEFAULTS[c.key]
          }
        }
      } else if (p.key in PARAM_DEFAULTS) {
        initial[p.key] = PARAM_DEFAULTS[p.key]
      }
    }
    setFormValues(initial)
    clearActionLogs()
  }

  function selectReadFn(fn: ReadFunctionDef) {
    setSelectedReadFn(fn)
    setReadFormValues({})
    setReadResult(null)
    setReadError(null)
  }

  const fetchHistory = useCallback(async () => {
    if (!contractAddress) return
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/actions?contract_address=${contractAddress}`)
      const data = (await res.json()) as ActionHistoryResponse
      setHistoryItems(data.actions ?? [])
    } catch {
      // 무시 — 이력 조회 실패는 UX에 치명적이지 않음
    } finally {
      setHistoryLoading(false)
    }
  }, [contractAddress])

  useEffect(() => {
    if (tab === 'history') {
      void fetchHistory()
    }
  }, [tab, fetchHistory])

  function setValue(key: string, val: string) {
    setFormValues((prev) => ({ ...prev, [key]: val }))
  }

  function canExecute(): boolean {
    if (!selectedFn || isExecuting) return false
    for (const p of selectedFn.params) {
      if (p.type === 'disabled') return false
      const val = formValues[p.key] ?? ''
      if (p.type === 'bool') continue
      if (p.type === 'array') {
        try {
          const items = JSON.parse(val || '[]') as unknown[]
          if (!Array.isArray(items)) return false
        } catch { return false }
        continue
      }
      if (p.type === 'tuple') {
        if (!p.components || p.components.length === 0) return false
        for (const c of p.components) {
          if (c.type === 'disabled') return false
          if (c.type === 'bool') continue
          const sv = formValues[`${p.key}.${c.key}`] ?? ''
          const effective = sv.trim() || (PARAM_DEFAULTS[c.key] ?? '')
          if (!effective) return false
          if (c.type === 'address' && (effective.length !== 42 || !effective.startsWith('0x'))) return false
        }
        continue
      }
      const effective = val.trim() || (PARAM_DEFAULTS[p.key] ?? '')
      if (!effective) return false
      if (p.type === 'address' && (val.length !== 42 || !val.startsWith('0x'))) return false
      if (p.type === 'uint256') {
        const isSigned = /^int\d*$/.test(p.solType)
        if (isSigned ? !/^-?\d+$/.test(val) : !/^\d+$/.test(val)) return false
      }
    }
    return true
  }

  async function handleExecute() {
    if (!selectedFn || !contractAddress) return
    // 빈 칸이고 기본값이 있으면 기본값으로 채움
    const effectiveValues = { ...formValues }
    for (const p of selectedFn.params) {
      if (p.type === 'tuple' && p.components) {
        for (const c of p.components) {
          const key = `${p.key}.${c.key}`
          if (!effectiveValues[key]?.trim() && c.key in PARAM_DEFAULTS) {
            effectiveValues[key] = PARAM_DEFAULTS[c.key]
          }
        }
      } else if (!effectiveValues[p.key]?.trim() && p.key in PARAM_DEFAULTS) {
        effectiveValues[p.key] = PARAM_DEFAULTS[p.key]
      }
    }
    const result = await executeAction({
      deploymentRowId: deployment.id,
      proxyAddress: contractAddress,
      abi: deployment.abi!,
      fn: selectedFn,
      formValues: effectiveValues,
    })
    if (result.success) {
      onActionSuccess?.(selectedFn.name, result.events)
    }
  }

  async function handleRead() {
    if (!selectedReadFn || !contractAddress) return
    setIsReading(true)
    setReadResult(null)
    setReadError(null)
    try {
      const args = selectedReadFn.params.map((p) => readFormValues[p.key] ?? '')
      const res = await fetch('/api/contracts/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: contractAddress,
          abi: deployment.abi,
          functionName: selectedReadFn.name,
          args,
        }),
      })
      const data = (await res.json()) as { result?: string; error?: string }
      if (!res.ok || data.error) {
        setReadError(data.error ?? '읽기 실패')
      } else {
        setReadResult(data.result ?? '')
      }
    } catch (err) {
      setReadError(err instanceof Error ? err.message : '읽기 실패')
    } finally {
      setIsReading(false)
    }
  }

  function canRead(): boolean {
    if (!selectedReadFn || isReading) return false
    for (const p of selectedReadFn.params) {
      if (p.type === 'disabled') return false
      const val = readFormValues[p.key] ?? ''
      if (p.type === 'bool') continue
      if (!val.trim()) return false
      if (p.type === 'address' && (val.length !== 42 || !val.startsWith('0x'))) return false
      if (p.type === 'uint256' && !/^\d+$/.test(val)) return false
    }
    return true
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-300">{deployment.contractName}</h2>
          <p className="text-xs text-gray-600 font-mono mt-0.5">
            {contractAddress?.slice(0, 10)}...
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          닫기
        </button>
      </div>

      {/* Write / Read / 이력 탭 */}
      <div className="flex gap-1 border-b border-gray-800 pb-0">
        <button
          onClick={() => setTab('write')}
          className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
            tab === 'write'
              ? 'bg-gray-800 text-orange-400 border border-b-gray-800 border-gray-700'
              : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          Write
        </button>
        <button
          onClick={() => setTab('read')}
          className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
            tab === 'read'
              ? 'bg-gray-800 text-green-400 border border-b-gray-800 border-gray-700'
              : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          Read
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
            tab === 'history'
              ? 'bg-gray-800 text-blue-400 border border-b-gray-800 border-gray-700'
              : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          이력
        </button>
      </div>

      {/* ── Read 탭 ─────────────────────────────────────────────── */}
      {tab === 'read' && (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          {readFunctions.length === 0 && (
            <p className="text-gray-600 text-xs text-center py-4">
              ABI에 read 함수가 없습니다
            </p>
          )}

          {readFunctions.length > 0 && (
            <>
              <div>
                <p className="text-xs text-gray-500 mb-2">함수 선택</p>
                <div className="flex flex-col gap-1">
                  {readFunctions.map((fn) => (
                    <button
                      key={fn.signature}
                      onClick={() => selectReadFn(fn)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                        selectedReadFn?.signature === fn.signature
                          ? 'bg-green-900/30 border border-green-700 text-green-300'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-transparent'
                      }`}
                    >
                      {fn.signature}
                    </button>
                  ))}
                </div>
              </div>

              {selectedReadFn && (
                <div className="flex flex-col gap-3 border-t border-gray-800 pt-3">
                  {selectedReadFn.params.length > 0 && (
                    <>
                      <p className="text-xs text-gray-500">파라미터</p>
                      {selectedReadFn.params.map((p) => {
                        const val = readFormValues[p.key] ?? ''
                        if (p.type === 'bool') {
                          const checked = readFormValues[p.key] === 'true'
                          return (
                            <div key={p.key} className="flex items-center gap-3">
                              <label className="text-xs text-gray-400">{p.label}</label>
                              <button
                                type="button"
                                onClick={() =>
                                  setReadFormValues((prev) => ({ ...prev, [p.key]: checked ? 'false' : 'true' }))
                                }
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  checked ? 'bg-green-600' : 'bg-gray-700'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                    checked ? 'translate-x-4' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                          )
                        }
                        const invalid =
                          p.type === 'address' && val !== '' && (!val.startsWith('0x') || val.length !== 42)
                        return (
                          <div key={p.key}>
                            <label className="block text-xs text-gray-400 mb-1">
                              {p.label} <span className="text-gray-600">({p.solType})</span>
                            </label>
                            <input
                              type="text"
                              value={val}
                              onChange={(e) =>
                                setReadFormValues((prev) => ({ ...prev, [p.key]: e.target.value }))
                              }
                              placeholder={p.type === 'address' ? '0x...' : '값 입력'}
                              className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500 font-mono ${
                                invalid ? 'border-red-700' : 'border-gray-700'
                              }`}
                            />
                          </div>
                        )
                      })}
                    </>
                  )}

                  <button
                    onClick={() => void handleRead()}
                    disabled={!canRead()}
                    className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-green-800 hover:bg-green-700 text-white"
                  >
                    {isReading ? '조회 중...' : `조회: ${selectedReadFn.name}()`}
                  </button>

                  {readError && (
                    <p className="text-xs text-red-400 font-mono break-all">{readError}</p>
                  )}

                  {readResult !== null && !readError && (
                    <div className="bg-gray-800 rounded-lg px-3 py-2 border border-green-900">
                      <p className="text-xs text-gray-500 mb-1">결과</p>
                      <p className="text-sm text-green-300 font-mono break-all">{readResult}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 이력 탭 ─────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">최근 액션 이력</p>
            <button
              onClick={() => void fetchHistory()}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              새로고침
            </button>
          </div>

          {historyLoading && (
            <p className="text-gray-600 text-xs text-center py-4">로딩 중...</p>
          )}

          {!historyLoading && historyItems.length === 0 && (
            <p className="text-gray-600 text-xs text-center py-4">이력이 없습니다</p>
          )}

          {!historyLoading && historyItems.map((item) => (
            <div key={item.id} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              {/* Summary row */}
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="w-full text-left px-3 py-2 hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs shrink-0 ${item.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {item.status === 'success' ? '✓' : '✗'}
                    </span>
                    <span className="text-xs font-mono text-gray-300 truncate">{item.functionName}()</span>
                  </div>
                  <span className="text-xs text-gray-600 shrink-0">
                    {new Date(item.createdAt).toLocaleString('ko-KR', {
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                {item.txHash && (
                  <a
                    href={explorerTxUrl(item.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-gray-600 hover:text-blue-400 font-mono mt-0.5 block truncate transition-colors"
                  >
                    {item.txHash}
                  </a>
                )}
              </button>

              {/* Expanded detail */}
              {expandedId === item.id && (
                <div className="border-t border-gray-700 px-3 py-2 flex flex-col gap-2">
                  {/* Params */}
                  {item.params && Object.keys(item.params).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">파라미터</p>
                      <div className="flex flex-col gap-0.5">
                        {Object.entries(item.params).map(([k, v]) => (
                          <div key={k} className="flex gap-2 text-xs font-mono">
                            <span className="text-gray-500 shrink-0">{k}:</span>
                            <span className="text-gray-300 break-all">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Events */}
                  {item.events && item.events.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">이벤트</p>
                      <div className="flex flex-col gap-1.5">
                        {item.events.map((evt, i) => (
                          <div key={i} className="bg-gray-900 rounded px-2 py-1.5">
                            <p className="text-xs text-blue-400 font-mono mb-0.5">{evt.name}</p>
                            {Object.entries(evt.args).map(([k, v]) => {
                              const isAddress = /^0x[0-9a-fA-F]{40}$/.test(v)
                              return (
                                <div key={k} className="flex gap-2 text-xs font-mono">
                                  <span className="text-gray-500 shrink-0">{k}:</span>
                                  {isAddress ? (
                                    <a
                                      href={explorerAddressUrl(v)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 truncate transition-colors"
                                    >
                                      {v}
                                    </a>
                                  ) : (
                                    <span className="text-gray-300 break-all">{v}</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Write 탭 ────────────────────────────────────────────── */}
      {tab === 'write' && writeFunctions.length === 0 && (
        <p className="text-gray-600 text-xs text-center py-4">
          ABI에 실행 가능한 write 함수가 없습니다
        </p>
      )}

      {tab === 'write' && writeFunctions.length > 0 && (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          {/* Function List */}
          <div>
            <p className="text-xs text-gray-500 mb-2">함수 선택</p>
            <div className="flex flex-col gap-1">
              {writeFunctions.map((fn) => (
                <button
                  key={fn.signature}
                  onClick={() => selectFn(fn)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                    selectedFn?.signature === fn.signature
                      ? 'bg-blue-900/40 border border-blue-700 text-blue-300'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-transparent'
                  }`}
                >
                  <span className="text-gray-500 mr-1">
                    {fn.stateMutability === 'payable' ? '💰 ' : ''}
                  </span>
                  {fn.signature}
                </button>
              ))}
            </div>
          </div>

          {/* Param Form */}
          {selectedFn && (
            <div className="flex flex-col gap-3 border-t border-gray-800 pt-3">
              <p className="text-xs text-gray-500">파라미터</p>

              {selectedFn.params.length === 0 && (
                <p className="text-xs text-gray-600">파라미터 없음</p>
              )}

              {selectedFn.params.map((p) => {
                const val = formValues[p.key] ?? ''

                if (p.type === 'array') {
                  let items: string[] = []
                  try { items = JSON.parse(formValues[p.key] || '[]') as string[] } catch { items = [] }
                  const itemPlaceholder = p.arrayItemSolType === 'address' ? '0x...' : '값 입력'
                  const isAddressItem = p.arrayItemSolType === 'address'
                  const setItems = (next: string[]) => setValue(p.key, JSON.stringify(next))
                  return (
                    <div key={p.key}>
                      <label className="block text-xs text-gray-400 mb-1">
                        {p.label} <span className="text-gray-600">({p.solType})</span>
                      </label>
                      <div className="flex flex-col gap-1">
                        {items.map((item, idx) => {
                          const invalid = isAddressItem && item !== '' && (!item.startsWith('0x') || item.length !== 42)
                          return (
                            <div key={idx} className="flex gap-1 items-center">
                              <input
                                type="text"
                                value={item}
                                onChange={(e) => {
                                  const next = [...items]
                                  next[idx] = e.target.value
                                  setItems(next)
                                }}
                                placeholder={itemPlaceholder}
                                className={`flex-1 bg-gray-800 border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono ${invalid ? 'border-red-700' : 'border-gray-700'}`}
                              />
                              <button
                                type="button"
                                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                className="text-gray-600 hover:text-red-400 text-xs px-1.5 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => setItems([...items, ''])}
                          className="text-xs text-blue-500 hover:text-blue-400 text-left transition-colors"
                        >
                          + 항목 추가
                        </button>
                      </div>
                    </div>
                  )
                }

                if (p.type === 'disabled') {
                  return (
                    <div key={p.key}>
                      <label className="block text-xs text-gray-500 mb-1">{p.label}</label>
                      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-600">
                        {p.solType} — 복합 타입은 직접 실행할 수 없습니다
                      </div>
                    </div>
                  )
                }

                if (p.type === 'tuple') {
                  const comps = p.components ?? []
                  if (comps.length === 0) {
                    return (
                      <div key={p.key}>
                        <label className="block text-xs text-gray-500 mb-1">{p.label}</label>
                        <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-600">
                          {p.solType} — ABI에 components 정보 없음
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={p.key}>
                      <label className="block text-xs text-gray-400 mb-1">
                        {p.label} <span className="text-gray-600">({p.solType})</span>
                      </label>
                      <div className="ml-3 pl-3 border-l border-gray-700 flex flex-col gap-2">
                        {comps.map((c) => {
                          const subKey = `${p.key}.${c.key}`
                          const sv = formValues[subKey] ?? ''
                          if (c.type === 'bool') {
                            const checked = sv === 'true'
                            return (
                              <div key={subKey} className="flex items-center gap-3">
                                <label className="text-xs text-gray-400">{c.label}</label>
                                <button type="button" onClick={() => setValue(subKey, checked ? 'false' : 'true')}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-700'}`}>
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
                                </button>
                              </div>
                            )
                          }
                          if (c.type === 'address') {
                            const invalid = sv !== '' && (!sv.startsWith('0x') || sv.length !== 42)
                            return (
                              <div key={subKey}>
                                <label className="block text-xs text-gray-400 mb-1">{c.label}</label>
                                <input type="text" value={sv} onChange={(e) => setValue(subKey, e.target.value)}
                                  placeholder="0x..."
                                  className={`w-full bg-gray-800 border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono ${invalid ? 'border-red-700' : 'border-gray-700'}`} />
                              </div>
                            )
                          }
                          if (c.type === 'uint256') {
                            const signed = /^int\d*$/.test(c.solType)
                            return (
                              <div key={subKey}>
                                <label className="block text-xs text-gray-400 mb-1">
                                  {c.label} <span className="text-gray-600">({c.solType})</span>
                                </label>
                                <input type="text" value={sv}
                                  onChange={(e) => {
                                    const v = signed
                                      ? (e.target.value.match(/^-?\d*/) ?? [''])[0]
                                      : e.target.value.replace(/\D/g, '')
                                    setValue(subKey, v)
                                  }}
                                  placeholder={signed ? '정수 (음수 가능)' : (PARAM_PLACEHOLDERS[c.key] ?? '숫자 입력')}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
                              </div>
                            )
                          }
                          if (c.type === 'raw-hex') {
                            return (
                              <div key={subKey}>
                                <label className="block text-xs text-gray-400 mb-1">
                                  {c.label} <span className="text-gray-600">({c.solType})</span>
                                </label>
                                <input type="text" value={sv} onChange={(e) => setValue(subKey, e.target.value)}
                                  placeholder="0x..."
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono" />
                              </div>
                            )
                          }
                          if (c.type === 'disabled') {
                            return (
                              <div key={subKey}>
                                <label className="block text-xs text-gray-500 mb-1">{c.label}</label>
                                <div className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-600">
                                  {c.solType} — 지원 안 됨
                                </div>
                              </div>
                            )
                          }
                          // text (string) default
                          return (
                            <div key={subKey}>
                              <label className="block text-xs text-gray-400 mb-1">{c.label}</label>
                              <input type="text" value={sv} onChange={(e) => setValue(subKey, e.target.value)}
                                placeholder={c.label}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

                if (p.type === 'bool') {
                  const checked = formValues[p.key] === 'true'
                  // initialize with 'false' if not set
                  if (formValues[p.key] === undefined) {
                    setTimeout(() => setValue(p.key, 'false'), 0)
                  }
                  return (
                    <div key={p.key} className="flex items-center gap-3">
                      <label className="text-xs text-gray-400">{p.label}</label>
                      <button
                        type="button"
                        onClick={() => setValue(p.key, checked ? 'false' : 'true')}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          checked ? 'bg-blue-600' : 'bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            checked ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="text-xs text-gray-500">{checked ? 'true' : 'false'}</span>
                    </div>
                  )
                }

                if (p.type === 'uint256') {
                  return (
                    <div key={p.key}>
                      <label className="block text-xs text-gray-400 mb-1">
                        {p.label} <span className="text-gray-600">({p.solType})</span>
                      </label>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const signed = /^int\d*$/.test(p.solType)
                          const v = signed
                            ? (e.target.value.match(/^-?\d*/) ?? [''])[0]
                            : e.target.value.replace(/\D/g, '')
                          setValue(p.key, v)
                        }}
                        placeholder={/^int\d*$/.test(p.solType) ? '정수 (음수 가능)' : (PARAM_PLACEHOLDERS[p.key] ?? '숫자 입력')}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )
                }

                if (p.type === 'address') {
                  const invalid = val !== '' && (!val.startsWith('0x') || val.length !== 42)
                  return (
                    <div key={p.key}>
                      <label className="block text-xs text-gray-400 mb-1">{p.label}</label>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => setValue(p.key, e.target.value)}
                        placeholder="0x..."
                        className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono ${
                          invalid ? 'border-red-700' : 'border-gray-700'
                        }`}
                      />
                      {invalid && (
                        <p className="text-red-400 text-xs mt-1">올바른 주소 형식이 아닙니다</p>
                      )}
                    </div>
                  )
                }

                if (p.type === 'raw-hex') {
                  return (
                    <div key={p.key}>
                      <label className="block text-xs text-gray-400 mb-1">
                        {p.label} <span className="text-gray-600">({p.solType})</span>
                      </label>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => setValue(p.key, e.target.value)}
                        placeholder="0x..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  )
                }

                // text (default)
                return (
                  <div key={p.key}>
                    <label className="block text-xs text-gray-400 mb-1">{p.label}</label>
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

              <button
                onClick={() => void handleExecute()}
                disabled={!canExecute()}
                className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-orange-700 hover:bg-orange-600 text-white"
              >
                {isExecuting ? '실행 중...' : `실행: ${selectedFn.name}()`}
              </button>
            </div>
          )}

          {/* Action Logs */}
          {actionLogs.length > 0 && (
            <div className="border-t border-gray-800 pt-3">
              <p className="text-xs text-gray-500 mb-2">실행 로그</p>
              <div className="flex flex-col gap-1">
                {actionLogs.map((log) => (
                  <p
                    key={log.id}
                    className={`text-xs font-mono ${
                      log.type === 'error'
                        ? 'text-red-400'
                        : log.type === 'success'
                          ? 'text-green-400'
                          : 'text-gray-400'
                    }`}
                  >
                    {log.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Parsed Events */}
          {lastEvents && lastEvents.length > 0 && (
            <div className="border-t border-gray-800 pt-3">
              <p className="text-xs text-gray-500 mb-2">이벤트</p>
              <div className="flex flex-col gap-2">
                {lastEvents.map((evt, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-400 font-mono mb-1">{evt.name}</p>
                    <div className="flex flex-col gap-0.5">
                      {Object.entries(evt.args).map(([k, v]) => {
                        const isAddress = /^0x[0-9a-fA-F]{40}$/.test(v)
                        return (
                          <div key={k} className="flex gap-2 text-xs font-mono">
                            <span className="text-gray-500 shrink-0">{k}:</span>
                            {isAddress ? (
                              <a
                                href={explorerAddressUrl(v)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 truncate transition-colors"
                              >
                                {v}
                              </a>
                            ) : (
                              <span className="text-gray-300 break-all">{v}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
