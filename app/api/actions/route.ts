export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { ActionHistoryItem, ActionHistoryResponse, ParsedEvent } from '@/types'

/**
 * GET /api/actions?contract_address=0x...
 * 해당 컨트랙트 주소와 연결된 액션 이력을 최신순으로 20건 반환한다.
 */
export async function GET(req: NextRequest) {
  const contractAddress = req.nextUrl.searchParams.get('contract_address')

  if (!contractAddress || !/^0x[0-9a-fA-F]{40}$/i.test(contractAddress)) {
    return NextResponse.json({ error: 'contract_address 파라미터가 필요합니다' }, { status: 400 })
  }

  const addr = contractAddress.toLowerCase()

  // 1. 주소에 해당하는 deployment ID 조회
  const { data: deps } = await supabaseServer
    .from('deployments')
    .select('id')
    .or(`proxy_address.ilike.${addr},implementation_address.ilike.${addr}`)

  const deploymentIds = (deps ?? []).map((d: { id: string }) => d.id)

  if (deploymentIds.length === 0) {
    return NextResponse.json({ actions: [] } satisfies ActionHistoryResponse)
  }

  // 2. 해당 deployment들의 액션 이력 조회
  const { data: rows, error } = await supabaseServer
    .from('contract_actions')
    .select('id, function_name, params, tx_hash, block_number, executor, status, events, created_at')
    .in('deployment_id', deploymentIds)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const actions: ActionHistoryItem[] = (rows ?? []).map((row: {
    id: string
    function_name: string
    params: Record<string, string> | null
    tx_hash: string | null
    block_number: number | null
    executor: string | null
    status: string
    events: ParsedEvent[] | null
    created_at: string
  }) => ({
    id: row.id,
    functionName: row.function_name,
    params: row.params,
    txHash: row.tx_hash,
    blockNumber: row.block_number,
    executor: row.executor,
    status: row.status as 'success' | 'failed',
    events: row.events,
    createdAt: row.created_at,
  }))

  return NextResponse.json({ actions } satisfies ActionHistoryResponse)
}
