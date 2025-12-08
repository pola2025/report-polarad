// Environment variables interface
export interface Env {
  // Supabase
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string

  // Meta API
  META_APP_ID: string
  META_APP_SECRET: string
  META_ACCESS_TOKEN: string
  META_AD_ACCOUNT_ID: string

  // Telegram
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_ADMIN_CHAT_ID: string
  TELEGRAM_ERROR_CHAT_ID: string

  // Environment
  ENVIRONMENT?: string
}

// Date range interface
export interface DateRange {
  start: string
  end: string
}

// Daily Aggregate 데이터 구조
export interface DailyAggregate {
  client_id: string
  date: string
  ad_id: string
  ad_name: string
  campaign_id: string
  campaign_name: string
  platform: string
  device: string
  impressions: number
  clicks: number
  spend: number
  leads: number
  video_views: number
  avg_watch_time: number
  currency: string
}

// Weekly summary interface
export interface WeeklySummary {
  impressions: number
  clicks: number
  leads: number
  spend: number
  ctr: number
  cpl: number
}

// Client info interface
export interface ClientInfo {
  id: string
  client_name: string
  meta_ad_account_id: string
  encrypted_access_token: string
  telegram_chat_id: string | null
  telegram_enabled: boolean
}
