export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import os from 'os'
import path from 'path'
import fs from 'fs'
import type { Hash } from 'viem'
import { supabaseServer } from '@/lib/supabase/server'
import { pushDeploymentArtifact } from '@/lib/github'
import { emitSSE } from '@/lib/sse-emitter'
import { viemPublicClient } from '@/lib/viem-server'
import type { ConfirmRequest, DeploymentArtifact } from '@/types'

export async function POST(req: NextRequest) {
  let body: ConfirmRequest
  try {
    body = (await req.json()) as ConfirmRequest
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다' }, { status: 400 })
  }

  const { deploymentId, contractName, contractType, txHash, implAddress, deployerAddress, abi } =
    body

  emitSSE(deploymentId, {
    event: 'saving',
    data: { message: 'Receipt 확인 중...' },
  })

  // ─── Receipt 대기 (서버사이드 — CORS 우회) ─────────────────────────────────
  let proxyAddress: string
  let blockNumber: number

  try {
    const receipt = await viemPublicClient.waitForTransactionReceipt({
      hash: txHash as Hash,
      timeout: 120_000,
      pollingInterval: 3_000,
    })

    if (!receipt.contractAddress) {
      throw new Error('컨트랙트 주소를 receipt에서 찾을 수 없습니다')
    }

    proxyAddress = receipt.contractAddress
    blockNumber = Number(receipt.blockNumber)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Receipt 조회 실패'
    emitSSE(deploymentId, { event: 'error', data: { message: msg } })
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  emitSSE(deploymentId, {
    event: 'saving',
    data: { message: '결과물 저장 중...' },
  })

  // ─── Step 1: Supabase INSERT (source of truth) ───────────────────────────
  const { data: existing } = await supabaseServer
    .from('deployments')
    .select('proxy_address')
    .eq('contract_name', contractName)
    .eq('type', contractType)
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)

  const previousProxyAddress: string | null =
    existing && existing.length > 0
      ? (existing[0] as { proxy_address: string | null }).proxy_address
      : null

  const isRedeploy = previousProxyAddress !== null

  const { error: supabaseError } = await supabaseServer.from('deployments').insert({
    contract_name: contractName,
    type: contractType,
    proxy_address: proxyAddress,
    implementation_address: implAddress ?? null,
    previous_proxy_address: previousProxyAddress,
    tx_hash: txHash,
    block_number: blockNumber,
    deployer: deployerAddress,
    network: 'stablenet-testnet',
    chain_id: 8283,
    status: 'success',
    abi,
  })

  if (supabaseError) {
    console.error('[POST /api/deploy/confirm] Supabase insert error:', supabaseError)
    emitSSE(deploymentId, {
      event: 'error',
      data: { message: `Supabase 저장 실패: ${supabaseError.message}` },
    })
    return NextResponse.json({ error: supabaseError.message }, { status: 500 })
  }

  // ─── Step 2: 로컬 JSON 파일 작성 ────────────────────────────────────────
  const artifact: DeploymentArtifact = {
    contractName,
    type: contractType,
    network: 'stablenet-testnet',
    chainId: 8283,
    proxyAddress,
    implementationAddress: implAddress ?? null,
    previousProxyAddress,
    abi,
    txHash,
    blockNumber,
    deployedAt: new Date().toISOString(),
    deployer: deployerAddress,
  }

  // 파일명: {contractName}_{proxyAddress 앞 8자리}.json, type 서브폴더로 분류
  // 예: deployments/stablenet-testnet/ERC20/KRWToken_551ce0c4.json
  const addrSlug = proxyAddress.toLowerCase().replace(/^0x/, '').slice(0, 8)
  const artifactFileName = `${contractName}_${addrSlug}.json`

  const localDir = path.join(process.cwd(), 'deployments', 'stablenet-testnet', contractType)
  await fs.promises.mkdir(localDir, { recursive: true })
  await fs.promises.writeFile(
    path.join(localDir, artifactFileName),
    JSON.stringify(artifact, null, 2)
  )

  // ─── Step 3: GitHub push ──────────────────────────────────────────────────
  const { commitUrl, error: githubError } = await pushDeploymentArtifact(
    contractType,
    artifactFileName,
    artifact,
    isRedeploy
  )

  // 임시 파일 정리
  const tmpDir = path.join(os.tmpdir(), 'contracts', deploymentId)
  fs.rm(tmpDir, { recursive: true, force: true }, () => {})

  if (githubError) {
    emitSSE(deploymentId, {
      event: 'done',
      data: {
        message: '배포 완료 (GitHub push 실패 — JSON 다운로드로 공유하세요)',
        githubCommitUrl: null,
      },
    })
    return NextResponse.json({ success: true, githubCommitUrl: null, proxyAddress, blockNumber })
  }

  emitSSE(deploymentId, {
    event: 'done',
    data: { message: '배포 완료', githubCommitUrl: commitUrl },
  })

  return NextResponse.json({ success: true, githubCommitUrl: commitUrl, proxyAddress, blockNumber })
}
