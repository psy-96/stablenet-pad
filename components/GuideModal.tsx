'use client'

import { useEffect } from 'react'

export interface GuideStep {
  title: string
  tip: string
}

interface Props {
  title: string
  steps: GuideStep[]
  footer?: string
  onClose: () => void
}

export default function GuideModal({ title, steps, footer, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-900 text-blue-300 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm text-gray-200 font-medium">{step.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.tip}</p>
              </div>
            </div>
          ))}

          {footer && (
            <div className="mt-2 pt-3 border-t border-gray-800 text-xs text-gray-600 font-mono">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
