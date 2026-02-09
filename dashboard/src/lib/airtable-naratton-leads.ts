/**
 * 나라똔 리드관리 Airtable CRUD
 *
 * Base: appNSHE8lXo0RTG0b
 * 홈페이지 리드: tbl7PO9zfoxfDsDA2 (나라똔_상담접수)
 * Meta 리드: tblPpgdyxAa7IupGV (고객정보)
 * Staff: 환경변수 AIRTABLE_NARATTON_STAFF_TABLE_ID
 */

import type {
  NarattonLead,
  NarattonStaff,
  NarattonLeadStatus,
  NarattonLeadSummary,
  NarattonLeadChannel,
} from '@/types/naratton-leads'
import { ALL_STATUSES } from '@/types/naratton-leads'

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!
const BASE_ID = process.env.AIRTABLE_NARATTON_LEADS_BASE_ID || 'appNSHE8lXo0RTG0b'
const HOMEPAGE_TABLE_ID = process.env.AIRTABLE_NARATTON_HOMEPAGE_TABLE_ID || 'tbl7PO9zfoxfDsDA2'
const META_TABLE_ID = process.env.AIRTABLE_NARATTON_META_LEADS_TABLE_ID || 'tblPpgdyxAa7IupGV'
const STAFF_TABLE_ID = process.env.AIRTABLE_NARATTON_STAFF_TABLE_ID || ''

const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`

const headers = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
}

// ===========================
// Airtable formula 이스케이프 (인젝션 방어)
// ===========================
function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// ===========================
// 전화번호 정규화
// ===========================
export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '')
  // +82 → 0 변환
  if (normalized.startsWith('82') && normalized.length >= 10) {
    normalized = '0' + normalized.slice(2)
  }
  return normalized
}

// ===========================
// 홈페이지 레코드 → NarattonLead 변환
// ===========================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHomepageRecord(record: any): NarattonLead {
  const f = record.fields
  return {
    id: record.id,
    channel: 'homepage',
    table_id: HOMEPAGE_TABLE_ID,
    name: f['이름'] || '',
    phone: f['연락처'] || '',
    email: f['이메일'] || '',
    created_at: f['접수일시'] || record.createdTime || '',
    status: f['status'] || '심사준비',
    assigned_staff: f['assigned_staff'] || '',
    notes: f['notes'] || '',
    blacklisted: f['blacklisted'] || false,
    submission_count: f['submission_count'] || 1,
    first_submission_date: f['first_submission_date'] || record.createdTime || '',
    submission_history: f['submission_history'] || '',
    // 홈페이지 전용
    company_name: f['회사명'] || '',
    business_number: f['사업자번호'] || '',
    consultation_type: f['상담유형'] || '',
    annual_revenue: f['연매출'] || '',
    employee_count: f['직원수'] || '',
    preferred_time: f['희망시간'] || '',
    region: f['지역'] || '',
    request_content: f['요청내용'] || '',
  }
}

// ===========================
// Meta 레코드 → NarattonLead 변환
// ===========================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMetaRecord(record: any): NarattonLead {
  const f = record.fields
  return {
    id: record.id,
    channel: 'meta',
    table_id: META_TABLE_ID,
    name: f['이름'] || '',
    phone: f['연락처'] || '',
    email: '',
    created_at: record.createdTime || '',
    status: f['status'] || '심사준비',
    assigned_staff: f['assigned_staff'] || '',
    notes: f['notes'] || '',
    blacklisted: f['blacklisted'] || false,
    submission_count: f['submission_count'] || 1,
    first_submission_date: f['first_submission_date'] || record.createdTime || '',
    submission_history: f['submission_history'] || '',
    // Meta 전용
    no: f['no'] || undefined,
    platform: f['플랫폼'] || '',
    ad_name: f['광고명'] || '',
    region: f['지역'] || '',
    business_type: f['사업자종류'] || '',
  }
}

// ===========================
// 단일 테이블 전체 레코드 조회
// ===========================
async function fetchAllFromTable(
  tableId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapFn: (record: any) => NarattonLead,
  filterFormula?: string,
): Promise<NarattonLead[]> {
  const allLeads: NarattonLead[] = []
  let offset: string | undefined

  do {
    const params = new URLSearchParams()
    if (filterFormula) params.set('filterByFormula', filterFormula)
    if (offset) params.set('offset', offset)
    params.set('pageSize', '100')

    const url = `${BASE_URL}/${tableId}?${params.toString()}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      cache: 'no-store',
    })
    const data = await res.json()

    if (data.error) {
      console.error(`fetchAllFromTable ${tableId} error:`, data.error)
      break
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leads = (data.records || []).map((r: any) => mapFn(r))
    allLeads.push(...leads)
    offset = data.offset
  } while (offset)

  return allLeads
}

