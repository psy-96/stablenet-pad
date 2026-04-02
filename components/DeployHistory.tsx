'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DeploymentResult } from '@/types'
import { explorerAddressUrl } from '@/lib/stablenet'

interface Props {
  onSelectDeployment?: (deployment: DeploymentResult) => void
}

export default function DeployHistory({ onSelectDeployment }: Props) {
  const [deployments, setDeployments] = useState<DeploymentResult[]>([])
  const [loading, setLoading] = useState(false)

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

  if (loading) {
    return <p className="text-gray-600 text-xs text-center py-4">배포 이력 로딩 중...</p>
  }

  if (deployments.length === 0) {
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

      <div className="space-y-1">
        {deployments.map((d) => (
          <button
            key={d.id}
            onClick={() => onSelectDeployment?.(d)}
            className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                    d.type === 'ERC20'
                      ? 'bg-blue-900 text-blue-300'
                      : 'bg-purple-900 text-purple-300'
                  }`}
                >
                  {d.type}
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
            {d.proxyAddress && (
              <a
                href={explorerAddressUrl(d.proxyAddress)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-gray-600 hover:text-blue-400 font-mono mt-1 block truncate transition-colors"
              >
                {d.proxyAddress}
              </a>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
