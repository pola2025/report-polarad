import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 매 요청마다 새 클라이언트 생성 (서버리스 환경에서 캐시 문제 방지)
export function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// 기존 코드 호환성을 위한 export
export { getSupabaseAdmin as supabaseAdmin }
