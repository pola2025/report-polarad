/**
 * BAS 리드관리 Airtable CRUD
 *
 * Base: appdyFH6v4quVvF4z
 * Leads Table: tbl6p9tWbl5keMvrI
 * Staff Table: 환경변수 AIRTABLE_BAS_STAFF_TABLE_ID
 */

import type {
  BasLead,
  BasStaff,
  LeadStatus,
  BasLeadSummary,
  CampaignLeadStats,
} from '@/types/bas-leads'

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!
const BASE_ID = process.env.AIRTABLE_BAS_LEADS_BASE_ID || 'appdyFH6v4quVvF4z'
const LEADS_TABLE_ID = process.env.AIRTABLE_BAS_LEADS_TABLE_ID || 'tbl6p9tWbl5keMvrI'
const STAFF_TABLE_ID = process.env.AIRTABLE_BAS_STAFF_TABLE_ID || ''

const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`

const headers = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
}

// ===========================
// 전화번호 정규화
// ===========================
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

// ===========================
// Airtable 레코드 → BasLead 변환
// ===========================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecordToLead(record: any): BasLead {
  const f = record.fields
  return {
    id: record.id,
    name: f['이름'] || f['name'] || f['Name'] || '',
    phone: f['연락처'] || f['phone'] || f['Phone'] || '',
    email: f['이메일'] || f['email'] || f['Email'] || '',
    message: f['문의내용'] || f['message'] || '',
    created_at: f['접수일시'] || f['접수일'] || record.createdTime || '',
    // 관리 필드
    status: f['status'] || '접수',
    assigned_staff: f['assigned_staff'] || '',
    notes: f['notes'] || '',
    blacklisted: f['blacklisted'] || false,
    submission_count: f['submission_count'] || 1,
    first_submission_date: f['first_submission_date'] || record.createdTime || '',
    previous_status: f['previous_status'] || '',
    previous_staff: f['previous_staff'] || '',
    previous_date: f['previous_date'] || '',
    last_updated_by: f['last_updated_by'] || '',
    // 추적 필드
    submission_history: f['submission_history'] || '',
    campaign: f['campaign'] || '',
    ad_name: f['ad_name'] || '',
    platform: f['platform'] || '',
  }
}

// ===========================
// 리드 목록 조회
// ===========================
interface FetchLeadsOptions {
  status?: LeadStatus
  staff?: string
  blacklisted?: boolean
  search?: string
  duplicatesOnly?: boolean
  page?: number
  pageSize?: number
  sort?: 'newest' | 'oldest'
}

export async function fetchBasLeads(options: FetchLeadsOptions = {}): Promise<{
  leads: BasLead[]
  hasMore: boolean
  total: number
}> {
  const { status, staff, blacklisted, search, duplicatesOnly, page = 1, pageSize = 100, sort = 'newest' } = options

  // Airtable filterByFormula 구성
  const filters: string[] = []

  if (status) {
    filters.push(`{status}='${status}'`)
  }
  if (staff) {
    filters.push(`{assigned_staff}='${staff}'`)
  }
  if (blacklisted !== undefined) {
    filters.push(blacklisted ? `{blacklisted}=TRUE()` : `{blacklisted}!=TRUE()`)
  }
  if (duplicatesOnly) {
    filters.push(`{submission_count}>1`)
  }
  if (search) {
    // 이름 또는 연락처에서 검색
    filters.push(
      `OR(FIND('${search}',{이름})>0,FIND('${search}',{연락처})>0)`
    )
  }

  let formula = ''
  if (filters.length === 1) {
    formula = filters[0]
  } else if (filters.length > 1) {
    formula = `AND(${filters.join(',')})`
  }

  // 전체 레코드 가져오기 (페이지네이션)
  const allLeads: BasLead[] = []
  let offset: string | undefined

  do {
    const params = new URLSearchParams()
    if (formula) params.set('filterByFormula', formula)
    params.set('sort[0][field]', '접수일')
    params.set('sort[0][direction]', sort === 'newest' ? 'desc' : 'asc')
    if (offset) params.set('offset', offset)
    params.set('pageSize', '100')

    const url = `${BASE_URL}/${LEADS_TABLE_ID}?${params.toString()}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }, cache: 'no-store' })
    const data = await res.json()

    if (data.error) {
      console.error('fetchBasLeads error:', data.error)
      break
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leads = (data.records || []).map((r: any) => mapRecordToLead(r))
    allLeads.push(...leads)
    offset = data.offset
  } while (offset)

  const total = allLeads.length
  const start = (page - 1) * pageSize
  const paged = allLeads.slice(start, start + pageSize)

  return {
    leads: paged,
    hasMore: start + pageSize < total,
    total,
  }
}

