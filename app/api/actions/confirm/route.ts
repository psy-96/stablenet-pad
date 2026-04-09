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
    const { data: dep, error: depError } = await supabaseServer
      .from('deployments')
      .select('id, abi')
      .eq('id', deploymentRowId)
      .single()

    console.log('[confirm] deploymentRowId:', deploymentRowId)
    console.log('[confirm] dep found:', Boolean(dep), 'dep.abi type:', dep ? typeof dep.abi : 'N/A', 'depError:', depError?.message)

    if (!dep) {
      return NextResponse.json(
        { error: `deployment ${deploymentRowId} 을 찾을 수 없습니다` },
        { status: 400 }
      )
    }
    if (dep.abi) {
      deploymentAbi = dep.abi as Abi
      console.log('[confirm] deploymentAbi loaded, length:', (dep.abi as unknown[]).length)
    } else {
      console.log('[confirm] dep.abi is null/undefined — skipping event parse')
    }
  }

  // receipt.logs에서 이벤트 파싱
  let events: ParsedEvent[] = []
  if (deploymentAbi) {
    try {
      // viem getTransactionReceipt
      const receipt = await viemPublicClient.getTransactionReceipt({
        hash: txHash as Hash,
      })
      console.log('[confirm] viem receipt.logs.length:', receipt.logs.length)
      console.log('[confirm] viem receipt (full):', JSON.stringify(receipt, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v
      ))

      // raw eth_getTransactionReceipt — viem 파싱 없이 RPC 응답 직접 확인
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.test.stablenet.network'
      const rawRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        }),
      })
      const rawJson = (await rawRes.json()) as unknown
      console.log('[confirm] raw eth_getTransactionReceipt:', JSON.stringify(rawJson))

      events = parseReceiptEvents([...receipt.logs], deploymentAbi)
      console.log('[confirm] parsed events.length:', events.length)
    } catch (err) {
      console.log('[confirm] receipt/parse error:', err instanceof Error ? err.message : String(err))
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

  return NextResponse.json({
    success: true,
    actionId: (data as { id: string }).id,
    events,
  } satisfies ActionConfirmResponse)
}
