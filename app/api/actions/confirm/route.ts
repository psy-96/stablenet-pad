export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { ActionConfirmRequest, ActionConfirmResponse } from '@/types'

/**
 * POST /api/actions/confirm
 * 운영 액션(write 함수 호출) 이력을 Supabase contract_actions 테이블에 저장한다.
 *
 * Request:  ActionConfirmRequest
 * Response: ActionConfirmResponse
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

  // deploymentRowId가 있으면 존재 여부 확인
  if (deploymentRowId) {
    const { data: dep } = await supabaseServer
      .from('deployments')
      .select('id')
      .eq('id', deploymentRowId)
      .single()

    if (!dep) {
      return NextResponse.json(
        { error: `deployment ${deploymentRowId} 을 찾을 수 없습니다` },
        { status: 400 }
      )
    }
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
      status: 'success',
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

  return NextResponse.json({
    success: true,
    actionId: (data as { id: string }).id,
  } satisfies ActionConfirmResponse)
}