// ===========================
// 리드 요약 계산
// ===========================
export async function getBasLeadSummary(): Promise<BasLeadSummary> {
  const { leads: allLeads } = await fetchBasLeads({ pageSize: 10000 })

  // KST 기준 오늘 날짜
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const today = nowKST.toISOString().split('T')[0]
  const todayNew = allLeads.filter(l => {
    if (!l.created_at) return false
    const kst = new Date(new Date(l.created_at).getTime() + 9 * 60 * 60 * 1000)
    return kst.toISOString().split('T')[0] === today
  }).length

  const byStatus: Record<LeadStatus, number> = {
    '접수': 0,
    '통화완료': 0,
    '부재': 0,
    '수강등록': 0,
  }
  let blacklisted = 0
  let duplicates = 0

  for (const lead of allLeads) {
    const s = lead.status as LeadStatus
    if (byStatus[s] !== undefined) {
      byStatus[s]++
    }
    if (lead.blacklisted) blacklisted++
    if (lead.submission_count > 1) duplicates++
  }

  const total = allLeads.length
  const conversionRate = total > 0 ? Math.round((byStatus['수강등록'] / total) * 1000) / 10 : 0

  // 캠페인별 통계
  const campaignMap = new Map<string, { total: number; by_status: Record<LeadStatus, number> }>()
  for (const lead of allLeads) {
    const campaign = lead.campaign || '(캠페인 미지정)'
    if (!campaignMap.has(campaign)) {
      campaignMap.set(campaign, {
        total: 0,
        by_status: { '접수': 0, '통화완료': 0, '부재': 0, '수강등록': 0 },
      })
    }
    const entry = campaignMap.get(campaign)!
    entry.total++
    const s = lead.status as LeadStatus
    if (entry.by_status[s] !== undefined) {
      entry.by_status[s]++
    }
  }

  const byCampaign: CampaignLeadStats[] = Array.from(campaignMap.entries())
    .map(([campaign, data]) => ({
      campaign,
      total: data.total,
      by_status: data.by_status,
      conversion_rate: data.total > 0
        ? Math.round((data.by_status['수강등록'] / data.total) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    total,
    today_new: todayNew,
    by_status: byStatus,
    conversion_rate: conversionRate,
    blacklisted,
    duplicates,
    by_campaign: byCampaign,
  }
}

// ===========================
// 단일 리드 조회
// ===========================
export async function getBasLead(recordId: string): Promise<BasLead | null> {
  const url = `${BASE_URL}/${LEADS_TABLE_ID}/${recordId}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }, cache: 'no-store' })
  const data = await res.json()

  if (data.error) {
    console.error('getBasLead error:', data.error)
    return null
  }

  return mapRecordToLead(data)
}

// ===========================
// 리드 업데이트 (상태, 담당자, 블랙리스트)
// ===========================
export async function updateBasLead(
  recordId: string,
  updates: {
    status?: LeadStatus
    assigned_staff?: string
    blacklisted?: boolean
    last_updated_by?: string
    // 재접수 이력 저장
    previous_status?: string
    previous_staff?: string
    previous_date?: string
    submission_count?: number
  }
): Promise<BasLead | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {}

  if (updates.status !== undefined) fields['status'] = updates.status
  if (updates.assigned_staff !== undefined) fields['assigned_staff'] = updates.assigned_staff
  if (updates.blacklisted !== undefined) fields['blacklisted'] = updates.blacklisted
  if (updates.last_updated_by !== undefined) fields['last_updated_by'] = updates.last_updated_by
  if (updates.previous_status !== undefined) fields['previous_status'] = updates.previous_status
  if (updates.previous_staff !== undefined) fields['previous_staff'] = updates.previous_staff
  if (updates.previous_date !== undefined) fields['previous_date'] = updates.previous_date
  if (updates.submission_count !== undefined) fields['submission_count'] = updates.submission_count

  const url = `${BASE_URL}/${LEADS_TABLE_ID}/${recordId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  })
  const data = await res.json()

  if (data.error) {
    console.error('updateBasLead error:', data.error)
    return null
  }

  return mapRecordToLead(data)
}

// ===========================
// 메모 추가 (누적 append)
// ===========================
export async function addBasLeadNote(
  recordId: string,
  note: string,
  author: string
): Promise<BasLead | null> {
  // 현재 메모 조회
  const current = await getBasLead(recordId)
  if (!current) return null

  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const newNote = `[${timestamp}] ${author}: ${note}`
  const updatedNotes = current.notes ? `${newNote}\n${current.notes}` : newNote

  const url = `${BASE_URL}/${LEADS_TABLE_ID}/${recordId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      fields: {
        notes: updatedNotes,
        last_updated_by: author,
      },
    }),
  })
  const data = await res.json()

  if (data.error) {
    console.error('addBasLeadNote error:', data.error)
    return null
  }

  return mapRecordToLead(data)
}

// ===========================
// 메모 수정 (인덱스 기반)
// ===========================
export async function updateBasLeadNote(
  recordId: string,
  noteIndex: number,
  newContent: string,
  author: string
): Promise<BasLead | null> {
  const current = await getBasLead(recordId)
  if (!current || !current.notes) return null

  const lines = current.notes.split('\n').filter(Boolean)
  if (noteIndex < 0 || noteIndex >= lines.length) return null

  // 타임스탬프 보존, 내용만 교체: [2026-01-31 14:00] 작성자: 새내용
  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  lines[noteIndex] = `[${timestamp}] ${author}: ${newContent} (수정됨)`

  const url = `${BASE_URL}/${LEADS_TABLE_ID}/${recordId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      fields: { notes: lines.join('\n'), last_updated_by: author },
    }),
  })
  const data = await res.json()
  if (data.error) {
    console.error('updateBasLeadNote error:', data.error)
    return null
  }
  return mapRecordToLead(data)
}

