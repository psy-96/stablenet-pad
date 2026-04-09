'use client'

import { useState } from 'react'
import { explorerTxUrl, explorerAddressUrl } from '@/lib/stablenet'

interface Props {
  proxyAddress: string | null
  implementationAddress: string | null
  txHash: string | null
  abi: object[] | null
  githubCommitUrl: string | null
  onDownloadJson: (() => void) | null
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-2 shrink-0"
    >
      {copied ? '복사됨' : '복사'}
    </button>
  )
}

export default function ResultPanel({
  proxyAddress,
  implementationAddress,
  txHash,
  abi,
  githubCommitUrl,
  onDownloadJson,
}: Props) {
  const [showAbi, setShowAbi] = useState(false)

  // Proxy ON: proxyAddress 있음, implementationAddress 있음
  // Proxy OFF: proxyAddress null, implementationAddress 있음
  const canonicalAddress = proxyAddress ?? implementationAddress

  if (!canonicalAddress) {
    return (
      <div className="flex items-center justify-center h-full text-gray-700 text-sm">
        배포 완료 후 결과가 표시됩니다
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <h2 className="text-sm font-medium text-gray-400">배포 결과</h2>

      {/* 배포 주소 */}
      <div className="space-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">
            컨트랙트 주소{proxyAddress ? ' (Proxy)' : ''}
          </p>
          <div className="flex items-center gap-1">
            <a
              href={explorerAddressUrl(canonicalAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-mono text-xs break-all"
            >
              {canonicalAddress}
            </a>
            <CopyButton text={canonicalAddress} />
          </div>
        </div>

        {proxyAddress && implementationAddress && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Implementation 주소</p>
            <div className="flex items-center gap-1">
              <a
                href={explorerAddressUrl(implementationAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-300 font-mono text-xs break-all"
              >
                {implementationAddress}
              </a>
              <CopyButton text={implementationAddress} />
            </div>
          </div>
        )}

        {txHash && (
          <div>
            <p className="text-xs text-gray-500 mb-1">트랜잭션 해시</p>
            <div className="flex items-center gap-1">
              <a
                href={explorerTxUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-mono text-xs break-all"
              >
                {txHash.slice(0, 20)}...
              </a>
              <CopyButton text={txHash} />
            </div>
          </div>
        )}
      </div>

      {/* ABI 보기 */}
      {abi && (
        <div>
          <button
            onClick={() => setShowAbi(!showAbi)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showAbi ? '▲ ABI 닫기' : '▼ ABI 보기'}
          </button>
          {showAbi && (
            <pre className="mt-2 bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-400 overflow-auto max-h-48">
              {JSON.stringify(abi, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* GitHub + 다운로드 */}
      <div className="flex flex-col gap-2">
        {githubCommitUrl ? (
          <a
            href={githubCommitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg text-center transition-colors"
          >
            GitHub 커밋 보기 ↗
          </a>
        ) : (
          <div className="text-xs text-yellow-500 bg-yellow-900/20 border border-yellow-800 rounded-lg p-2">
            GitHub push 실패 — JSON으로 수동 공유하세요
          </div>
        )}

        {onDownloadJson && (
          <button
            onClick={onDownloadJson}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
          >
            JSON 다운로드
          </button>
        )}
      </div>
    </div>
  )
}
