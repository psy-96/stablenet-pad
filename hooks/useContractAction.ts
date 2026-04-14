'use client'

import { useState, useCallback } from 'react'
import { useAccount, useSendTransaction } from 'wagmi'
import { encodeFunctionData, type Abi } from 'viem'
import type { ActionFunctionDef, ActionConfirmRequest, ActionConfirmResponse, ParsedEvent } from '@/types'

export type ActionLogEntry = {
  id: number
  message: string
  type: 'info' | 'success' | 'error'
}

export interface ActionResult {
  success: boolean
  events: ParsedEvent[] | null
}

interface UseContractActionResult {
  actionLogs: ActionLogEntry[]
  isExecuting: boolean
  lastEvents: ParsedEvent[] | null
  executeAction: (params: {
    deploymentRowId: string
    proxyAddress: string
    abi: object[]
    fn: ActionFunctionDef
    /** 폼에서 수집한 파라미터 (key → string 값) */
    formValues: Record<string, string>
  }) => Promise<ActionResult>
  clearActionLogs: () => void
}

let actionLogCounter = 0

/** ABI 인코딩을 위한 타입 변환 */
function encodeArg(solType: string, val: string): unknown {
  // 배열 타입: JSON 직렬화된 string[] → 항목별 재귀 변환
  if (/\[\d*\]$/.test(solType)) {
    const itemType = solType.replace(/\[\d*\]$/, '')
    let items: string[]
    try {
      items = JSON.parse(val) as string[]
    } catch {
      throw new Error(`배열 파싱 실패 (${solType}): JSON 형식이어야 합니다`)
    }
    if (!Array.isArray(items)) throw new Error(`배열 파싱 실패 (${solType})`)
    return items.map((item) => encodeArg(itemType, String(item)))
  }
  if (val === '' || val === undefined) {
    throw new Error(`파라미터 값 누락: ${solType} 타입 필드`)
  }
  if (solType === 'bool') return val === 'true'
  if (/^u?int(\d+)?$/.test(solType)) return BigInt(val)
  // string, address, bytes*, bytes32 → 그대로 반환 (viem이 검증)
  return val
}

export function useContractAction(): UseContractActionResult {
  const { address } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()

  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [lastEvents, setLastEvents] = useState<ParsedEvent[] | null>(null)

  function addLog(message: string, type: ActionLogEntry['type'] = 'info') {
    setActionLogs((prev) => [...prev, { id: ++actionLogCounter, message, type }])
  }

  const clearActionLogs = useCallback(() => {
    setActionLogs([])
    setLastEvents(null)
  }, [])

  const executeAction = useCallback(
    async ({
      deploymentRowId,
      proxyAddress,
      abi,
      fn,
      formValues,
    }: {
      deploymentRowId: string
      proxyAddress: string
      abi: object[]
      fn: ActionFunctionDef
      formValues: Record<string, string>
    }): Promise<ActionResult> => {
      if (!address) {
        addLog('MetaMask 연결이 필요합니다', 'error')
        return { success: false, events: null }
      }

      setIsExecuting(true)
      clearActionLogs()

      try {
        // ── 1. args 인코딩 ──────────────────────────────────────────────
        const args = fn.params.map((p) => {
          // tuple: components를 순서대로 배열로 조립 (viem은 배열로 인코딩)
          if (p.type === 'tuple' && p.components) {
            return p.components.map((c) =>
              encodeArg(c.solType, formValues[`${p.key}.${c.key}`] ?? '')
            )
          }
          const val = formValues[p.key] ?? ''
          return encodeArg(p.solType, val)
        })

        // ── 2. calldata 생성 ────────────────────────────────────────────
        const data = encodeFunctionData({
          abi: abi as Abi,
          functionName: fn.name,
          args,
        })

        // ── 3. MetaMask 서명 + 전송 ─────────────────────────────────────
        addLog(`${fn.signature} 호출 중... MetaMask 서명 요청`)
        const txHash = await sendTransactionAsync({
          to: proxyAddress as `0x${string}`,
          data,
        })
        addLog(`트랜잭션 제출: ${txHash.slice(0, 18)}...`)

        // ── 4. Receipt 대기 (서버 CORS 우회) ────────────────────────────
        addLog('컨펌 대기 중...')
        const waitRes = await fetch('/api/tx/wait', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash }),
        })

        if (!waitRes.ok) {
          const err = (await waitRes.json()) as { error: string }
          throw new Error(`Receipt 조회 실패: ${err.error}`)
        }

        const { blockNumber } = (await waitRes.json()) as {
          blockNumber: number
          txHash: string
        }

        addLog(`트랜잭션 컨펌 완료 (블록: ${blockNumber})`, 'success')

        // ── 5. 이력 저장 (서버) ─────────────────────────────────────────
        const confirmBody: ActionConfirmRequest = {
          deploymentRowId,
          functionName: fn.name,
          params: formValues,
          txHash,
          blockNumber,
          executor: address,
        }

        const confirmRes = await fetch('/api/actions/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(confirmBody),
        })

        const confirmJson = (await confirmRes.json()) as ActionConfirmResponse | { success: false; error: string }

        let successEvents: ParsedEvent[] | null = null
        if (confirmRes.status === 400) {
          // tx revert — 실패로 처리
          const errMsg = 'error' in confirmJson ? confirmJson.error : '트랜잭션 실패 (revert)'
          throw new Error(errMsg)
        } else if (!confirmRes.ok) {
          // Supabase 등 서버 오류 — tx는 성공, 이력 저장만 실패
          addLog('액션 이력 저장 실패 (온체인 실행은 완료됨)', 'error')
        } else {
          const confirmed = confirmJson as ActionConfirmResponse
          if (confirmed.events && confirmed.events.length > 0) {
            setLastEvents(confirmed.events)
            successEvents = confirmed.events
          }
        }

        addLog(`${fn.name}() 실행 완료 ✓`, 'success')
        return { success: true, events: successEvents }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류'
        addLog(msg, 'error')
        return { success: false, events: null }
      } finally {
        setIsExecuting(false)
      }
    },
    [address, sendTransactionAsync, clearActionLogs]
  )

  return { actionLogs, isExecuting, lastEvents, executeAction, clearActionLogs }
}
