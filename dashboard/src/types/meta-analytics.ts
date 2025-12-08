/**
 * Meta 광고 분석 타입 정의
 */

// 일별 데이터
export interface MetaDailyData {
  date: string
  impressions: number
  clicks: number
  ctr: number
  spend: number // USD
  spend_krw: number // KRW
  leads: number
  cpl: number // Cost Per Lead (USD)
  cpl_krw: number // Cost Per Lead (KRW)
  video_views: number
  avg_watch_time: number
}

// 주별 데이터
export interface MetaWeeklyData {
  week_label: string // "2025-W49"
  week_start: string
  week_end: string
  impressions: number
  clicks: number
  ctr: number
  spend: number
  spend_krw: number
  leads: number
  cpl: number
  cpl_krw: number
  video_views: number
  // 전주 대비
  impressions_change?: number
  clicks_change?: number
  spend_change?: number
  leads_change?: number
}

// 월별 데이터
export interface MetaMonthlyData {
  month: string // "2025-12"
  month_label: string // "2025년 12월"
  impressions: number
  clicks: number
  ctr: number
  spend: number
  spend_krw: number
  leads: number
  cpl: number
  cpl_krw: number
  video_views: number
  avg_watch_time?: number // 평균 시청 시간 (초)
  // 전월 대비
  impressions_change?: number
  clicks_change?: number
  spend_change?: number
  leads_change?: number
  // 하위 데이터
  weeks?: MetaWeeklyData[]
  days?: MetaDailyData[]
}

// 캠페인별 데이터
export interface MetaCampaignData {
  campaign_id: string
  campaign_name: string
  impressions: number
  clicks: number
  ctr: number
  spend: number
  spend_krw: number
  leads: number
  cpl: number
  cpl_krw: number
  days_count: number
  first_date: string
  last_date: string
}

// 광고별 데이터
export interface MetaAdData {
  ad_id: string
  ad_name: string
  campaign_name: string | null
  impressions: number
  clicks: number
  ctr: number
  spend: number
  spend_krw: number
  leads: number
  cpl: number
  cpl_krw: number
  video_views: number
  days_count: number
  first_date: string
  last_date: string
}

// KPI 요약
export interface MetaKPISummary {
  total_impressions: number
  total_clicks: number
  total_spend: number // USD
  total_spend_krw: number // KRW
  total_leads: number
  avg_ctr: number
  avg_cpl: number // USD
  avg_cpl_krw: number // KRW
  total_video_views: number
  unique_campaigns: number
  unique_ads: number
  data_days: number
  date_range: {
    start: string
    end: string
  }
}

// 기간 비교
export interface MetaPeriodComparison {
  current: MetaKPISummary
  previous: MetaKPISummary
  changes: {
    impressions_percent: number
    clicks_percent: number
    spend_percent: number
    leads_percent: number
    ctr_percent: number
    cpl_percent: number
  }
}

// 누적 데이터 응답
export interface MetaPeriodDataResponse {
  daily: MetaDailyData[]
  weekly: MetaWeeklyData[]
  monthly: MetaMonthlyData[]
  campaigns: MetaCampaignData[]
  ads: MetaAdData[]
  summary: MetaKPISummary
}
