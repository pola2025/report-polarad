// 리포트 타입 정의

export type ReportType = 'monthly' | 'weekly'
export type ReportStatus = 'draft' | 'published' | 'archived'

// KPI 요약 데이터 구조
export interface ReportSummaryData {
  meta?: {
    impressions: number
    clicks: number
    leads: number
    spend: number
    ctr: number
    cpl: number
    videoViews?: number
    avgWatchTime?: number
    // 전월 대비
    prevPeriod?: {
      impressions: number
      clicks: number
      leads: number
      spend: number
    }
  }
  naver?: {
    impressions: number
    clicks: number
    totalCost: number
    ctr: number
    avgCpc: number
    avgRank: number
    // 전월 대비
    prevPeriod?: {
      impressions: number
      clicks: number
      totalCost: number
    }
  }
  total?: {
    spend: number
    leads: number
    cpl: number
  }
}

// AI 인사이트 구조
export interface ReportAIInsights {
  summary?: string
  highlights?: string[]
  metaAnalysis?: {
    overallGrade: 'A' | 'B' | 'C' | 'D'
    ctrAnalysis: string
    cpcAnalysis: string
    bestPerformance: string
    worstPerformance: string
  }
  naverAnalysis?: {
    overallGrade: 'A' | 'B' | 'C' | 'D'
    keywordInsight: string
    rankingAnalysis: string
    costEfficiency: string
  }
  weekdayInsight?: string
  nextMonthStrategy?: string
  // 주간 리포트용 추가 필드
  dailyInsights?: {
    day: string  // "월요일(11/10)" 형식
    note: string // 특이사항
  }[]
  weeklyComparison?: {
    summary: string  // 전주 대비 요약
    changes: {
      metric: string  // "노출", "클릭", "CTR" 등
      change: number  // 변화율 (%)
      direction: 'up' | 'down' | 'stable'
      note?: string   // 추가 설명
    }[]
  }
  recommendations?: {
    platform: 'meta' | 'naver'
    priority?: 'high' | 'medium' | 'low'
    type?: 'budget' | 'keyword' | 'creative' | 'targeting'
    title: string
    description: string
    expectedImpact?: string
  }[]
  generatedAt?: string
}

// 리포트 테이블 Row 타입
export interface Report {
  id: string
  client_id: string
  report_type: ReportType
  period_start: string
  period_end: string
  year: number
  month: number | null
  week: number | null
  status: ReportStatus
  published_at: string | null
  summary_data: ReportSummaryData | null
  ai_insights: ReportAIInsights | null
  ai_generated_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

// 리포트 Insert 타입
export interface ReportInsert {
  id?: string
  client_id: string
  report_type: ReportType
  period_start: string
  period_end: string
  year: number
  month?: number | null
  week?: number | null
  status?: ReportStatus
  published_at?: string | null
  summary_data?: ReportSummaryData | null
  ai_insights?: ReportAIInsights | null
  ai_generated_at?: string | null
  created_by?: string | null
}

// 리포트 Update 타입
export interface ReportUpdate {
  status?: ReportStatus
  published_at?: string | null
  summary_data?: ReportSummaryData | null
  ai_insights?: ReportAIInsights | null
  ai_generated_at?: string | null
  // 기간 필드 업데이트 지원
  period_start?: string
  period_end?: string
  year?: number
  month?: number | null
  week?: number | null
}

// 리포트 코멘트 Row 타입
export interface ReportComment {
  id: string
  report_id: string
  content: string
  content_html: string | null
  author_name: string
  author_role: string | null
  is_visible: boolean
  created_at: string
  updated_at: string
}

// 리포트 코멘트 Insert 타입
export interface ReportCommentInsert {
  id?: string
  report_id: string
  content: string
  content_html?: string | null
  author_name?: string
  author_role?: string | null
  is_visible?: boolean
}

// 리포트 코멘트 Update 타입
export interface ReportCommentUpdate {
  content?: string
  content_html?: string | null
  author_name?: string
  author_role?: string | null
  is_visible?: boolean
}

// API 응답용 타입 (리포트 + 코멘트 조인)
export interface ReportWithComment extends Report {
  comment?: ReportComment | null
  client?: {
    client_name: string
    slug: string | null
  }
}

// 월간 리포트 페이지용 전체 데이터 타입
export interface MonthlyReportData {
  report: ReportWithComment
  meta: {
    daily: Array<{
      date: string
      impressions: number
      clicks: number
      leads: number
      spend: number
      videoViews?: number
      avgWatchTime?: number
    }>
    campaigns: Array<{
      campaign_name: string
      impressions: number
      clicks: number
      leads: number
      spend: number
      ctr: number
      cpl: number
    }>
    videoViews?: number
    avgWatchTime?: number
  }
  naver: {
    keywords: Array<{
      keyword: string
      impressions: number
      clicks: number
      totalCost: number
      ctr: number
      avgCpc: number
      avgRank: number
    }>
  }
}
