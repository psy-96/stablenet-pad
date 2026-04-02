export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import os from 'os'
import path from 'path'
import fs from 'fs'

const MAX_FILE_SIZE = 1024 * 1024 // 1MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    }

    const f = file as File

    if (!f.name.endsWith('.sol')) {
      return NextResponse.json({ error: '.sol 파일만 허용됩니다' }, { status: 400 })
    }

    if (f.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일 크기가 1MB를 초과합니다 (${(f.size / 1024).toFixed(0)}KB)` },
        { status: 400 }
      )
    }

    const deploymentId = randomUUID()
    const tmpDir = path.join(os.tmpdir(), 'contracts', deploymentId)
    await fs.promises.mkdir(tmpDir, { recursive: true })

    const tempPath = path.join(tmpDir, f.name)
    const buffer = Buffer.from(await f.arrayBuffer())
    await fs.promises.writeFile(tempPath, buffer)

    // 1시간 TTL 클린업
    setTimeout(
      () => fs.rm(tmpDir, { recursive: true, force: true }, () => {}),
      60 * 60 * 1000
    )

    return NextResponse.json({ tempPath, deploymentId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '업로드 실패' },
      { status: 500 }
    )
  }
}
