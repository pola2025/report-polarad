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

// ─── CFO 위험신호 프레임워크 타입 ───

/** 5개 팩터 각각 0-100 (높을수록 위험) */
export interface AdRiskFactors {
  burnRate: number      // 지출 대비 리드 효율 위험도
  cplTrend: number      // CPL 추이 악화 정도
  pipeline: number      // 파이프라인 건강도 (WPV 기반)
  stability: number     // 리드 안정성
  fatigue: number       // 광고 피로도
}

/** 광고별 리스크 스코어 종합 */
export interface AdRiskScore {
  factors: AdRiskFactors
  compositeRisk: number           // 가중합산 0-100
  killSwitch: boolean             // 즉시 OFF 대상
  killSwitchReason?: string       // Kill Switch 사유
  metaAllocationShare: number     // Meta 예산 배분 비율 (0-1)
  wpv: number                     // Weighted Pipeline Value
  wpvEfficiency: number           // WPV / spend
}

/** WPV 가중치: 리드 상태별 파이프라인 가치 */
export const WPV_WEIGHTS: Record<string, number> = {
  '접수': 1,
  '부재': 1,
  '통화완료': 3,
  '수강등록': 10,
}

/** CFO 리스크 팩터 가중치 (합=1) */
export const CFO_RISK_WEIGHTS = {
  burnRate: 0.25,
  cplTrend: 0.25,
  pipeline: 0.20,
  stability: 0.15,
  fatigue: 0.15,
} as const

/** 목표 CPL (USD) */
export const TARGET_CPL = 20

/** Kill Switch 지출 임계값 (USD): target × 1.5 */
export const KILL_SWITCH_SPEND_THRESHOLD = 30
