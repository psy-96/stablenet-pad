export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { getTemplateById } from '@/lib/template-registry'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')

  if (!type) {
    return NextResponse.json({ error: '템플릿 유형을 지정해주세요' }, { status: 400 })
  }

  const template = getTemplateById(type)

  if (!template) {
    return NextResponse.json({ error: '지원하지 않는 템플릿 유형입니다' }, { status: 400 })
  }

  const templatePath = path.resolve(process.cwd(), template.solFile)

  try {
    await fs.promises.access(templatePath, fs.constants.R_OK)
  } catch {
    return NextResponse.json(
      { error: `${type} 템플릿 파일을 서버에서 찾을 수 없습니다` },
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
