'use client'

import { useEffect, useRef } from 'react'
import type { LogEntry } from '@/hooks/useDeploy'

interface Props {
  logs: LogEntry[]
  deploymentId: string | null
  onSSEEvent?: (event: string, data: Record<string, unknown>) => void
}

export default function LogStream({ logs, deploymentId, onSSEEvent }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // SSE 구독 (Phase 1 + Phase 3 서버 이벤트 수신)
  useEffect(() => {
    if (!deploymentId) return

    const es = new EventSource(`/api/deploy/stream?deploymentId=${deploymentId}`)

    es.addEventListener('compiling', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as Record<string, unknown>
      onSSEEvent?.('compiling', data)
    })
    es.addEventListener('compiled', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as Record<string, unknown>
      onSSEEvent?.('compiled', data)
    })
    es.addEventListener('saving', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as Record<string, unknown>
      onSSEEvent?.('saving', data)
    })
    es.addEventListener('done', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as Record<string, unknown>
      onSSEEvent?.('done', data)
      es.close()
    })
    es.addEventListener('error', (e: MessageEvent) => {
      if (e.data) {
        const data = JSON.parse(e.data) as Record<string, unknown>
        onSSEEvent?.('error', data)
      }
      es.close()
    })

    return () => es.close()
  }, [deploymentId, onSSEEvent])

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-700 text-sm">
        배포 시작 시 로그가 표시됩니다
      </div>
    )
  }

  return (
    <div className="font-mono text-xs space-y-1 overflow-y-auto">
      {logs.map((log) => (
        <div
          key={log.id}
          className={`flex gap-2 ${
            log.type === 'error'
              ? 'text-red-400'
              : log.type === 'success'
              ? 'text-green-400'
              : 'text-gray-400'
          }`}
        >
          <span className="text-gray-600 shrink-0">
            {log.type === 'error' ? '✗' : log.type === 'success' ? '✓' : '›'}
          </span>
          <span className="break-all">{log.message}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
