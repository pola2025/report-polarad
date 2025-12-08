/**
 * 통합 광고 분석 타입 정의
 * Meta + 네이버 광고 데이터 통합
 */

import type { NaverPeriodDataResponse } from './naver-analytics'

// 통합 요약 KPI
export interface IntegratedSummary {
  // 전체 합계
  total_spend_krw: number
  total_impressions: number
  total_clicks: number
  avg_ctr: number
  avg_cpc_krw: number

  // Meta 세부
  meta_spend_usd: number
  meta_spend_krw: number
  meta_impressions: number
  meta_clicks: number
  meta_leads: number
  meta_cpl_usd: number
  meta_cpl_krw: number

  // 네이버 세부
  naver_spend_krw: number
  naver_impressions: number
  naver_clicks: number
  naver_avg_rank: number

  // 채널별 비중
  channel_ratio: {
    meta_percent: number
    naver_percent: number
  }
}

// Meta 상세 데이터
export interface MetaDetailedData {
  summary: {
    spend_usd: number
    spend_krw: number
    impressions: number
    clicks: number
    ctr: number
    leads: number
    cpl_usd: number
    cpl_krw: number
    video_views?: number
  }
  daily: MetaDailyData[]
  campaigns?: MetaCampaignData[]
}

// Meta 일별 데이터
export interface MetaDailyData {
  date: string
  impressions: number
  clicks: number
  ctr: number
  spend_usd: number
  spend_krw: number
  leads: number
  cpl_usd: number
  cpl_krw: number
}

// Meta 캠페인별 데이터
export interface MetaCampaignData {
  campaign_name: string
  impressions: number
  clicks: number
  spend_usd: number
  spend_krw: number
  leads: number
}

// 일별 통합 데이터
export interface DailyCombinedData {
  date: string
  // Meta
  meta_impressions: number
  meta_clicks: number
  meta_spend_usd: number
  meta_spend_krw: number
  meta_leads: number
  // 네이버
  naver_impressions: number
  naver_clicks: number
  naver_spend: number
  // 합계
  total_impressions: number
  total_clicks: number
  total_spend_krw: number
}

// 채널 비교 데이터
export interface ChannelComparisonData {
  metric: string
  meta_value: number
  naver_value: number
  difference: number
  difference_percent: number
}

// 통합 분석 API 응답
export interface IntegratedAnalyticsResponse {
  success: boolean
  summary: IntegratedSummary
  meta: MetaDetailedData
  naver: NaverPeriodDataResponse
  daily_combined: DailyCombinedData[]
  comparison: ChannelComparisonData[]
  period: {
    start: string
    end: string
  }
  exchange_rate: number
}

// 이전 기간 비교 포함 통합 분석 응답
export interface IntegratedAnalyticsWithComparisonResponse extends IntegratedAnalyticsResponse {
  previous: {
    summary: IntegratedSummary
    daily_combined: DailyCombinedData[]
  }
  changes: {
    total_spend_percent: number
    total_impressions_percent: number
    total_clicks_percent: number
    avg_ctr_percent: number
    avg_cpc_percent: number
  }
}