// ===========================
// 리드 목록 조회 (2테이블 병합)
// ===========================
interface FetchNarattonLeadsOptions {
  channel?: NarattonLeadChannel
  status?: NarattonLeadStatus
  staff?: string
  blacklisted?: boolean
  search?: string
  duplicatesOnly?: boolean
  page?: number
  pageSize?: number
  sort?: 'newest' | 'oldest'
}

export async function fetchNarattonLeads(options: FetchNarattonLeadsOptions = {}): Promise<{
  leads: NarattonLead[]
  hasMore: boolean
  total: number
}> {
  const { channel, status, staff, blacklisted, search, duplicatesOnly, page = 1, pageSize = 100, sort = 'newest' } = options

  // Airtable filterByFormula 구성 (인젝션 방어 적용)
  const filters: string[] = []

  if (status) {
    if (!(ALL_STATUSES as readonly string[]).includes(status)) {
      return { leads: [], hasMore: false, total: 0 }
    }
    filters.push(`{status}='${escapeFormulaValue(status)}'`)
  }
  if (staff) {
    filters.push(`{assigned_staff}='${escapeFormulaValue(staff)}'`)
  }
  if (blacklisted !== undefined) {
    filters.push(blacklisted ? `{blacklisted}=TRUE()` : `{blacklisted}!=TRUE()`)
  }
  if (duplicatesOnly) {
    filters.push(`{submission_count}>1`)
  }
  if (search) {
    const sanitized = escapeFormulaValue(search.slice(0, 50))
    filters.push(
      `OR(FIND('${sanitized}',{이름})>0,FIND('${sanitized}',{연락처})>0)`
    )
  }

  let formula = ''
  if (filters.length === 1) {
    formula = filters[0]
  } else if (filters.length > 1) {
    formula = `AND(${filters.join(',')})`
  }

  // 채널별 또는 전체 조회
  const fetchHomepage = !channel || channel === 'homepage'
  const fetchMeta = !channel || channel === 'meta'

  const [homepageLeads, metaLeads] = await Promise.all([
    fetchHomepage ? fetchAllFromTable(HOMEPAGE_TABLE_ID, mapHomepageRecord, formula) : Promise.resolve([]),
    fetchMeta ? fetchAllFromTable(META_TABLE_ID, mapMetaRecord, formula) : Promise.resolve([]),
  ])

  // 병합 + 정렬
  const allLeads = [...homepageLeads, ...metaLeads]
  allLeads.sort((a, b) => {
    const dateA = new Date(a.created_at).getTime() || 0
    const dateB = new Date(b.created_at).getTime() || 0
    return sort === 'newest' ? dateB - dateA : dateA - dateB
  })

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
// 리드 요약 계산 (순수 함수 - 이미 조회한 데이터에서 계산)
// ===========================
export function calculateNarattonLeadSummary(allLeads: NarattonLead[]): NarattonLeadSummary {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const today = nowKST.toISOString().split('T')[0]
  const todayNew = allLeads.filter(l => {
    if (!l.created_at) return false
    const kst = new Date(new Date(l.created_at).getTime() + 9 * 60 * 60 * 1000)
    return kst.toISOString().split('T')[0] === today
  }).length

  const byStatus: Record<NarattonLeadStatus, number> = {
    '심사준비': 0, '1차 심사 완료': 0, '2차 심사 완료': 0, '계약 완료': 0,
    '심사거절': 0, '보류': 0, 'DB 중복': 0, '제외': 0,
    '지속부재': 0, '신용점수 확인': 0, '사업자등록증요청': 0, '생각해보겠다': 0,
  }
  const byChannel: Record<NarattonLeadChannel, number> = {
    homepage: 0,
    meta: 0,
  }
  let blacklisted = 0
  let duplicates = 0

  for (const lead of allLeads) {
    const s = lead.status as NarattonLeadStatus
    if (byStatus[s] !== undefined) byStatus[s]++
    byChannel[lead.channel]++
    if (lead.blacklisted) blacklisted++
    if (lead.submission_count > 1) duplicates++
  }

  const total = allLeads.length
  const conversionRate = total > 0 ? Math.round((byStatus['계약 완료'] / total) * 1000) / 10 : 0

  return {
    total,
    today_new: todayNew,
    by_status: byStatus,
    by_channel: byChannel,
    conversion_rate: conversionRate,
    blacklisted,
    duplicates,
  }
}

// ===========================
// 리드 목록 + 요약 통합 조회 (Airtable 2회 호출로 최적화)
// ===========================
export async function fetchNarattonLeadsWithSummary(options: FetchNarattonLeadsOptions = {}): Promise<{
  leads: NarattonLead[]
  hasMore: boolean
  total: number
  summary: NarattonLeadSummary
}> {
  const { channel, status, staff, blacklisted, search, duplicatesOnly, page = 1, pageSize = 100, sort = 'newest' } = options

  // 1. 항상 2테이블 전체 조회 (summary는 전체 데이터 기준이어야 함)
  const [homepageLeads, metaLeads] = await Promise.all([
    fetchAllFromTable(HOMEPAGE_TABLE_ID, mapHomepageRecord),
    fetchAllFromTable(META_TABLE_ID, mapMetaRecord),
  ])

  const allLeads = [...homepageLeads, ...metaLeads]

  // 2. summary는 항상 전체 데이터에서 계산 (필터 무관)
  const summary = calculateNarattonLeadSummary(allLeads)

  // 3. JS에서 필터 적용
  let filtered = allLeads

  if (channel) {
    filtered = filtered.filter(l => l.channel === channel)
  }

  if (status) {
    if (!(ALL_STATUSES as readonly string[]).includes(status)) {
      return { leads: [], hasMore: false, total: 0, summary }
    }
    filtered = filtered.filter(l => l.status === status)
  }
  if (staff) {
    filtered = filtered.filter(l => l.assigned_staff === staff)
  }
  if (blacklisted !== undefined) {
    filtered = filtered.filter(l => !!l.blacklisted === blacklisted)
  }
  if (duplicatesOnly) {
    filtered = filtered.filter(l => l.submission_count > 1)
  }
  if (search) {
    const q = search.slice(0, 50).toLowerCase()
    filtered = filtered.filter(l =>
      l.name.toLowerCase().includes(q) || l.phone.includes(q)
    )
  }

  // 4. 정렬
  filtered.sort((a, b) => {
    const dateA = new Date(a.created_at).getTime() || 0
    const dateB = new Date(b.created_at).getTime() || 0
    return sort === 'newest' ? dateB - dateA : dateA - dateB
  })

  // 5. 페이지네이션
  const total = filtered.length
  const start = (page - 1) * pageSize
  const paged = filtered.slice(start, start + pageSize)

  return {
    leads: paged,
    hasMore: start + pageSize < total,
    total,
    summary,
  }
}

// ===========================
// 단일 리드 조회
// ===========================
export async function getNarattonLead(recordId: string, tableId: string): Promise<NarattonLead | null> {
  const url = `${BASE_URL}/${tableId}/${recordId}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }, cache: 'no-store' })
  const data = await res.json()

  if (data.error) {
    console.error('getNarattonLead error:', data.error)
    return null
  }

  const mapFn = tableId === HOMEPAGE_TABLE_ID ? mapHomepageRecord : mapMetaRecord
  return mapFn(data)
}

// ===========================
// 리드 업데이트
// ===========================
export async function updateNarattonLead(
  recordId: string,
  tableId: string,
  updates: {
    status?: NarattonLeadStatus
    assigned_staff?: string
    blacklisted?: boolean
    submission_count?: number
  }
): Promise<NarattonLead | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {}

  if (updates.status !== undefined) fields['status'] = updates.status
  if (updates.assigned_staff !== undefined) fields['assigned_staff'] = updates.assigned_staff
  if (updates.blacklisted !== undefined) fields['blacklisted'] = updates.blacklisted
  if (updates.submission_count !== undefined) fields['submission_count'] = updates.submission_count

  const url = `${BASE_URL}/${tableId}/${recordId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  })
  const data = await res.json()

  if (data.error) {
    console.error('updateNarattonLead error:', data.error)
    return null
  }

  const mapFn = tableId === HOMEPAGE_TABLE_ID ? mapHomepageRecord : mapMetaRecord
  return mapFn(data)
}

