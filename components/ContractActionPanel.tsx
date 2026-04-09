'use client'

import { useState, useMemo } from 'react'
import type { DeploymentResult, ActionFunctionDef } from '@/types'
import { abiWriteFunctionsToActions } from '@/lib/template-registry'
import { useContractAction } from '@/hooks/useContractAction'
import { explorerAddressUrl } from '@/lib/stablenet'

interface Props {
  deployment: DeploymentResult
  onClose: () => void
}

export default function ContractActionPanel({ deployment, onClose }: Props) {
  const [selectedFn, setSelectedFn] = useState<ActionFunctionDef | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  const { actionLogs, isExecuting, lastEvents, executeAction, clearActionLogs } = useContractAction()

  const writeFunctions = useMemo(() => {
    if (!deployment.abi) return []
    return abiWriteFunctionsToActions(deployment.abi as Parameters<typeof abiWriteFunctionsToActions>[0])
  }, [deployment.abi])

  function selectFn(fn: ActionFunctionDef) {
    setSelectedFn(fn)
    setFormValues({})
    clearActionLogs()
  }

  function setValue(key: string, val: string) {
    setFormValues((prev) => ({ ...prev, [key]: val }))
  }

  function canExecute(): boolean {
    if (!selectedFn || isExecuting) return false
    for (const p of selectedFn.params) {
      if (p.type === 'disabled') return false
      const val = formValues[p.key] ?? ''
      if (p.type === 'bool') continue // checkbox always has a value
      if (p.type === 'array') {
        try {
          const items = JSON.parse(val || '[]') as unknown[]
          if (!Array.isArray(items)) return false
        } catch { return false }
        continue
      }
      if (!val.trim()) return false
      if (p.type === 'address' && (val.length !== 42 || !val.startsWith('0x'))) return false
      if (p.type === 'uint256' && !/^\d+$/.test(val)) return false
    }
    return true
  }

  const contractAddress = deployment.proxyAddress ?? deployment.implementationAddress

  async function handleExecute() {
    if (!selectedFn || !contractAddress) return
    await executeAction({
      deploymentRowId: deployment.id,
      proxyAddress: contractAddress,
      abi: deployment.abi!,
      fn: selectedFn,
      formValues,
    })
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

      {writeFunctions.length === 0 && (
        <p className="text-gray-600 text-xs text-center py-4">
          ABI에 실행 가능한 write 함수가 없습니다
        </p>
      )}

      {writeFunctions.length > 0 && (
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
                  function setItems(next: string[]) {
                    setValue(p.key, JSON.stringify(next))
                  }
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
