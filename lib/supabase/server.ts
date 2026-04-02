import { createClient } from '@supabase/supabase-js'

// 서버 전용 클라이언트 — SUPABASE_SERVICE_ROLE_KEY는 절대 클라이언트에 노출 금지
// 이 파일은 app/api/ 내부에서만 import 할 것
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