// ===========================
// 메모 추가
// ===========================
export async function addNarattonLeadNote(
  recordId: string,
  tableId: string,
  note: string,
  author: string
): Promise<NarattonLead | null> {
  const current = await getNarattonLead(recordId, tableId)
  if (!current) return null

  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const newNote = `[${timestamp}] ${author}: ${note}`
  const updatedNotes = current.notes ? `${newNote}\n${current.notes}` : newNote

  const url = `${BASE_URL}/${tableId}/${recordId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: { notes: updatedNotes } }),
  })
  const data = await res.json()

  if (data.error) {
    console.error('addNarattonLeadNote error:', data.error)
    return null
  }

  const mapFn = tableId === HOMEPAGE_TABLE_ID ? mapHomepageRecord : mapMetaRecord
  return mapFn(data)
}

// ===========================
// 메모 수정
// ===========================
export async function updateNarattonLeadNote(
  recordId: string,
  tableId: string,
  noteIndex: number,
  newContent: string,
  author: string
): Promise<NarattonLead | null> {
  const current = await getNarattonLead(recordId, tableId)
  if (!current || !current.notes) return null

  const lines = current.notes.split('\n').filter(Boolean)
  if (noteIndex < 0 || noteIndex >= lines.length) return null

  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  lines[noteIndex] = `[${timestamp}] ${author}: ${newContent} (수정됨)`

  const url = `${BASE_URL}/${tableId}/${recordId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: { notes: lines.join('\n') } }),
  })
  const data = await res.json()
  if (data.error) {
    console.error('updateNarattonLeadNote error:', data.error)
    return null
  }

  const mapFn = tableId === HOMEPAGE_TABLE_ID ? mapHomepageRecord : mapMetaRecord
  return mapFn(data)
}

