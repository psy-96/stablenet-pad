export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import os from 'os'
import path from 'path'
import fs from 'fs'

const ALLOWED_TYPES = ['LiquidityPool'] as const
type AllowedType = (typeof ALLOWED_TYPES)[number]

const TEMPLATE_MAP: Record<AllowedType, string> = {
  LiquidityPool: path.join(process.cwd(), 'contracts', 'templates', 'LiquidityPool.sol'),
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')

  if (!type || !(ALLOWED_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: '지원하지 않는 템플릿 유형입니다' }, { status: 400 })
  }

  const templatePath = TEMPLATE_MAP[type as AllowedType]

  try {
    await fs.promises.access(templatePath, fs.constants.R_OK)
  } catch {
    return NextResponse.json(
      { error: '서버 LiquidityPool 템플릿을 찾을 수 없습니다' },
      { status: 500 }
    )
  }

  const deploymentId = randomUUID()
  const tmpDir = path.join(os.tmpdir(), 'contracts', deploymentId)
  await fs.promises.mkdir(tmpDir, { recursive: true })

  const tempPath = path.join(tmpDir, `${type}.sol`)
  await fs.promises.copyFile(templatePath, tempPath)

  // 1시간 TTL 클린업
  setTimeout(
    () => fs.rm(tmpDir, { recursive: true, force: true }, () => {}),
    60 * 60 * 1000
  )

  return NextResponse.json({ tempPath, deploymentId })
}
