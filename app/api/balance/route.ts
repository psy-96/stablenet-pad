export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import type { Address } from 'viem'
import { formatEther } from 'viem'
import { viemPublicClient } from '@/lib/viem-server'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: '유효한 주소가 필요합니다' }, { status: 400 })
  }

  try {
    const raw = await viemPublicClient.getBalance({ address: address as Address })
    return NextResponse.json({ balance: formatEther(raw) })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '잔액 조회 실패' },
      { status: 500 }
    )
  }
}
