export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { viemPublicClient } from '@/lib/viem-server'
import type { Hash } from 'viem'

/**
 * POST /api/tx/wait
 * 브라우저 CORS 우회용 — 서버에서 waitForTransactionReceipt를 대신 처리한다.
 * Request:  { txHash: "0x..." }
 * Response: { contractAddress: "0x..." | null, blockNumber: number, txHash: "0x..." }
 */
export async function POST(req: NextRequest) {
  let txHash: Hash
  try {
    const body = (await req.json()) as { txHash: string }
    txHash = body.txHash as Hash
    if (!txHash) throw new Error('txHash 필수')
  } catch {
    return NextResponse.json({ error: 'txHash가 필요합니다' }, { status: 400 })
  }

  try {
    const receipt = await viemPublicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
      pollingInterval: 3_000,
    })

    return NextResponse.json({
      contractAddress: receipt.contractAddress ?? null,
      blockNumber: Number(receipt.blockNumber),
      txHash,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'receipt 조회 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