// ===========================
// 메모 삭제 (인덱스 기반)
// ===========================
export async function deleteBasLeadNote(
  recordId: string,
  noteIndex: number
): Promise<BasLead | null> {
  const current = await getBasLead(recordId)
  if (!current || !current.notes) return null

  const lines = current.notes.split('\n').filter(Boolean)
  if (noteIndex < 0 || noteIndex >= lines.length) return null

  lines.splice(noteIndex, 1)

  const url = `${BASE_URL}/${LEADS_TABLE_ID}/${recordId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      fields: { notes: lines.join('\n') },
    }),
  })
  const data = await res.json()
  if (data.error) {
    console.error('deleteBasLeadNote error:', data.error)
    return null
  }
  return mapRecordToLead(data)
}

// ===========================
// 중복 리드 검색 (같은 전화번호)
// ===========================
export async function findDuplicateLeads(phone: string): Promise<BasLead[]> {
  const normalized = normalizePhone(phone)
  if (!normalized) return []

  const params = new URLSearchParams()
  params.set('filterByFormula', `FIND('${normalized}',SUBSTITUTE({연락처},"-",""))>0`)
  params.set('sort[0][field]', '접수일')
  params.set('sort[0][direction]', 'desc')

  const url = `${BASE_URL}/${LEADS_TABLE_ID}?${params.toString()}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }, cache: 'no-store' })
  const data = await res.json()

  if (data.error) {
    console.error('findDuplicateLeads error:', data.error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.records || []).map((r: any) => mapRecordToLead(r))
}

// ===========================
// Staff CRUD
// ===========================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecordToStaff(record: any): BasStaff {
  const f = record.fields
  return {
    id: record.id,
    name: f['name'] || f['Name'] || '',
    is_active: f['is_active'] ?? true,
  }
}

export async function fetchBasStaff(): Promise<BasStaff[]> {
  if (!STAFF_TABLE_ID) {
    console.warn('AIRTABLE_BAS_STAFF_TABLE_ID not set')
    return []
  }

  const url = `${BASE_URL}/${STAFF_TABLE_ID}?sort[0][field]=name&sort[0][direction]=asc`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }, cache: 'no-store' })
  const data = await res.json()

  if (data.error) {
    console.error('fetchBasStaff error:', data.error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.records || []).map((r: any) => mapRecordToStaff(r))
}

export async function createBasStaff(name: string): Promise<BasStaff | null> {
  if (!STAFF_TABLE_ID) return null

  const url = `${BASE_URL}/${STAFF_TABLE_ID}`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fields: { name, is_active: true },
    }),
  })
  const data = await res.json()

  if (data.error) {
    console.error('createBasStaff error:', data.error)
    return null
  }

  return mapRecordToStaff(data)
}

// ===========================
// 리드 생성 (Webhook용)
// ===========================
export async function createBasLead(fields: {
  name: string
  phone: string
  email?: string
  message?: string
  created_at?: string
}): Promise<BasLead | null> {
  const nowFull = new Date().toISOString()
  const submittedAt = fields.created_at || nowFull
  const submittedDate = submittedAt.split('T')[0]

  const url = `${BASE_URL}/${LEADS_TABLE_ID}`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fields: {
        '이름': fields.name,
        '연락처': fields.phone,
        '이메일': fields.email || '',
        '문의내용': fields.message || '',
        '접수일': submittedDate,
        '접수일시': submittedAt,
        status: '접수',
        submission_count: 1,
        first_submission_date: submittedDate,
      },
    }),
  })
  const data = await res.json()

  if (data.error) {
    console.error('createBasLead error:', data.error)
    return null
  }

  return mapRecordToLead(data)
}

export async function updateBasStaff(
  recordId: string,
  updates: { name?: string; is_active?: boolean }
): Promise<BasStaff | null> {
  if (!STAFF_TABLE_ID) return null

  const url = `${BASE_URL}/${STAFF_TABLE_ID}/${recordId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: updates }),
  })
  const data = await res.json()

  if (data.error) {
    console.error('updateBasStaff error:', data.error)
    return null
  }

  return mapRecordToStaff(data)
}

export async function deleteBasStaff(recordId: string): Promise<boolean> {
  if (!STAFF_TABLE_ID) return false

  const url = `${BASE_URL}/${STAFF_TABLE_ID}/${recordId}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers,
  })
  const data = await res.json()

  if (data.error) {
    console.error('deleteBasStaff error:', data.error)
    return false
  }

  return true
}
