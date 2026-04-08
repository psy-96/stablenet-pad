'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { ContractParams } from '@/types'
import { abiInputsToTemplateParams } from '@/lib/template-registry'
import ContractParamsForm from './ContractParamsForm'

const MAX_FILE_SIZE = 1024 * 1024 // 1MB
const FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.sol$/

type State = 'upload' | 'compiling-preview' | 'params' | 'deploying' | 'done'

interface AbiItem {
  type: string
  name: string
  inputs?: { name: string; type: string }[]
}

interface Props {
  onDeploy: (params: {
    file: File
    contractType: string
    contractName: string
    params: ContractParams
    useProxy: boolean
  }) => void
  isDeploying: boolean
  deployerAddress: string | undefined
}

export default function GenericDeploySection({ onDeploy, isDeploying, deployerAddress }: Props) {
  const [state, setState] = useState<State>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // preview compile 결과
  const [templateParams, setTemplateParams] = useState<ReturnType<typeof abiInputsToTemplateParams> | null>(null)
  const [previewLogs, setPreviewLogs] = useState<string[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)

  // params 입력
  const [contractName, setContractName] = useState('')
  const [formParams, setFormParams] = useState<ContractParams | null>(null)
  const [formValid, setFormValid] = useState(false)
  const [useProxy, setUseProxy] = useState(true)
  const [hasInitializer, setHasInitializer] = useState(false)

  const esRef = useRef<EventSource | null>(null)

  function closeEventSource() {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }

  // 컴포넌트 언마운트 시 SSE 정리
  useEffect(() => () => closeEventSource(), [])

  function validateFile(f: File): string | null {
    if (!FILENAME_PATTERN.test(f.name))
      return '.sol 파일만 허용됩니다 (파일명: 영문자·숫자·_·- 만 사용 가능)'
    if (f.size > MAX_FILE_SIZE)
      return `파일 크기가 1MB를 초과합니다 (${(f.size / 1024).toFixed(0)}KB)`
    return null
  }

  function handleFile(f: File) {
    const err = validateFile(f)
    setFileError(err)
    if (!err) {
      setFile(f)
      setContractName(f.name.replace(/\.sol$/, ''))
    } else {
      setFile(null)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function resetToUpload() {
    closeEventSource()
    setState('upload')
    setPreviewLogs([])
    setPreviewError(null)
    setTemplateParams(null)
    setFormParams(null)
    setFormValid(false)
  }

  async function startPreviewCompile() {
    if (!file) return
    setState('compiling-preview')
    setPreviewLogs([])
    setPreviewError(null)
    closeEventSource()

    try {
      // 업로드
      setPreviewLogs((prev) => [...prev, '파일 업로드 중...'])
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) {
        const err = (await uploadRes.json()) as { error: string }
        throw new Error(err.error)
      }
      const { deploymentId, tempPath } = (await uploadRes.json()) as {
        deploymentId: string
        tempPath: string
      }

      // SSE 스트림 구독 (compile 로그 수신)
      const es = new EventSource(`/api/deploy/stream?deploymentId=${deploymentId}`)
      esRef.current = es
      es.addEventListener('compiling', (ev) => {
        setPreviewLogs((prev) => [...prev, (JSON.parse(ev.data) as { message: string }).message])
      })

      // 컴파일 요청
      setPreviewLogs((prev) => [...prev, 'Hardhat 컴파일 중...'])
      const deployRes = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractType: file.name.replace(/\.sol$/, ''),
          fileName: file.name,
          tempPath,
          deploymentId,
          params: {},
          useProxy: false,
          deployerAddress: deployerAddress ?? '0x0000000000000000000000000000000000000000',
        }),
      })

      closeEventSource()

      if (!deployRes.ok) {
        const err = (await deployRes.json()) as { error: string }
        throw new Error(err.error)
      }

      const compiled = (await deployRes.json()) as { abi: AbiItem[] }
      const result = abiInputsToTemplateParams(compiled.abi)

      if ('error' in result) {
        throw new Error(result.error)
      }

      const initFn = compiled.abi.find((item) => item.type === 'function' && item.name === 'initialize')
      setHasInitializer(Boolean(initFn))
      setTemplateParams(result)
      setPreviewLogs((prev) => [...prev, '컴파일 완료 ✓'])
      setState('params')
    } catch (err) {
      closeEventSource()
      const msg = err instanceof Error ? err.message : '컴파일 실패'
      setPreviewError(msg)
      setPreviewLogs((prev) => [...prev, `오류: ${msg}`])
      // 'upload' 상태로 복귀 (파일 보존)
      setState('upload')
    }
  }

  function handleDeploy() {
    const noParams = paramsResult?.params.length === 0
    const deployParams = noParams ? {} : formParams
    if (!file || !deployParams || !contractName.trim()) return
    setState('deploying')
    onDeploy({
      file,
      contractType: contractName.trim(),
      contractName: contractName.trim(),
      params: deployParams,
      useProxy,
    })
  }

  const paramsResult = templateParams && !('error' in templateParams) ? templateParams : null
  const noParams = paramsResult?.params.length === 0
  const canStartPreview = Boolean(file && !fileError && deployerAddress && state === 'upload')
  const canDeploy = Boolean(
    (noParams || (formParams && formValid)) && contractName.trim() && deployerAddress && !isDeploying
  )

  return (
    <div className="flex flex-col gap-4">
      {/* 파일 선택 영역 — upload + compiling-preview 상태에서 표시 */}
      {(state === 'upload' || state === 'compiling-preview') && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => state === 'upload' && fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${state === 'upload' ? 'cursor-pointer' : 'cursor-default'}
              ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'}
              ${file && state === 'upload' ? 'border-green-700 bg-green-900/10' : ''}
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
                <p className="text-xs text-gray-600">최대 1MB · 파일명: 영문자·숫자·_·- 만 허용</p>
              </div>
            )}
          </div>
          {fileError && <p className="text-red-400 text-xs">{fileError}</p>}

          {/* 컴파일 로그 */}
          {previewLogs.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono space-y-0.5">
              {previewLogs.map((log, i) => (
                <p key={i} className={log.startsWith('오류') ? 'text-red-400' : 'text-gray-400'}>
                  {log}
                </p>
              ))}
            </div>
          )}
          {previewError && (
            <p className="text-red-400 text-xs">{previewError}</p>
          )}

          {state === 'upload' && (
            <button
              onClick={startPreviewCompile}
              disabled={!canStartPreview}
              className={`
                w-full py-3 rounded-lg font-medium text-sm transition-colors
                ${canStartPreview
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'}
              `}
            >
              컴파일 미리보기
            </button>
          )}

          {state === 'compiling-preview' && (
            <div className="w-full py-3 rounded-lg bg-gray-800 text-gray-500 text-sm text-center">
              컴파일 중...
            </div>
          )}
        </>
      )}

      {/* 파라미터 입력 — params / deploying / done 상태에서 표시 */}
      {(state === 'params' || state === 'deploying' || state === 'done') && paramsResult && (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {state === 'params' ? (
              <button
                onClick={resetToUpload}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                ← 파일 다시 선택
              </button>
            ) : (
              <span className="text-blue-400/50">← 파일 다시 선택</span>
            )}
            <span>|</span>
            <span className="text-green-400">{file?.name}</span>
          </div>

          {/* read-only wrapper for deploying/done */}
          <div className={state !== 'params' ? 'pointer-events-none opacity-60' : ''}>
            {paramsResult.params.length > 0 ? (
              <ContractParamsForm
                params={paramsResult.params}
                onChange={(p, v) => { setFormParams(p); setFormValid(v) }}
              />
            ) : (
              <p className="text-xs text-gray-500 bg-gray-800 rounded-lg p-3">
                initialize() 파라미터 없음 — 추가 입력 불필요
              </p>
            )}

            {/* 컨트랙트 이름 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">
                컨트랙트 이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                disabled={state !== 'params'}
                placeholder="예: KRWToken"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:cursor-not-allowed"
              />
            </div>

            {/* Proxy 토글 */}
            <label className="flex items-center gap-3 cursor-pointer mt-3">
              <div
                onClick={() => state === 'params' && setUseProxy(!useProxy)}
                className={`relative w-10 h-5 rounded-full transition-colors ${useProxy ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${useProxy ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-300">
                Proxy 패턴 {useProxy ? 'ON' : 'OFF'}
                <span className="text-gray-500 ml-1">({useProxy ? '2 트랜잭션' : '1 트랜잭션'})</span>
              </span>
            </label>
          </div>

          {useProxy && !hasInitializer && state === 'params' && (
            <p className="text-xs text-yellow-500 bg-yellow-900/10 border border-yellow-800 rounded p-2">
              ⚠ initialize() 함수가 없습니다. Proxy ON으로 배포하면 초기화 없이 배포됩니다.
            </p>
          )}

          {!deployerAddress && state === 'params' && (
            <p className="text-yellow-500 text-xs text-center">MetaMask를 연결해야 배포할 수 있습니다</p>
          )}

          {state === 'params' && (
            <button
              onClick={handleDeploy}
              disabled={!canDeploy}
              className={`
                w-full py-3 rounded-lg font-medium text-sm transition-colors
                ${canDeploy
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'}
              `}
            >
              배포 시작
            </button>
          )}

          {state === 'deploying' && (
            <div className="w-full py-3 rounded-lg bg-gray-800 text-gray-500 text-sm text-center">
              배포 중... 로그를 확인하세요
            </div>
          )}
        </>
      )}
    </div>
  )
}
