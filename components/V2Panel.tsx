'use client'

import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useDeploy } from '@/hooks/useDeploy'
import DeployPanel from './DeployPanel'
import LogStream from './LogStream'
import ResultPanel from './ResultPanel'
import DeployHistory from './DeployHistory'
import ContractActionPanel from './ContractActionPanel'
import GuideModal from './GuideModal'
import { explorerAddressUrl } from '@/lib/stablenet'
import {
  V2_FACTORY_ADDRESS,
  V2_ROUTER_ADDRESS,
  FACTORY_ABI,
  ROUTER_ABI,
  FACTORY_DEPLOYMENT,
  ROUTER_DEPLOYMENT,
} from '@/lib/v2-config'
import type { DeploymentResult } from '@/types'

type V2Action = 'erc20' | 'factory' | 'router'

export default function V2Panel() {
  const { address } = useAccount()
  const [v2Action, setV2Action] = useState<V2Action | null>(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentResult | null>(null)
  const [managedDeployment, setManagedDeployment] = useState<DeploymentResult | null>(null)
  const [abiCopied, setAbiCopied] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  function copyAbi() {
    const abi = v2Action === 'factory' ? FACTORY_ABI : ROUTER_ABI
    void navigator.clipboard.writeText(JSON.stringify(abi, null, 2)).then(() => {
      setAbiCopied(true)
      setTimeout(() => setAbiCopied(false), 1500)
    })
  }

  const {
    logs,
    isDeploying,
    deploy,
    deployedProxyAddress,
    deployedImplAddress,
    deployedAbi,
    downloadArtifact,
  } = useDeploy()

  const handleSSEEvent = useCallback(() => {}, [])

  async function handleDeploy(params: Parameters<typeof deploy>[0]) {
    setSelectedDeployment(null)
    await deploy(params)
    setHistoryKey((k) => k + 1)
  }

  function selectAction(action: V2Action) {
    setV2Action(action)
    setSelectedDeployment(null)
    setManagedDeployment(null)
  }

  // 오른쪽 패널 결과 (ERC20 배포 후)
  const panelProxyAddress = selectedDeployment ? selectedDeployment.proxyAddress : deployedProxyAddress
  const panelImplAddress = selectedDeployment ? selectedDeployment.implementationAddress : deployedImplAddress
  const panelAbi = selectedDeployment ? (selectedDeployment.abi as object[] | null) : deployedAbi
  const panelTxHash = selectedDeployment ? selectedDeployment.txHash : null

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* ── 왼쪽: 빠른 작업 버튼 + 배포 이력 ── */}
      <div className="flex flex-col gap-4 overflow-hidden">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-400">V2 빠른 작업</h2>
            <button
              onClick={() => setGuideOpen(true)}
              className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-0.5 transition-colors"
            >
              가이드
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => selectAction('erc20')}
              className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                v2Action === 'erc20'
                  ? 'bg-blue-800 text-blue-200 border border-blue-600'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}
            >
              ERC20 토큰 생성
            </button>
            <button
              onClick={() => selectAction('factory')}
              className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                v2Action === 'factory'
                  ? 'bg-orange-900/60 text-orange-200 border border-orange-700'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}
            >
              <span className="block">Factory 관리</span>
              <span className="text-xs font-mono text-gray-500 truncate block">
                {V2_FACTORY_ADDRESS.slice(0, 10)}...
              </span>
            </button>
            <button
              onClick={() => selectAction('router')}
              className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                v2Action === 'router'
                  ? 'bg-orange-900/60 text-orange-200 border border-orange-700'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}
            >
              <span className="block">Router 관리</span>
              <span className="text-xs font-mono text-gray-500 truncate block">
                {V2_ROUTER_ADDRESS.slice(0, 10)}...
              </span>
            </button>
          </div>

          {/* 주소 링크 */}
          <div className="mt-3 pt-3 border-t border-gray-800 flex flex-col gap-1">
            <a
              href={explorerAddressUrl(V2_FACTORY_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-blue-400 font-mono transition-colors truncate"
            >
              Factory: {V2_FACTORY_ADDRESS}
            </a>
            <a
              href={explorerAddressUrl(V2_ROUTER_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-blue-400 font-mono transition-colors truncate"
            >
              Router: {V2_ROUTER_ADDRESS}
            </a>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex-1 overflow-y-auto">
          <DeployHistory
            key={historyKey}
            onSelectDeployment={(d) => {
              setSelectedDeployment(d)
              setManagedDeployment(null)
              if (v2Action === 'factory' || v2Action === 'router') setV2Action('erc20')
            }}
            onManageDeployment={(d) => {
              setManagedDeployment(d)
              setSelectedDeployment(null)
              setV2Action('erc20')
            }}
          />
        </div>
      </div>

      {/* ── 가운데: 로그 스트림 (ERC20 배포 시) ── */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 overflow-y-auto">
        {v2Action === 'erc20' ? (
          <>
            <h2 className="text-sm font-medium text-gray-400 mb-3">배포 로그</h2>
            <LogStream
              logs={logs}
              deploymentId={null}
              onSSEEvent={handleSSEEvent}
            />
          </>
        ) : v2Action === 'factory' || v2Action === 'router' ? (
          <div className="flex flex-col gap-3 h-full">
            <h2 className="text-sm font-medium text-gray-400">컨트랙트 정보</h2>
            <div className="bg-gray-800 rounded-lg p-3 text-xs font-mono space-y-1">
              <p className="text-gray-500">이름</p>
              <p className="text-gray-300">
                {v2Action === 'factory' ? 'UniswapV2Factory' : 'UniswapV2Router02'}
              </p>
              <p className="text-gray-500 mt-2">주소</p>
              <a
                href={explorerAddressUrl(
                  v2Action === 'factory' ? V2_FACTORY_ADDRESS : V2_ROUTER_ADDRESS
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 break-all transition-colors"
              >
                {v2Action === 'factory' ? V2_FACTORY_ADDRESS : V2_ROUTER_ADDRESS}
              </a>
            </div>

            {/* ABI */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">ABI</p>
              <button
                onClick={copyAbi}
                className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-0.5 transition-colors"
              >
                {abiCopied ? '복사됨 ✓' : 'ABI 복사'}
              </button>
            </div>
            <pre className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-400 overflow-y-auto max-h-96 whitespace-pre-wrap break-all">
              {JSON.stringify(v2Action === 'factory' ? FACTORY_ABI : ROUTER_ABI, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-gray-700 text-xs text-center py-8">
            왼쪽에서 작업을 선택해주세요
          </p>
        )}
      </div>

      {/* ── 오른쪽: 메인 패널 ── */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 overflow-y-auto">
        {v2Action === 'erc20' && managedDeployment && (
          <ContractActionPanel
            deployment={managedDeployment}
            onClose={() => setManagedDeployment(null)}
          />
        )}

        {v2Action === 'erc20' && !managedDeployment && (
          deployedProxyAddress ?? deployedImplAddress ?? selectedDeployment ? (
            <ResultPanel
              proxyAddress={panelProxyAddress}
              implementationAddress={panelImplAddress}
              txHash={panelTxHash}
              abi={panelAbi}
              githubCommitUrl={null}
              onDownloadJson={selectedDeployment ? null : downloadArtifact}
            />
          ) : (
            <DeployPanel
              onDeploy={handleDeploy}
              isDeploying={isDeploying}
              deployerAddress={address}
              initialTemplateId="ERC20"
              onImportComplete={() => setHistoryKey((k) => k + 1)}
            />
          )
        )}

        {v2Action === 'factory' && (
          <ContractActionPanel
            deployment={FACTORY_DEPLOYMENT}
            onClose={() => setV2Action(null)}
          />
        )}

        {v2Action === 'router' && (
          <ContractActionPanel
            deployment={ROUTER_DEPLOYMENT}
            onClose={() => setV2Action(null)}
          />
        )}

        {v2Action === null && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-gray-700 text-sm text-center">
              V2 작업을 선택해주세요
            </p>
          </div>
        )}
      </div>

      {guideOpen && (
        <GuideModal
          title="UniswapV2 시작 가이드"
          steps={[
            {
              title: '1단계: ERC20 토큰 2개 배포',
              tip: 'ERC20 토큰 생성 → Proxy OFF → 토큰 이름·심볼·초기 발행량 입력 후 배포. TokenA와 TokenB 각각 반복.',
            },
            {
              title: '2단계: Factory → createPair(TokenA, TokenB)',
              tip: 'Factory 관리 탭 → createPair 실행. 두 토큰 주소를 입력하면 Pair 컨트랙트가 생성됩니다.',
            },
            {
              title: '3단계: 두 토큰 approve → Router 주소',
              tip: '배포 이력에서 각 토큰 관리 → approve(spender=Router주소, amount=충분한값). 첫 유동성 공급 전 필수.',
            },
            {
              title: '4단계: Router → addLiquidity',
              tip: '첫 유동성이 가격 비율을 결정합니다. tokenA/tokenB 주소, amountDesired 2개, amountMin 2개(기본 0), to, deadline(기본값) 입력.',
            },
            {
              title: '5단계: Router → swapExactTokensForTokens',
              tip: 'amountIn, amountOutMin(기본 0), path=[TokenA주소,TokenB주소], to, deadline 입력. path 순서가 스왑 방향을 결정합니다.',
            },
          ]}
          footer="단위 참고: 1 토큰 = 1000000000000000000 (18 decimals)"
          onClose={() => setGuideOpen(false)}
        />
      )}
    </div>
  )
}