// ===========================
// 메모 삭제
// ===========================
export async function deleteNarattonLeadNote(
  recordId: string,
  tableId: string,
  noteIndex: number
): Promise<NarattonLead | null> {
  const current = await getNarattonLead(recordId, tableId)
  if (!current || !current.notes) return null

  const lines = current.notes.split('\n').filter(Boolean)
  if (noteIndex < 0 || noteIndex >= lines.length) return null
  lines.splice(noteIndex, 1)

  const url = `${BASE_URL}/${tableId}/${recordId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: { notes: lines.join('\n') } }),
  })
  const data = await res.json()
  if (data.error) {
    console.error('deleteNarattonLeadNote error:', data.error)
    return null
  }

  const mapFn = tableId === HOMEPAGE_TABLE_ID ? mapHomepageRecord : mapMetaRecord
  return mapFn(data)
}

// ===========================
// 중복 리드 검색 (cross-table)
// ===========================
export async function findDuplicateLeads(phone: string): Promise<NarattonLead[]> {
  const normalized = normalizePhone(phone)
  if (!normalized) return []

  const formula = `FIND('${escapeFormulaValue(normalized)}',SUBSTITUTE({연락처},"-",""))>0`

  const [homepageLeads, metaLeads] = await Promise.all([
    fetchAllFromTable(HOMEPAGE_TABLE_ID, mapHomepageRecord, formula),
    fetchAllFromTable(META_TABLE_ID, mapMetaRecord, formula),
  ])

  const all = [...homepageLeads, ...metaLeads]
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return all
}

// ===========================
// Staff CRUD
// ===========================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecordToStaff(record: any): NarattonStaff {
  const f = record.fields
  return {
    id: record.id,
    name: f['name'] || f['Name'] || '',
    is_active: f['is_active'] ?? true,
    totp_secret: f['totp_secret'] || undefined,
  }
}

export async function fetchNarattonStaff(): Promise<NarattonStaff[]> {
  if (!STAFF_TABLE_ID) {
    console.warn('AIRTABLE_NARATTON_STAFF_TABLE_ID not set')
    return []
  }

  const url = `${BASE_URL}/${STAFF_TABLE_ID}?sort[0][field]=name&sort[0][direction]=asc`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }, cache: 'no-store' })
  const data = await res.json()

  if (data.error) {
    console.error('fetchNarattonStaff error:', data.error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.records || []).map((r: any) => mapRecordToStaff(r))
}

export async function getNarattonStaffByName(name: string): Promise<NarattonStaff | null> {
  if (!STAFF_TABLE_ID) return null

  const params = new URLSearchParams()
  params.set('filterByFormula', `{name}='${escapeFormulaValue(name)}'`)
  params.set('maxRecords', '1')

  const url = `${BASE_URL}/${STAFF_TABLE_ID}?${params.toString()}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }, cache: 'no-store' })
  const data = await res.json()

  if (data.error || !data.records?.length) return null
  return mapRecordToStaff(data.records[0])
}

export async function createNarattonStaff(name: string): Promise<NarattonStaff | null> {
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
    console.error('createNarattonStaff error:', data.error)
    return null
  }

  return mapRecordToStaff(data)
}

export async function updateNarattonStaff(
  recordId: string,
  updates: { name?: string; is_active?: boolean; totp_secret?: string }
): Promise<NarattonStaff | null> {
  if (!STAFF_TABLE_ID) return null

  const url = `${BASE_URL}/${STAFF_TABLE_ID}/${recordId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: updates }),
  })
  const data = await res.json()

  if (data.error) {
    console.error('updateNarattonStaff error:', data.error)
    return null
  }

  return mapRecordToStaff(data)
}

export async function deleteNarattonStaff(recordId: string): Promise<boolean> {
  if (!STAFF_TABLE_ID) return false

  const url = `${BASE_URL}/${STAFF_TABLE_ID}/${recordId}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers,
  })
  const data = await res.json()

  if (data.error) {
    console.error('deleteNarattonStaff error:', data.error)
    return false
  }

  return true
}
