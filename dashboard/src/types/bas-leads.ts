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
}

// === 담당자 ===
export interface BasStaff {
  id: string               // Airtable record ID
  name: string
  is_active: boolean
}

// === API 요약 ===
export interface BasLeadSummary {
  total: number
  today_new: number
  by_status: Record<LeadStatus, number>
  conversion_rate: number   // 수강등록 / 전체 * 100
  blacklisted: number
  duplicates: number        // submission_count > 1 건수
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
