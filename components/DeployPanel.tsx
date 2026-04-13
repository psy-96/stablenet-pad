'use client'

import { useState } from 'react'
import type { ContractParams, DeploymentResult } from '@/types'
import { TEMPLATE_REGISTRY } from '@/lib/template-registry'
import ContractParamsForm from './ContractParamsForm'
import TemplateCatalog from './TemplateCatalog'
import GenericDeploySection from './GenericDeploySection'
import ImportContractForm from './ImportContractForm'

type DeployMode = 'template' | 'upload' | 'import'

interface Props {
  onDeploy: (params: {
    file: File | null
    contractType: string
    contractName?: string
    params: ContractParams
    useProxy: boolean
  }) => void
  isDeploying: boolean
  deployerAddress: string | undefined
  onImportComplete?: () => void
}

export default function DeployPanel({ onDeploy, isDeploying, deployerAddress, onImportComplete }: Props) {
  const [mode, setMode] = useState<DeployMode>('template')

  // 템플릿 모드
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    TEMPLATE_REGISTRY[0]?.id ?? null
  )
  const [templateParams, setTemplateParams] = useState<ContractParams | null>(null)
  const [templateParamsValid, setTemplateParamsValid] = useState(false)
  const [templateUseProxy, setTemplateUseProxy] = useState(true)
  const [templateContractName, setTemplateContractName] = useState('')

  // 재배포 감지 (템플릿 모드 전용 — 업로드 모드는 GenericDeploySection이 처리)
  const [existingDeployment, setExistingDeployment] = useState<DeploymentResult | null>(null)
  const [showRedeployModal, setShowRedeployModal] = useState(false)

  const selectedTemplate = TEMPLATE_REGISTRY.find((t) => t.id === selectedTemplateId) ?? null

  function selectTemplate(id: string) {
    setSelectedTemplateId(id)
    setTemplateParams(null)
    setTemplateParamsValid(false)
    setTemplateContractName('')
    setExistingDeployment(null)
  }

  function handleTemplateParamsChange(p: ContractParams | null, v: boolean) {
    setTemplateParams(p)
    setTemplateParamsValid(v)
    // 'name' 파라미터가 있는 템플릿(ERC20 등)은 contractName 자동 동기화
    if (p && selectedTemplate?.params.some((tp) => tp.key === 'name') && p.name) {
      setTemplateContractName(p.name)
    }
  }

  function switchMode(m: DeployMode) {
    setMode(m)
    setExistingDeployment(null)
    setShowRedeployModal(false)
  }

  const isTemplate = mode === 'template'

  const canDeploy = Boolean(
    templateParams && templateParamsValid && deployerAddress && !isDeploying &&
    selectedTemplateId && templateContractName.trim()
  )

  function handleSubmit() {
    if (!canDeploy || !templateParams) return
    if (existingDeployment) { setShowRedeployModal(true); return }
    onDeploy({
      file: null,
      contractType: selectedTemplateId ?? '',
      contractName: templateContractName.trim(),
      params: templateParams,
      useProxy: templateUseProxy,
    })
  }

  function confirmRedeploy() {
    setShowRedeployModal(false)
    if (!templateParams) return
    onDeploy({
      file: null,
      contractType: selectedTemplateId ?? '',
      contractName: templateContractName.trim(),
      params: templateParams,
      useProxy: templateUseProxy,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-gray-400">배포 패널</h2>

      {/* 모드 탭 */}
      <div className="flex gap-1.5">
        {(['template', 'upload', 'import'] as DeployMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`
              flex-1 py-1.5 text-xs rounded-lg border transition-colors
              ${mode === m
                ? m === 'import'
                  ? 'bg-purple-700 border-purple-600 text-white'
                  : 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}
            `}
          >
            {m === 'template' ? '템플릿 선택' : m === 'upload' ? '파일 업로드' : '임포트'}
          </button>
        ))}
      </div>

      {/* 템플릿 모드 */}
      {isTemplate && (
        <>
          <TemplateCatalog
            templates={TEMPLATE_REGISTRY}
            selectedId={selectedTemplateId}
            onSelect={selectTemplate}
          />
          {selectedTemplate && (
            <ContractParamsForm
              params={selectedTemplate.params}
              onChange={handleTemplateParamsChange}
            />
          )}

          {/* 컨트랙트 이름 입력 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">
              컨트랙트 이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={templateContractName}
              onChange={(e) => setTemplateContractName(e.target.value)}
              placeholder="예: KRWToken"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            {!templateContractName.trim() && templateParams && (
              <p className="text-xs text-yellow-500">배포 결과 저장에 사용됩니다 (필수)</p>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setTemplateUseProxy(!templateUseProxy)}
              className={`relative w-10 h-5 rounded-full transition-colors ${templateUseProxy ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${templateUseProxy ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-gray-300">
              Proxy 패턴 {templateUseProxy ? 'ON' : 'OFF'}
              <span className="text-gray-500 ml-1">({templateUseProxy ? '2 트랜잭션' : '1 트랜잭션'})</span>
            </span>
          </label>

          {/* 재배포 감지 배너 */}
          {existingDeployment && (
            <div className="bg-orange-900/20 border border-orange-800 rounded-lg p-3 text-xs text-orange-400">
              <p className="font-medium mb-1">재배포 감지</p>
              <p className="text-orange-500">{existingDeployment.contractName}이 이미 배포되어 있습니다.</p>
              <p className="text-gray-600 font-mono mt-1 break-all">
                현재: {existingDeployment.proxyAddress ?? existingDeployment.implementationAddress ?? '-'}
              </p>
            </div>
          )}

          {!deployerAddress && (
            <p className="text-yellow-500 text-xs text-center">MetaMask를 연결해야 배포할 수 있습니다</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canDeploy}
            className={`
              w-full py-3 rounded-lg font-medium text-sm transition-colors
              ${canDeploy
                ? existingDeployment
                  ? 'bg-orange-600 hover:bg-orange-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'}
            `}
          >
            {isDeploying ? '배포 중...' : existingDeployment ? '재배포' : '배포 시작'}
          </button>

          {/* 재배포 확인 모달 */}
          {showRedeployModal && existingDeployment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4">
                <h3 className="text-white font-semibold mb-2">재배포 확인</h3>
                <p className="text-gray-400 text-sm mb-4">
                  <span className="text-orange-400 font-medium">{existingDeployment.contractName}</span>이
                  이미 배포되어 있습니다. 새 주소로 덮어쓰겠습니까?
                </p>
                <div className="bg-gray-800 rounded-lg p-3 text-xs font-mono space-y-1 mb-4">
                  <div>
                    <span className="text-gray-500">기존 주소: </span>
                    <span className="text-gray-400 break-all">
                      {existingDeployment.proxyAddress ?? existingDeployment.implementationAddress ?? '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">배포 시각: </span>
                    <span className="text-gray-500">
                      {new Date(existingDeployment.createdAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                </div>
                <p className="text-gray-600 text-xs mb-5">
                  기존 주소는 <code>previousProxyAddress</code>로 보존됩니다.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRedeployModal(false)}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={confirmRedeploy}
                    className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-lg transition-colors"
                  >
                    재배포 진행
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 업로드 모드 — GenericDeploySection이 전체 UX 담당 */}
      {mode === 'upload' && (
        <GenericDeploySection
          onDeploy={(params) => onDeploy({ ...params, file: params.file })}
          isDeploying={isDeploying}
          deployerAddress={deployerAddress}
        />
      )}

      {/* 임포트 모드 */}
      {mode === 'import' && (
        <ImportContractForm
          onImportComplete={() => onImportComplete?.()}
        />
      )}
    </div>
  )
}
