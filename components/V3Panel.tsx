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
  V3_FACTORY_ADDRESS,
  V3_POSITION_MANAGER_ADDRESS,
  V3_SWAP_ROUTER_ADDRESS,
  V3_FACTORY_ABI,
  V3_POSITION_MANAGER_ABI,
  V3_SWAP_ROUTER_ABI,
  V3_FACTORY_DEPLOYMENT,
  V3_POSITION_MANAGER_DEPLOYMENT,
  V3_SWAP_ROUTER_DEPLOYMENT,
  V3_POOL_ABI,
} from '@/lib/v3-config'
import type { DeploymentResult, ParsedEvent } from '@/types'

type V3Action = 'erc20' | 'factory' | 'positionManager' | 'swapRouter'

type ContractInfo = {
  name: string
  address: string
  abi: typeof V3_FACTORY_ABI | typeof V3_POSITION_MANAGER_ABI | typeof V3_SWAP_ROUTER_ABI
}

const CONTRACT_INFO: Record<Exclude<V3Action, 'erc20'>, ContractInfo> = {
  factory: { name: 'UniswapV3Factory', address: V3_FACTORY_ADDRESS, abi: V3_FACTORY_ABI },
  positionManager: { name: 'NonfungiblePositionManager', address: V3_POSITION_MANAGER_ADDRESS, abi: V3_POSITION_MANAGER_ABI },
  swapRouter: { name: 'SwapRouter', address: V3_SWAP_ROUTER_ADDRESS, abi: V3_SWAP_ROUTER_ABI },
}


