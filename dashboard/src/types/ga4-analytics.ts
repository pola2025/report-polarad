/**
 * GA4 Analytics 타입 정의
 */

// GA4 일별 데이터
export interface GA4DailyData {
  date: string
  sessions: number
  users: number
  newUsers: number
  pageviews: number
  bounceRate: number
  avgSessionDuration: number
  conversions: number
  conversionRate: number
}

// GA4 주별 데이터
export interface GA4WeeklyData {
  weekStart: string
  weekEnd: string
  weekLabel: string
  sessions: number
  users: number
  newUsers: number
  pageviews: number
  bounceRate: number
  avgSessionDuration: number
  conversions: number
}

// GA4 월별 데이터
export interface GA4MonthlyData {
  month: string
  monthLabel: string
  sessions: number
  users: number
  newUsers: number
  pageviews: number
  bounceRate: number
  avgSessionDuration: number
  conversions: number
}

// 소스/매체 데이터
export interface GA4SourceMedium {
  source: string
  medium: string
  sourceMedium: string
  sessions: number
  users: number
  newUsers: number
  conversions: number
  bounceRate: number
}

// 랜딩페이지 데이터
export interface GA4LandingPage {
  pagePath: string
  pageTitle: string
  sessions: number
  users: number
  bounceRate: number
  avgSessionDuration: number
}

// 검색어 데이터
export interface GA4SearchTerm {
  searchTerm: string
  sessions: number
  users: number
}

// GA4 요약 데이터
export interface GA4Summary {
  totalSessions: number
  totalUsers: number
  totalNewUsers: number
  totalPageviews: number
  avgBounceRate: number
  avgSessionDuration: number
  totalConversions: number
  avgConversionRate: number
  dateRange: {
    start: string
    end: string
  }
}

// 기간 비교 데이터
export interface GA4Comparison {
  current: GA4Summary
  previous: GA4Summary
  changes: {
    sessions: number
    users: number
    newUsers: number
    pageviews: number
    bounceRate: number
    sessionDuration: number
    conversions: number
  }
}

// GA4 Analytics API 응답
export interface GA4AnalyticsResponse {
  success: boolean
  data?: {
    daily: GA4DailyData[]
    weekly: GA4WeeklyData[]
    monthly: GA4MonthlyData[]
    sources: GA4SourceMedium[]
    landingPages: GA4LandingPage[]
    searchTerms: GA4SearchTerm[]
    summary: GA4Summary
    comparison: GA4Comparison
  }
  error?: string
}

// Airtable GA4 레코드
export interface AirtableGA4DailyRecord {
  id?: string
  date: string
  sessions: number
  users: number
  new_users: number
  pageviews: number
  bounce_rate: number
  avg_session_duration: number
  conversions: number
  synced_at: string
}

export interface AirtableGA4SourceRecord {
  id?: string
  period_start: string
  period_end: string
  source: string
  medium: string
  sessions: number
  users: number
  conversions: number
  synced_at: string
}

// GA4 Service Account 자격 증명
export interface GA4Credentials {
  client_email: string
  private_key: string
}

// 불릿 차트 데이터
export interface BulletChartData {
  label: string
  current: number
  previous: number
  target?: number
  format?: 'number' | 'percent' | 'currency' | 'duration'
}

// 트리맵 데이터
export interface TreemapData {
  name: string
  value: number
  sessions?: number
  users?: number
  conversions?: number
  children?: TreemapData[]
}

// GA4 이벤트 데이터 (폼 제출 등)
export interface GA4EventData {
  date: string
  eventName: string
  eventCount: number
  sessions: number
  users: number
  sourceMedium?: string
}

// GA4 이벤트 요약
export interface GA4EventSummary {
  eventName: string
  totalEvents: number
  totalSessions: number
  totalUsers: number
  conversionRate: number
  dateRange: {
    start: string
    end: string
  }
}

// GA4 이벤트 소스별 데이터
export interface GA4EventBySource {
  sourceMedium: string
  eventCount: number
  sessions: number
  users: number
  conversionRate: number
}

// GA4 이벤트 API 응답
export interface GA4EventsResponse {
  success: boolean
  data?: {
    daily: GA4EventData[]
    bySource: GA4EventBySource[]
    summary: GA4EventSummary
  }
  error?: string
}

// 마케팅 퍼널 단계
export interface FunnelStage {
  name: string
  metric: string
  value: number
  rate: number
  color?: string
}

// 퍼널 전환율
export interface FunnelConversionRates {
  visitToSubmit: number
  submitToLead: number
  overallConversion: number
}

// 채널별 퍼널 데이터
export interface ChannelFunnelData {
  channel: string
  users: number
  sessions: number
  submissions: number
  leads: number
  spend: number
  cpl: number | null
  conversionRate: number
}

// 퍼널 일별 추이
export interface FunnelDailyTrend {
  date: string
  users: number
  sessions: number
  submissions: number
  leads: number
}

// 상관관계 데이터
export interface CorrelationData {
  sessionsVsSubmissions: number
  submissionsVsLeads: number
  spendVsLeads: number
}

// 퍼널 분석 API 응답
export interface FunnelAnalysisResponse {
  success: boolean
  data?: {
    funnel: {
      stages: FunnelStage[]
      conversionRates: FunnelConversionRates
    }
    trend: {
      daily: FunnelDailyTrend[]
    }
    correlation: CorrelationData
    byChannel: ChannelFunnelData[]
  }
  error?: string
}
