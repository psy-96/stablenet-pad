'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useBalance } from 'wagmi'
import Header from '@/components/Header'
import DeployPanel from '@/components/DeployPanel'
import LogStream from '@/components/LogStream'
import ResultPanel from '@/components/ResultPanel'
import DeployHistory from '@/components/DeployHistory'
import { useDeploy } from '@/hooks/useDeploy'
import type { DeploymentResult } from '@/types'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { address } = useAccount()
  const { data: balance } = useBalance({ address })
  const {
    logs,
    isDeploying,
    deploy,
    githubCommitUrl,
    deployedProxyAddress,
    deployedImplAddress,
    deployedAbi,
    downloadArtifact,
  } = useDeploy()

  const [deploymentId, setDeploymentId] = useState<string | null>(null)
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentResult | null>(null)
  const [historyKey, setHistoryKey] = useState(0) // DeployHistory 재마운트 트리거

  const hasNoBalance = balance && balance.value === 0n

  async function handleDeploy(params: Parameters<typeof deploy>[0]) {
    setSelectedDeployment(null)
    setDeploymentId(null)
    await deploy(params)
    // 배포 완료 후 이력 새로고침
    setHistoryKey((k) => k + 1)
  }

  const handleSSEEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      // SSE 이벤트는 useDeploy의 logs와 별개로 표시 불필요
      // (useDeploy가 서버 응답을 HTTP로 받아 이미 처리함)
      void event
      void data
    },
    []
  )

  // 이력에서 선택한 배포 결과를 ResultPanel에 표시
  const panelProxyAddress = selectedDeployment
    ? selectedDeployment.proxyAddress
    : deployedProxyAddress
  const panelImplAddress = selectedDeployment
    ? selectedDeployment.implementationAddress
    : deployedImplAddress
  const panelAbi = selectedDeployment
    ? (selectedDeployment.abi as object[] | null)
    : deployedAbi
  const panelTxHash = selectedDeployment ? selectedDeployment.txHash : null
  const panelGithub = selectedDeployment ? null : githubCommitUrl

  return (
    <div className="flex flex-col h-screen">
      <Header />

      {mounted && hasNoBalance && (
        <div className="bg-yellow-900/20 border-b border-yellow-800 px-6 py-2 text-xs text-yellow-400 text-center">
          WKRC 잔액이 0입니다. 가스비가 없으면 배포할 수 없습니다.
        </div>
      )}

      <main className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-3 gap-4 h-full">
          {/* 왼쪽: Deploy Panel */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 overflow-y-auto">
            <DeployPanel
              onDeploy={handleDeploy}
              isDeploying={isDeploying}
              deployerAddress={mounted ? address : undefined}
            />
          </div>

          {/* 가운데: Log Stream + Deploy History */}
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex-1 overflow-y-auto">
              <h2 className="text-sm font-medium text-gray-400 mb-3">배포 로그</h2>
              <LogStream
                logs={logs}
                deploymentId={deploymentId}
                onSSEEvent={handleSSEEvent}
              />
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex-1 overflow-y-auto">
              <DeployHistory
                key={historyKey}
                onSelectDeployment={(d) => {
                  setSelectedDeployment(d)
                }}
              />
            </div>
          </div>

          {/* 오른쪽: Result Panel */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 overflow-y-auto">
            <ResultPanel
              proxyAddress={panelProxyAddress}
              implementationAddress={panelImplAddress}
              txHash={panelTxHash}
              abi={panelAbi}
              githubCommitUrl={panelGithub}
              onDownloadJson={selectedDeployment ? null : downloadArtifact}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
