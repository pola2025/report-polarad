import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key
export function createServerClient() {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseServiceKey)
}

// 테이블명 상수 (polarad_ 접두사로 BAS-Meta와 분리)
export const TABLES = {
  CLIENTS: 'polarad_clients',
  META_DATA: 'polarad_meta_data',
  NAVER_DATA: 'polarad_naver_data',
  KEYWORD_STATS: 'polarad_keyword_stats',
  REPORTS: 'polarad_reports',
  REPORT_COMMENTS: 'polarad_report_comments',
} as const

// 타입 정의
export interface PolaradClient {
  id: string
  client_id: string
  client_name: string
  slug: string | null
  meta_ad_account_id: string | null
  meta_access_token: string | null
  token_expires_at: string | null
  auth_status: 'pending' | 'active' | 'expired' | 'error'
  is_active: boolean
  telegram_chat_id: string | null
  telegram_enabled: boolean
  service_start_date: string | null
  service_end_date: string | null
  created_at: string
  updated_at: string
}

export interface PolaradMetaData {
  id: number
  client_id: string
  date: string
  ad_id: string
  ad_name: string | null
  campaign_id: string | null
  campaign_name: string | null
  platform: 'facebook' | 'instagram' | null
  device: 'mobile' | 'desktop' | null
  impressions: number
  clicks: number
  leads: number
  spend: number
  video_views: number
  avg_watch_time: number
  currency: string
  created_at: string
}
