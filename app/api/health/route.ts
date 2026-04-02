export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET() {
  const { error } = await supabaseServer
    .from('deployments')
    .select('count')
    .limit(1)

  if (error) {
    return NextResponse.json(
      { error: `Supabase 연결 실패: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ status: 'ok' })
}
