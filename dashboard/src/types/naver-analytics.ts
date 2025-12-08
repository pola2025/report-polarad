/**
 * 네이버 플레이스 광고 분석 타입 정의
 */

// 일별 데이터
export interface NaverDailyData {
  date: string
  impressions: number
  clicks: number
  ctr: number
  avg_cpc: number
  total_cost: number
  avg_rank: number
  keyword_count: number
}

// 주별 데이터
export interface NaverWeeklyData {
  week_label: string // "2025-W49"
  week_start: string
  week_end: string
  impressions: number
  clicks: number
  ctr: number
  avg_cpc: number
  total_cost: number
  avg_rank: number
  keyword_count: number
  // 전주 대비
  impressions_change?: number
  clicks_change?: number
  cost_change?: number
}

// 월별 데이터
export interface NaverMonthlyData {
  month: string // "2025-12"
  month_label: string // "2025년 12월"
  impressions: number
  clicks: number
  ctr: number
  avg_cpc: number
  total_cost: number
  avg_rank: number
  keyword_count: number
  // 전월 대비
  impressions_change?: number
  clicks_change?: number
  cost_change?: number
  // 하위 데이터
  weeks?: NaverWeeklyData[]
  days?: NaverDailyData[]
}

// 키워드별 데이터
export interface NaverKeywordData {
  keyword: string
  impressions: number
  clicks: number
  ctr: number
  avg_cpc: number
  total_cost: number
  avg_rank: number
  days_count: number
  first_date: string
  last_date: string
}

// 키워드 일별 추이
export interface NaverKeywordDailyTrend {
  date: string
  keyword: string
  impressions: number
  clicks: number
  ctr: number
  avg_cpc: number
  total_cost: number
  avg_rank: number
}

// KPI 요약
export interface NaverKPISummary {
  total_impressions: number
  total_clicks: number
  total_cost: number
  avg_ctr: number
  avg_cpc: number
  avg_rank: number
  unique_keywords: number
  data_days: number
  date_range: {
    start: string
    end: string
  }
}

// 기간 비교
export interface NaverPeriodComparison {
  current: NaverKPISummary
  previous: NaverKPISummary
  changes: {
    impressions_percent: number
    clicks_percent: number
    cost_percent: number
    ctr_percent: number
    cpc_percent: number
  }
}

// 누적 데이터 응답
export interface NaverPeriodDataResponse {
  daily: NaverDailyData[]
  weekly: NaverWeeklyData[]
  monthly: NaverMonthlyData[]
  keywords: NaverKeywordData[]
  summary: NaverKPISummary
}
