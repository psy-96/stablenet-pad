'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { ContractParams, DeploymentResult } from '@/types'
import { TEMPLATE_REGISTRY } from '@/lib/template-registry'
import ContractParamsForm from './ContractParamsForm'
import TemplateCatalog from './TemplateCatalog'

const MAX_FILE_SIZE = 1024 * 1024 // 1MB

function validateFile(f: File): string | null {
  if (!f.name.endsWith('.sol')) return '.sol 파일만 업로드할 수 있습니다'
  if (f.size > MAX_FILE_SIZE) return `파일 크기가 1MB를 초과합니다 (${(f.size / 1024).toFixed(0)}KB)`
  return null
}

type DeployMode = 'template' | 'upload'

interface Props {
  onDeploy: (params: {
    file: File | null
    contractType: string
    params: ContractParams
    useProxy: boolean
  }) => void
  isDeploying: boolean
  deployerAddress: string | undefined
}

export default function DeployPanel({ onDeploy, isDeploying, deployerAddress }: Props) {
  const [mode, setMode] = useState<DeployMode>('template')

  // 템플릿 모드
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    TEMPLATE_REGISTRY[0]?.id ?? null
  )
  const [templateParams, setTemplateParams] = useState<ContractParams | null>(null)
  const [templateParamsValid, setTemplateParamsValid] = useState(false)
  const [templateUseProxy, setTemplateUseProxy] = useState(true)

  // 업로드 모드
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadParams, setUploadParams] = useState<ContractParams | null>(null)
  const [uploadParamsValid, setUploadParamsValid] = useState(false)
  const [uploadUseProxy, setUploadUseProxy] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 재배포 감지
  const [existingDeployment, setExistingDeployment] = useState<DeploymentResult | null>(null)
  const [showRedeployModal, setShowRedeployModal] = useState(false)

  const selectedTemplate = TEMPLATE_REGISTRY.find((t) => t.id === selectedTemplateId) ?? null

  function selectTemplate(id: string) {
    setSelectedTemplateId(id)
    setTemplateParams(null)
    setTemplateParamsValid(false)
    setExistingDeployment(null)
  }

  // 재배포 감지
  useEffect(() => {
    const isTemplate = mode === 'template'
    const contractName = isTemplate
      ? selectedTemplateId
      : file?.name.replace(/\.sol$/, '') ?? null
    if (!contractName) return

    let cancelled = false
    fetch(`/api/deployments`)
      .then((r) => r.json())
      .then((data: { deployments: DeploymentResult[] }) => {
        if (cancelled) return
        const found = (data.deployments ?? []).find(
          (d) => d.contractName === contractName && d.status === 'success'
        )
        setExistingDeployment(found ?? null)
      })
      .catch(() => { if (!cancelled) setExistingDeployment(null) })
    return () => { cancelled = true }
  }, [mode, selectedTemplateId, file])

  function handleFile(f: File) {
    const err = validateFile(f)
    setFileError(err)
    setFile(err ? null : f)
    if (err) setExistingDeployment(null)
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }, [])

  function switchMode(m: DeployMode) {
    setMode(m)
    setExistingDeployment(null)
    setShowRedeployModal(false)
  }

  // 현재 모드 기준 deploy 가능 여부
  const isTemplate = mode === 'template'
  const formValid = isTemplate ? templateParamsValid : uploadParamsValid
  const formParams = isTemplate ? templateParams : uploadParams
  const useProxy = isTemplate ? templateUseProxy : uploadUseProxy
  const contractType = isTemplate
    ? (selectedTemplateId ?? '')
    : (file?.name.replace(/\.sol$/, '') ?? '')

  const canDeploy = Boolean(
    formParams && formValid && deployerAddress && !isDeploying &&
    (isTemplate ? selectedTemplateId : file)
  )

  function handleSubmit() {
    if (!canDeploy || !formParams) return
    if (existingDeployment) { setShowRedeployModal(true); return }
    onDeploy({ file: isTemplate ? null : file, contractType, params: formParams, useProxy })
  }

  function confirmRedeploy() {
    setShowRedeployModal(false)
    if (!formParams) return
    onDeploy({ file: isTemplate ? null : file, contractType, params: formParams, useProxy })
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-gray-400">배포 패널</h2>

      {/* 모드 탭 */}
      <div className="flex gap-2">
        {(['template', 'upload'] as DeployMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`
              flex-1 py-2 text-sm rounded-lg border transition-colors
              ${mode === m
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}
            `}
          >
            {m === 'template' ? '템플릿 선택' : '파일 업로드'}
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
              onChange={(p, v) => { setTemplateParams(p); setTemplateParamsValid(v) }}
            />
          )}
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
        </>
      )}

      {/* 업로드 모드 */}
      {!isTemplate && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'}
              ${file ? 'border-green-700 bg-green-900/10' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".sol"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
            />
            {file ? (
              <div className="text-sm">
                <p className="text-green-400 font-medium">{file.name}</p>
                <p className="text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                <p className="mb-1">.sol 파일을 드래그하거나 클릭하여 선택</p>
                <p className="text-xs text-gray-600">최대 1MB</p>
              </div>
            )}
          </div>
          {fileError && <p className="text-red-400 text-xs">{fileError}</p>}

          {file && (
            <ContractParamsForm
              params={[]}
              onChange={(p, v) => { setUploadParams(p); setUploadParamsValid(v) }}
            />
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setUploadUseProxy(!uploadUseProxy)}
              className={`relative w-10 h-5 rounded-full transition-colors ${uploadUseProxy ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${uploadUseProxy ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-gray-300">
              Proxy 패턴 {uploadUseProxy ? 'ON' : 'OFF'}
              <span className="text-gray-500 ml-1">({uploadUseProxy ? '2 트랜잭션' : '1 트랜잭션'})</span>
            </span>
          </label>
        </>
      )}

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
    </div>
  )
}
