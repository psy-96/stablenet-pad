export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { compileContract } from '@/lib/hardhat'
import { emitSSE } from '@/lib/sse-emitter'
import { getTemplateById } from '@/lib/template-registry'
import type { DeployRequest } from '@/types'

// ABI + bytecode를 deploymentId별로 메모리에 보관 (Phase 1 → Phase 2/3 연결용)
// 1시간 TTL은 POST /api/upload의 setTimeout과 동기화
export const compiledCache = new Map<string, { abi: object[]; bytecode: string }>()

export async function POST(req: NextRequest) {
  let body: DeployRequest
  try {
    body = (await req.json()) as DeployRequest
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다' }, { status: 400 })
  }

  const { contractType, fileName, tempPath, deploymentId, params, useProxy, deployerAddress } = body

  if (!tempPath || !deploymentId || !contractType || !fileName) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 })
  }

  if (!deployerAddress) {
    return NextResponse.json({ error: '배포 주소가 필요합니다' }, { status: 400 })
  }

  // registry 기반 파라미터 유효성 검사 (템플릿 배포인 경우만)
  const template = getTemplateById(contractType)
  if (template) {
    const missingKey = template.params.find((p) => !params[p.key])?.key
    if (missingKey) {
      return NextResponse.json(
        { error: `필수 파라미터가 누락되었습니다: ${missingKey}` },
        { status: 400 }
      )
    }
  }

  void useProxy // Phase 2에서 브라우저가 처리; 여기서는 사용하지 않음

  const contractName = path.basename(fileName, '.sol')

  // SSE 스트림에 컴파일 시작 알림
  emitSSE(deploymentId, {
    event: 'compiling',
    data: { message: `${contractName}.sol 컴파일 중...` },
  })

  try {
    const result = await compileContract(tempPath, contractName)

    // ABI + bytecode 캐시 저장 (브라우저 응답 + Phase 3에서 사용)
    compiledCache.set(deploymentId, { abi: result.abi, bytecode: result.bytecode })

    // 1시간 후 캐시 정리
    setTimeout(() => compiledCache.delete(deploymentId), 60 * 60 * 1000)

    // SSE: compiled 이벤트 (abi/bytecode는 포함하지 않음 — HTTP 응답이 authoritative)
    emitSSE(deploymentId, {
      event: 'compiled',
      data: { message: `${contractName} 컴파일 완료` },
    })

    return NextResponse.json({
      deploymentId,
      status: 'compiled',
      bytecode: result.bytecode,
      abi: result.abi,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '컴파일 실패'
    emitSSE(deploymentId, {
      event: 'error',
      data: { message },
    })
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
