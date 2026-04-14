'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DeploymentResult } from '@/types'
import { explorerAddressUrl } from '@/lib/stablenet'
import { getTemplateById } from '@/lib/template-registry'

interface Props {
  onSelectDeployment?: (deployment: DeploymentResult) => void
  onManageDeployment?: (deployment: DeploymentResult) => void
}

export default function DeployHistory({ onSelectDeployment, onManageDeployment }: Props) {
  const [deployments, setDeployments] = useState<DeploymentResult[]>([])
  const [loading, setLoading] = useState(false)
  const [pinningId, setPinningId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchDeployments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/deployments')
      const data = (await res.json()) as { deployments: DeploymentResult[] }
      setDeployments(data.deployments ?? [])
    } catch {
      // 무시 — 배포 이력 조회 실패는 UX에 치명적이지 않음
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDeployments()
  }, [fetchDeployments])

  const handleTogglePin = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (pinningId) return

    // Optimistic update
    setDeployments((prev) => {
      const updated = prev.map((d) =>
        d.id === id ? { ...d, pinned: !d.pinned } : d
      )
      // 핀 상태 변경 후 정렬: pinned DESC, createdAt DESC
      return [...updated].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    })

    setPinningId(id)
    try {
      const res = await fetch(`/api/deployments/${id}/pin`, { method: 'PATCH' })
      if (!res.ok) {
        // 실패 시 롤백
        setDeployments((prev) =>
          [...prev.map((d) => (d.id === id ? { ...d, pinned: !d.pinned } : d))].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })
        )
      }
    } catch {
      // 실패 시 롤백
      setDeployments((prev) =>
        [...prev.map((d) => (d.id === id ? { ...d, pinned: !d.pinned } : d))].sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
      )
    } finally {
      setPinningId(null)
    }
  }, [pinningId])

  if (loading) {
    return <p className="text-gray-600 text-xs text-center py-4">배포 이력 로딩 중...</p>
  }

  const filtered = searchQuery.trim()
    ? deployments.filter((d) => {
        const q = searchQuery.toLowerCase()
        return (
          d.contractName.toLowerCase().includes(q) ||
          (d.proxyAddress ?? '').toLowerCase().includes(q) ||
          (d.implementationAddress ?? '').toLowerCase().includes(q)
        )
      })
    : deployments

  if (deployments.length === 0 && !loading) {
    return <p className="text-gray-700 text-xs text-center py-4">배포 이력이 없습니다</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400">배포 이력</h2>
        <button
          onClick={() => void fetchDeployments()}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          새로고침
        </button>
      </div>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="이름 또는 주소 검색..."
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
      />

      {filtered.length === 0 && searchQuery.trim() && (
        <p className="text-gray-600 text-xs text-center py-2">검색 결과 없음</p>
      )}

      <div className="space-y-1">
        {filtered.map((d) => (
          <div
            key={d.id}
            className={`rounded-lg overflow-hidden ${d.pinned ? 'bg-gray-750 ring-1 ring-yellow-800/50' : 'bg-gray-800'}`}
          >
            <div className="flex items-stretch">
              <button
                onClick={() => onSelectDeployment?.(d)}
                className="flex-1 text-left px-3 py-2 hover:bg-gray-700 transition-colors min-w-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                        getTemplateById(d.type)
                          ? 'bg-blue-900 text-blue-300'
                          : d.source === 'imported'
                            ? 'bg-purple-900 text-purple-300'
                            : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {getTemplateById(d.type) ? d.type : d.source === 'imported' ? 'Imported' : 'General'}
                    </span>
                    <span className="text-sm text-gray-300 truncate">{d.contractName}</span>
                  </div>
                  <span className="text-xs text-gray-600 shrink-0">
                    {new Date(d.createdAt).toLocaleString('ko-KR', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {(d.proxyAddress ?? d.implementationAddress) && (
                  <a
                    href={explorerAddressUrl((d.proxyAddress ?? d.implementationAddress)!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-gray-600 hover:text-blue-400 font-mono mt-1 block truncate transition-colors"
                  >
                    {d.proxyAddress ?? d.implementationAddress}
                  </a>
                )}
              </button>

              {/* 핀 버튼 */}
              <button
                onClick={(e) => void handleTogglePin(e, d.id)}
                disabled={pinningId === d.id}
                title={d.pinned ? '핀 해제' : '핀 고정'}
                className={`px-2 flex items-start pt-2.5 transition-colors ${
                  d.pinned
                    ? 'text-yellow-400 hover:text-yellow-300'
                    : 'text-gray-700 hover:text-gray-500'
                } ${pinningId === d.id ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {d.pinned ? '★' : '☆'}
              </button>
            </div>

            {onManageDeployment && d.abi && (d.proxyAddress ?? d.implementationAddress) && (
              <div className="border-t border-gray-700 px-3 py-1.5">
                <button
                  onClick={() => onManageDeployment(d)}
                  className="text-xs text-gray-400 hover:text-gray-300 border border-gray-600 rounded px-2 py-0.5 transition-colors"
                >
                  관리 (write 함수 실행)
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