export default function V3Panel() {
  const { address } = useAccount()
  const [v3Action, setV3Action] = useState<V3Action | null>(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentResult | null>(null)
  const [managedDeployment, setManagedDeployment] = useState<DeploymentResult | null>(null)
  const [abiCopied, setAbiCopied] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  function copyAbi() {
    if (!v3Action || v3Action === 'erc20') return
    const info = CONTRACT_INFO[v3Action]
    void navigator.clipboard.writeText(JSON.stringify(info.abi, null, 2)).then(() => {
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

  async function handleFactoryActionSuccess(fnName: string, events: ParsedEvent[] | null) {
    if (fnName !== 'createPool') return
    const poolCreated = events?.find((e) => e.name === 'PoolCreated')
    if (!poolCreated) return
    const pool = poolCreated.args['pool']
    if (!pool) return
    const token0 = poolCreated.args['token0'] ?? ''
    const token1 = poolCreated.args['token1'] ?? ''
    const t0short = token0.length >= 8 ? token0.slice(2, 8) : token0.replace('0x', '')
    const t1short = token1.length >= 8 ? token1.slice(2, 8) : token1.replace('0x', '')
    const name = `V3Pool_${t0short}_${t1short}`
    try {
      await fetch('/api/deployments/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address: pool, abi: V3_POOL_ABI }),
      })
    } catch {
      // 실패해도 무시 — 수동으로 import 가능
    }
    setHistoryKey((k) => k + 1)
  }

  function selectAction(action: V3Action) {
    setV3Action(action)
    setSelectedDeployment(null)
    setManagedDeployment(null)
  }

  const panelProxyAddress = selectedDeployment ? selectedDeployment.proxyAddress : deployedProxyAddress
  const panelImplAddress = selectedDeployment ? selectedDeployment.implementationAddress : deployedImplAddress
  const panelAbi = selectedDeployment ? (selectedDeployment.abi as object[] | null) : deployedAbi
  const panelTxHash = selectedDeployment ? selectedDeployment.txHash : null

  const activeContractInfo = v3Action && v3Action !== 'erc20' ? CONTRACT_INFO[v3Action] : null

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* ── 왼쪽: 빠른 작업 버튼 + 배포 이력 ── */}
      <div className="flex flex-col gap-4 overflow-hidden">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-400">V3 빠른 작업</h2>
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
                v3Action === 'erc20'
                  ? 'bg-blue-800 text-blue-200 border border-blue-600'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}
            >
              ERC20 토큰 생성
            </button>
            <button
              onClick={() => selectAction('factory')}
              className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                v3Action === 'factory'
                  ? 'bg-orange-900/60 text-orange-200 border border-orange-700'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}
            >
              <span className="block">Factory 관리</span>
              <span className="text-xs font-mono text-gray-500 truncate block">
                {V3_FACTORY_ADDRESS.slice(0, 10)}...
              </span>
            </button>
            <button
              onClick={() => selectAction('positionManager')}
              className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                v3Action === 'positionManager'
                  ? 'bg-orange-900/60 text-orange-200 border border-orange-700'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}
            >
              <span className="block">PositionManager 관리</span>
              <span className="text-xs font-mono text-gray-500 truncate block">
                {V3_POSITION_MANAGER_ADDRESS.slice(0, 10)}...
              </span>
            </button>
            <button
              onClick={() => selectAction('swapRouter')}
              className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                v3Action === 'swapRouter'
                  ? 'bg-orange-900/60 text-orange-200 border border-orange-700'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}
            >
              <span className="block">SwapRouter 관리</span>
              <span className="text-xs font-mono text-gray-500 truncate block">
                {V3_SWAP_ROUTER_ADDRESS.slice(0, 10)}...
              </span>
            </button>
          </div>

          {/* 주소 링크 */}
          <div className="mt-3 pt-3 border-t border-gray-800 flex flex-col gap-1">
            <a
              href={explorerAddressUrl(V3_FACTORY_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-blue-400 font-mono transition-colors truncate"
            >
              Factory: {V3_FACTORY_ADDRESS}
            </a>
            <a
              href={explorerAddressUrl(V3_POSITION_MANAGER_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-blue-400 font-mono transition-colors truncate"
            >
              PosMgr: {V3_POSITION_MANAGER_ADDRESS}
            </a>
            <a
              href={explorerAddressUrl(V3_SWAP_ROUTER_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-blue-400 font-mono transition-colors truncate"
            >
              Router: {V3_SWAP_ROUTER_ADDRESS}
            </a>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex-1 overflow-y-auto">
          <DeployHistory
            key={historyKey}
            onSelectDeployment={(d) => {
              setSelectedDeployment(d)
              setManagedDeployment(null)
              if (v3Action !== 'erc20') setV3Action('erc20')
            }}
            onManageDeployment={(d) => {
              setManagedDeployment(d)
              setSelectedDeployment(null)
              setV3Action('erc20')
            }}
          />
        </div>
      </div>

      {/* ── 가운데: 로그 스트림 또는 컨트랙트 정보 ── */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 overflow-y-auto">
        {v3Action === 'erc20' ? (
          <>
            <h2 className="text-sm font-medium text-gray-400 mb-3">배포 로그</h2>
            <LogStream
              logs={logs}
              deploymentId={null}
              onSSEEvent={handleSSEEvent}
            />
          </>
        ) : activeContractInfo ? (
          <div className="flex flex-col gap-3 h-full">
            <h2 className="text-sm font-medium text-gray-400">컨트랙트 정보</h2>
            <div className="bg-gray-800 rounded-lg p-3 text-xs font-mono space-y-1">
              <p className="text-gray-500">이름</p>
              <p className="text-gray-300">{activeContractInfo.name}</p>
              <p className="text-gray-500 mt-2">주소</p>
              <a
                href={explorerAddressUrl(activeContractInfo.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 break-all transition-colors"
              >
                {activeContractInfo.address}
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
              {JSON.stringify(activeContractInfo.abi, null, 2)}
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
        {v3Action === 'erc20' && managedDeployment && (
          <ContractActionPanel
            deployment={managedDeployment}
            onClose={() => setManagedDeployment(null)}
          />
        )}

        {v3Action === 'erc20' && !managedDeployment && (
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

        {v3Action === 'factory' && (
          <ContractActionPanel
            deployment={V3_FACTORY_DEPLOYMENT}
            onClose={() => setV3Action(null)}
            onActionSuccess={(fn, evts) => void handleFactoryActionSuccess(fn, evts)}
          />
        )}

        {v3Action === 'positionManager' && (
          <ContractActionPanel
            deployment={V3_POSITION_MANAGER_DEPLOYMENT}
            onClose={() => setV3Action(null)}
          />
        )}

        {v3Action === 'swapRouter' && (
          <ContractActionPanel
            deployment={V3_SWAP_ROUTER_DEPLOYMENT}
            onClose={() => setV3Action(null)}
          />
        )}

        {v3Action === null && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-gray-700 text-sm text-center">
              V3 작업을 선택해주세요
            </p>
          </div>
        )}
      </div>

      {guideOpen && (
        <GuideModal
          title="UniswapV3 시작 가이드"
          steps={[
            {
              title: '1단계: ERC20 토큰 2개 배포',
              tip: 'ERC20 토큰 생성 → Proxy OFF → 이름·심볼·초기 발행량 입력 후 배포. TokenA와 TokenB 각각 반복.',
            },
            {
              title: '2단계: Factory → createPool(TokenA, TokenB, fee)',
              tip: 'Factory 관리 탭 → createPool 실행. fee는 500(0.05%)·3000(0.3%)·10000(1%) 중 선택. 성공 시 배포 이력에 Pool이 자동 등록됩니다.',
            },
            {
              title: '3단계: Pool → initialize(sqrtPriceX96)',
              tip: '배포 이력에서 Pool 관리 → initialize 실행. sqrtPriceX96 = √(tokenB/tokenA) × 2^96. 1:1 비율이면 79228162514264337593543950336.',
            },
            {
              title: '4단계: 두 토큰 approve → PositionManager 주소',
              tip: '각 토큰 관리 → approve(spender=PositionManager주소, amount=충분한값). mint 전 반드시 실행.',
            },
            {
              title: '5단계: PositionManager → mint',
              tip: '유동성 범위(tickLower/tickUpper)와 amount0Desired/amount1Desired를 입력. 처음이라면 tickLower=-887220, tickUpper=887220(전 범위)로 시작.',
            },
            {
              title: '6단계: SwapRouter → exactInputSingle',
              tip: 'tokenIn/tokenOut/fee/recipient/deadline/amountIn/amountOutMinimum(기본 0)/sqrtPriceLimitX96(기본 0) 입력. approve 먼저 확인.',
            },
          ]}
          footer="단위 참고: 1 토큰 = 1000000000000000000 (18 decimals)"
          onClose={() => setGuideOpen(false)}
        />
      )}
    </div>
  )
}
