export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: current, error: fetchError } = await supabaseServer
    .from('deployments')
    .select('pinned')
    .eq('id', id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const newPinned = !(current.pinned as boolean | null ?? false)

  const { error: updateError } = await supabaseServer
    .from('deployments')
    .update({ pinned: newPinned })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ pinned: newPinned })
}
