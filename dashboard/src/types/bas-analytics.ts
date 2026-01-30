/**
 * BAS 전용 분석 타입 정의
 * polarad-meta의 MetaPeriodDataResponse 기반
 * clientSlug === 'bas' 일 때만 사용
 */

import type {
  MetaKPISummary,
  MetaDailyData,
  MetaWeeklyData,
  MetaMonthlyData,
  MetaAdData,
} from './meta-analytics'

// BAS 대시보드 데이터 (통합)
export interface BasDashboardData {
  summary: MetaKPISummary
  daily: MetaDailyData[]
  weekly: MetaWeeklyData[]
  monthly: MetaMonthlyData[]
  ads: MetaAdData[]
  // 계산된 스파크라인 데이터
  sparklineData: {
    leads: number[]
    spend: number[]
    cpl: number[]
    ctr: number[]
  }
  // 비교 데이터
  comparisonSummary: MetaKPISummary | null
  comparisonPeriod: {
    current: string
    previous: string
  } | null
}

// CPL 상태 유틸리티
export type CplStatus = 'excellent' | 'good' | 'warning' | 'danger'

export function getCplStatus(cpl: number): CplStatus {
  if (cpl <= 15) return 'excellent'
  if (cpl <= 20) return 'good'
  if (cpl <= 35) return 'warning'
  return 'danger'
}

export function getCplStatusColor(status: CplStatus): string {
  switch (status) {
    case 'excellent': return 'text-emerald-600'
    case 'good': return 'text-green-600'
    case 'warning': return 'text-amber-600'
    case 'danger': return 'text-red-600'
  }
}

export function getCplStatusBgColor(status: CplStatus): string {
  switch (status) {
    case 'excellent': return 'bg-emerald-50'
    case 'good': return 'bg-green-50'
    case 'warning': return 'bg-amber-50'
    case 'danger': return 'bg-red-50'
  }
}
