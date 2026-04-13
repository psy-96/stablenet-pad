'use client'

import { useState, useRef } from 'react'

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

interface Props {
  onImportComplete: () => void
}

type State = 'idle' | 'submitting' | 'success'

export default function ImportContractForm({ onImportComplete }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [abiText, setAbiText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<State>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addressValid = ADDRESS_RE.test(address)
  const addressError = address && !addressValid ? '올바른 0x 주소 형식이 아닙니다' : null

  function parseAbi(): object[] | null {
    try {
      const parsed: unknown = JSON.parse(abiText.trim())
      if (!Array.isArray(parsed)) return null
      return parsed as object[]
    } catch {
      return null
    }
  }

  const abiParsed = abiText.trim() ? parseAbi() : null
  const abiError = abiText.trim() && !abiParsed ? 'ABI가 올바른 JSON 배열이 아닙니다' : null

  const canSubmit =
    state === 'idle' &&
    name.trim() &&
    addressValid &&
    abiParsed !== null

  async function handleSubmit() {
    if (!canSubmit || !abiParsed) return
    setError(null)
    setState('submitting')

    try {
      const res = await fetch('/api/deployments/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), address, abi: abiParsed }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? '임포트 실패')
        setState('idle')
        return
      }
      setState('success')
      onImportComplete()
    } catch {
      setError('네트워크 오류가 발생했습니다')
      setState('idle')
    }
  }

  function handleFileLoad(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAbiText((ev.target?.result as string | null) ?? '')
    }
    reader.readAsText(file)
    // input 초기화 (같은 파일 재선택 허용)
    e.target.value = ''
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <p className="text-green-400 text-sm font-medium">임포트 완료 ✓</p>
        <p className="text-gray-500 text-xs">배포 이력에서 관리할 수 있습니다</p>
        <button
          onClick={() => {
            setName('')
            setAddress('')
            setAbiText('')
            setError(null)
            setState('idle')
          }}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          다른 컨트랙트 임포트
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 컨트랙트 이름 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">
          컨트랙트 이름 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: UniswapV2Factory"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 컨트랙트 주소 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">
          컨트랙트 주소 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="0x..."
          className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none font-mono ${
            addressError ? 'border-red-700 focus:border-red-600' : 'border-gray-700 focus:border-blue-500'
          }`}
        />
        {addressError && <p className="text-red-400 text-xs">{addressError}</p>}
      </div>

      {/* ABI */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400">
            ABI (JSON 배열) <span className="text-red-400">*</span>
          </label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            .json 파일 업로드
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileLoad}
        />
        <textarea
          value={abiText}
          onChange={(e) => setAbiText(e.target.value)}
          placeholder='[{"type":"function","name":"..."}]'
          rows={6}
          className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-xs text-gray-300 placeholder-gray-600 focus:outline-none font-mono resize-none ${
            abiError ? 'border-red-700 focus:border-red-600' : 'border-gray-700 focus:border-blue-500'
          }`}
        />
        {abiError && <p className="text-red-400 text-xs">{abiError}</p>}
        {abiParsed && (
          <p className="text-gray-600 text-xs">{abiParsed.length}개 항목 파싱됨</p>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-900/10 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={() => void handleSubmit()}
        disabled={!canSubmit}
        className={`w-full py-3 rounded-lg font-medium text-sm transition-colors ${
          canSubmit
            ? 'bg-purple-600 hover:bg-purple-500 text-white'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
        }`}
      >
        {state === 'submitting' ? '임포트 중...' : '임포트'}
      </button>
    </div>
  )
}
