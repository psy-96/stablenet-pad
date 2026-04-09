export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { type Hash, type Abi } from 'viem'
import { supabaseServer } from '@/lib/supabase/server'
import { viemPublicClient } from '@/lib/viem-server'
import { parseReceiptEvents } from '@/lib/parse-events'
import type { ActionConfirmRequest, ActionConfirmResponse, ParsedEvent } from '@/types'

/**
 * POST /api/actions/confirm
 * 운영 액션(write 함수 호출) 이력을 Supabase contract_actions 테이블에 저장한다.
 * - receipt.status === 'reverted' 이면 status: 'failed' 로 저장 후 에러 반환
 * - receipt.logs를 deployment ABI로 디코딩해 events 컬럼에 함께 저장
 *
 * Request:  ActionConfirmRequest
 * Response: ActionConfirmResponse (events 포함)
 */
export async function POST(req: NextRequest) {
  let body: ActionConfirmRequest
  try {
    body = (await req.json()) as ActionConfirmRequest
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다' }, { status: 400 })
  }

  const { deploymentRowId, functionName, params, txHash, blockNumber, executor } = body

  if (!functionName || !txHash || !executor) {
    return NextResponse.json(
      { error: 'functionName, txHash, executor 는 필수입니다' },
      { status: 400 }
    )
  }

  // deploymentRowId가 있으면 존재 여부 확인 + ABI 조회
  let deploymentAbi: Abi | null = null
  if (deploymentRowId) {
    const { data: dep } = await supabaseServer
      .from('deployments')
      .select('id, abi')
      .eq('id', deploymentRowId)
      .single()

    if (!dep) {
      return NextResponse.json(
        { error: `deployment ${deploymentRowId} 을 찾을 수 없습니다` },
        { status: 400 }
      )
    }
    if (dep.abi) {
      deploymentAbi = dep.abi as Abi
    }
  }

  // receipt 조회 — status 확인 + 이벤트 파싱
  let txStatus: 'success' | 'failed' = 'success'
  let events: ParsedEvent[] = []

  try {
    const receipt = await viemPublicClient.getTransactionReceipt({
      hash: txHash as Hash,
    })

    if (receipt.status === 'reverted') {
      txStatus = 'failed'
    } else if (deploymentAbi) {
      events = parseReceiptEvents([...receipt.logs], deploymentAbi)
    }
  } catch {
    // receipt 조회 실패는 경고만 — 온체인 실행 결과는 이미 확정됨
  }

  const { data, error } = await supabaseServer
    .from('contract_actions')
    .insert({
      deployment_id: deploymentRowId || null,
      function_name: functionName,
      params: params ?? {},
      tx_hash: txHash,
      block_number: blockNumber,
      executor,
      network: 'stablenet-testnet',
      status: txStatus,
      events: events.length > 0 ? events : null,
    })
    .select('id')
    .single()

  if (error) {
    // 액션은 이미 온체인에서 완료됨 — Supabase 실패는 경고만
    console.error('[POST /api/actions/confirm] Supabase error:', error)
    return NextResponse.json(
      { success: false, error: error.message } satisfies { success: false; error: string },
      { status: 500 }
    )
  }

  if (txStatus === 'failed') {
    return NextResponse.json(
      { success: false, error: '트랜잭션이 실패했습니다 (status: 0x0)' } satisfies { success: false; error: string },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    actionId: (data as { id: string }).id,
    events,
  } satisfies ActionConfirmResponse)
}
