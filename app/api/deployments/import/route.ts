export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이 아닙니다' }, { status: 400 })
  }

  const { name, address, abi } = body as Record<string, unknown>

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: '컨트랙트 이름을 입력하세요' }, { status: 400 })
  }

  if (typeof address !== 'string' || !ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: '주소가 올바른 0x 형식이 아닙니다 (40자리 hex)' }, { status: 400 })
  }

  if (!Array.isArray(abi) || abi.length === 0) {
    return NextResponse.json({ error: 'ABI가 유효한 JSON 배열이 아닙니다' }, { status: 400 })
  }

  // 중복 주소 검사 (implementation_address 또는 proxy_address)
  const { data: existing } = await supabaseServer
    .from('deployments')
    .select('id, contract_name')
    .or(`implementation_address.eq.${address},proxy_address.eq.${address}`)
    .limit(1)

  if (existing && existing.length > 0) {
    const dup = existing[0] as { contract_name: string }
    return NextResponse.json(
      { error: `이미 등록된 주소입니다 (${dup.contract_name})` },
      { status: 409 }
    )
  }

  const { data, error } = await supabaseServer
    .from('deployments')
    .insert({
      contract_name: name.trim(),
      type: 'imported',
      proxy_address: null,
      implementation_address: address,
      tx_hash: null,
      block_number: null,
      deployer: null,
      network: 'stablenet-testnet',
      chain_id: 8283,
      status: 'success',
      abi,
      source: 'imported',
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
