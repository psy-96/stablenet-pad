'use client'

import { createClient } from '@supabase/supabase-js'

// 브라우저 전용 클라이언트 — NEXT_PUBLIC_ 접두사 변수만 사용
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
