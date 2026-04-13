export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { DeploymentResult, ContractType } from '@/types'

export async function GET(req: NextRequest) {
  const typeFilter = req.nextUrl.searchParams.get('type') as ContractType | null

  let query = supabaseServer
    .from('deployments')
    .select('*')
    .eq('status', 'success')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (typeFilter) {
    query = query.eq('type', typeFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/deployments] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const deployments: DeploymentResult[] = (data ?? []).map((row) => ({
    id: row.id as string,
    contractName: row.contract_name as string,
    type: row.type as ContractType,
    proxyAddress: row.proxy_address as string | null,
    implementationAddress: row.implementation_address as string | null,
    previousProxyAddress: row.previous_proxy_address as string | null,
    txHash: row.tx_hash as string | null,
    blockNumber: row.block_number as number | null,
    deployer: row.deployer as string | null,
    network: row.network as string,
    chainId: row.chain_id as number,
    status: row.status as 'success' | 'failed',
    abi: row.abi as object[] | null,
    createdAt: row.created_at as string,
    pinned: (row.pinned as boolean | null) ?? false,
  }))

  return NextResponse.json({ deployments })
}
