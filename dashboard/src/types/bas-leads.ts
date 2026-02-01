/**
 * BAS 리드관리 시스템 타입 정의
 */

// === 리드 상태 ===
export type LeadStatus = '접수' | '통화완료' | '부재' | '수강등록'

// === 리드 (Airtable 레코드 기반) ===
export interface BasLead {
  id: string               // Airtable record ID
  name: string             // 이름
  phone: string            // 전화번호
  email?: string           // 이메일 (선택)
  message?: string         // 문의 내용
  created_at: string       // Airtable 생성일 (접수일)
  // 관리 필드
  status: LeadStatus
  assigned_staff: string
  notes: string            // 타임스탬프 메모 누적
  blacklisted: boolean
  submission_count: number  // 접수 횟수
  first_submission_date: string
  previous_status: string
  previous_staff: string
  previous_date: string
  last_updated_by: string
  // 추적 필드
  submission_history: string   // "1차: 2026-01-15\n2차: 2026-01-30"
  campaign: string             // 캠페인명
  ad_name: string              // 광고명
  platform: string             // fb / ig
}

// === 담당자 ===
export interface BasStaff {
  id: string               // Airtable record ID
  name: string
  is_active: boolean
}

// === 캠페인별 리드 통계 ===
export interface CampaignLeadStats {
  campaign: string
  total: number
  by_status: Record<LeadStatus, number>
  conversion_rate: number   // 수강등록 / total * 100
}

// === API 요약 ===
export interface BasLeadSummary {
  total: number
  today_new: number
  by_status: Record<LeadStatus, number>
  conversion_rate: number   // 수강등록 / 전체 * 100
  blacklisted: number
  duplicates: number        // submission_count > 1 건수
  by_campaign: CampaignLeadStats[]
}

// === 일별 접수 추이 ===
export interface DailyLeadCount {
  date: string           // YYYY-MM-DD
  count: number
  by_status: Record<LeadStatus, number>
}

// === 주간 변화율 ===
export interface WeeklyChange {
  current_week: number   // 이번 주 접수량
  previous_week: number  // 지난 주 접수량
  change_rate: number    // 변화율 % (양수=증가, 음수=감소)
}

// === 캠페인 성과 (확장) ===
export interface CampaignPerformance {
  campaign: string
  total: number
  by_status: Record<LeadStatus, number>
  conversion_rate: number       // 수강등록 전환율 %
  call_rate: number             // 통화완료율 %
  recent_7d: number             // 최근 7일 접수량
  trend: 'up' | 'down' | 'flat' // 최근 추세
}

// === 리드 트렌드 API 응답 ===
export interface BasLeadTrends {
  daily: DailyLeadCount[]             // 최근 30일 일별 데이터
  weekly_change: WeeklyChange         // 주간 변화율
  monthly_change: WeeklyChange        // 월간 변화율 (같은 구조 재활용)
  campaigns: CampaignPerformance[]    // 캠페인 성과
  total_valid: number                 // 유효 리드 (비블랙리스트)
  avg_daily: number                   // 일평균 접수량 (최근 30일)
}

// === API 응답: 리드 목록 ===
export interface BasLeadsResponse {
  leads: BasLead[]
  summary: BasLeadSummary
  hasMore: boolean
  total: number
}

// === API 요청: 리드 업데이트 ===
export interface BasLeadUpdateRequest {
  status?: LeadStatus
  assigned_staff?: string
  blacklisted?: boolean
  last_updated_by?: string
}

// === API 요청: 메모 추가 ===
export interface BasLeadNoteRequest {
  note: string
  author: string
}

// === API 요청: 담당자 생성 ===
export interface BasStaffCreateRequest {
  name: string
}

// === API 응답: 담당자 목록 ===
export interface BasStaffResponse {
  staff: BasStaff[]
}
