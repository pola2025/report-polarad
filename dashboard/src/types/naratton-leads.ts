/**
 * 나라똔 리드관리 시스템 타입 정의
 */

// === 리드 상태 (12가지) ===
export type NarattonLeadStatus =
  | '심사준비'
  | '1차 심사 완료'
  | '2차 심사 완료'
  | '계약 완료'
  | '심사거절'
  | '보류'
  | 'DB 중복'
  | '제외'
  | '지속부재'
  | '신용점수 확인'
  | '사업자등록증요청'
  | '생각해보겠다'

// === 채널 ===
export type NarattonLeadChannel = 'homepage' | 'meta'

// === 리드 (통합 타입) ===
export interface NarattonLead {
  id: string               // Airtable record ID
  channel: NarattonLeadChannel
  table_id: string          // 원본 테이블 ID (업데이트 시 필요)
  // 공통 필드
  name: string
  phone: string
  email?: string
  created_at: string
  // 관리 필드
  status: NarattonLeadStatus
  assigned_staff: string
  notes: string
  blacklisted: boolean
  submission_count: number
  first_submission_date: string
  submission_history: string
  // 홈페이지 전용
  company_name?: string
  business_number?: string
  consultation_type?: string
  annual_revenue?: string
  employee_count?: string
  preferred_time?: string
  region?: string
  request_content?: string
  // Meta 전용
  no?: number
  platform?: string
  ad_name?: string
  business_type?: string
}

// === 담당자 ===
export interface NarattonStaff {
  id: string
  name: string
  slug?: string              // 자동생성 슬러그 (포털 URL용)
  email?: string             // 로그인용 이메일
  is_active: boolean
  totp_secret?: string       // (레거시) TOTP 시크릿
  setup_token?: string       // (레거시) 1회용 TOTP 설정 토큰
  activation_token?: string  // 텔레그램 봇 연결용 토큰
  telegram_chat_id?: string  // 개인 텔레그램 알림용
}

// === API 요약 ===
export interface NarattonLeadSummary {
  total: number
  today_new: number
  by_status: Record<NarattonLeadStatus, number>
  by_channel: Record<NarattonLeadChannel, number>
  conversion_rate: number   // 계약 완료 / 전체 * 100
  blacklisted: number
  duplicates: number
}

// === API 응답: 리드 목록 ===
export interface NarattonLeadsResponse {
  leads: NarattonLead[]
  summary: NarattonLeadSummary
  hasMore: boolean
  total: number
}

// === API 요청: 리드 업데이트 ===
export interface NarattonLeadUpdateRequest {
  status?: NarattonLeadStatus
  assigned_staff?: string
  blacklisted?: boolean
  table_id: string          // 어느 테이블인지 필수
}

// === API 요청: 메모 ===
export interface NarattonLeadNoteRequest {
  note: string
  author: string
  table_id: string
}

// === 상태 설정 (색상/라벨) ===
export interface StatusConfig {
  label: string
  color: string       // tailwind color name (e.g. 'blue')
  bg: string          // tailwind bg class
  text: string        // tailwind text class
  group: '진행중' | '완료' | '대기' | '종료'
}

export const STATUS_CONFIG: Record<NarattonLeadStatus, StatusConfig> = {
  '심사준비': { label: '심사준비', color: 'blue', bg: 'bg-blue-100', text: 'text-blue-700', group: '진행중' },
  '1차 심사 완료': { label: '1차 심사', color: 'sky', bg: 'bg-sky-100', text: 'text-sky-700', group: '진행중' },
  '2차 심사 완료': { label: '2차 심사', color: 'cyan', bg: 'bg-cyan-100', text: 'text-cyan-700', group: '진행중' },
  '계약 완료': { label: '계약 완료', color: 'green', bg: 'bg-green-100', text: 'text-green-700', group: '완료' },
  '심사거절': { label: '심사거절', color: 'red', bg: 'bg-red-100', text: 'text-red-700', group: '종료' },
  '보류': { label: '보류', color: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-700', group: '대기' },
  'DB 중복': { label: 'DB 중복', color: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', group: '종료' },
  '제외': { label: '제외', color: 'gray', bg: 'bg-gray-100', text: 'text-gray-700', group: '종료' },
  '지속부재': { label: '지속부재', color: 'slate', bg: 'bg-slate-100', text: 'text-slate-700', group: '대기' },
  '신용점수 확인': { label: '신용확인', color: 'purple', bg: 'bg-purple-100', text: 'text-purple-700', group: '대기' },
  '사업자등록증요청': { label: '사업자요청', color: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-700', group: '대기' },
  '생각해보겠다': { label: '생각해보겠다', color: 'amber', bg: 'bg-amber-100', text: 'text-amber-700', group: '대기' },
}

export const ALL_STATUSES: NarattonLeadStatus[] = [
  '심사준비', '1차 심사 완료', '2차 심사 완료', '계약 완료',
  '심사거절', '보류', 'DB 중복', '제외',
  '지속부재', '신용점수 확인', '사업자등록증요청', '생각해보겠다',
]
