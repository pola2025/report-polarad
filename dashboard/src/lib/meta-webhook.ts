/**
 * Meta Leadgen Webhook 처리 라이브러리
 *
 * 데이터 흐름:
 * Meta 리드 접수 → POST /api/webhooks/meta-leads
 *   → 서명 검증 (x-hub-signature-256)
 *   → Meta API로 리드 상세 조회
 *   → 중복 체크 (전화번호)
 *   → Airtable 저장 (신규 or 재접수 업데이트)
 *   → 텔레그램 알림
 *
 * 환경변수:
 *   META_BAS_PAGE_ACCESS_TOKEN - BAS 페이지 토큰
 *   META_WEBHOOK_LEADS_BASE_ID - Webhook 리드 전용 Airtable Base ID
 *   META_WEBHOOK_LEADS_TABLE_ID - Webhook 리드 전용 Airtable Table ID
 *   AIRTABLE_API_KEY - Airtable PAT
 *   TELEGRAM_BOT_TOKEN - 텔레그램 봇 토큰
 */

// ===========================
// 환경변수
// ===========================
const META_PAGE_TOKEN = () => process.env.META_BAS_PAGE_ACCESS_TOKEN || ''
const AIRTABLE_TOKEN = () => process.env.AIRTABLE_API_KEY || ''
const WEBHOOK_BASE_ID = () => process.env.META_WEBHOOK_LEADS_BASE_ID || process.env.AIRTABLE_BAS_LEADS_BASE_ID || ''
const WEBHOOK_TABLE_ID = () => process.env.META_WEBHOOK_LEADS_TABLE_ID || process.env.AIRTABLE_BAS_LEADS_TABLE_ID || ''
const TELEGRAM_BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_CHAT_ID = '-1003394139746'

// ===========================
// Meta API: 리드 상세 조회
// ===========================
export interface MetaLeadData {
  id: string
  created_time: string
  field_data: Array<{ name: string; values: string[] }>
  ad_id?: string
  ad_name?: string
  adset_id?: string
  adset_name?: string
  campaign_id?: string
  campaign_name?: string
  form_id?: string
  platform?: string
}

export async function fetchLeadData(leadgenId: string): Promise<MetaLeadData | null> {
  const token = META_PAGE_TOKEN()
  if (!token) {
    console.error('[meta-webhook] META_BAS_PAGE_ACCESS_TOKEN not set')
    return null
  }

  const url = `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${token}&fields=id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform`

  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.text()
    console.error(`[meta-webhook] fetchLeadData failed (${res.status}):`, err)
    return null
  }

  return res.json()
}

// ===========================
// Meta 필드 → Airtable 매핑
// ===========================
export interface AirtableLeadFields {
  name: string
  phone: string
  email: string
  message: string
  created_at: string
  source: string
  campaign: string
  ad_name: string
  platform: string
}

export function mapMetaLeadToAirtable(lead: MetaLeadData): AirtableLeadFields {
  const fieldMap: Record<string, string> = {}
  for (const field of lead.field_data || []) {
    fieldMap[field.name.toLowerCase()] = field.values?.[0] || ''
  }

  // 이름 추출 (full_name, name 등 다양한 필드명 대응)
  const name = fieldMap['full_name'] || fieldMap['full name'] || fieldMap['이름'] || fieldMap['name'] || ''

  // 연락처 추출
  const phone = normalizePhone(
    fieldMap['phone_number'] || fieldMap['phone number'] || fieldMap['phone'] || fieldMap['연락처'] || fieldMap['전화번호'] || ''
  )

  // 이메일 추출
  const email = fieldMap['email'] || fieldMap['이메일'] || ''

  // 나머지 필드 → 문의내용에 합산
  const knownFields = new Set([
    'full_name', 'full name', '이름', 'name',
    'phone_number', 'phone number', 'phone', '연락처', '전화번호',
    'email', '이메일',
  ])

  const extraFields: string[] = []
  for (const field of lead.field_data || []) {
    if (!knownFields.has(field.name.toLowerCase())) {
      extraFields.push(`${field.name}: ${field.values?.[0] || ''}`)
    }
  }

  const message = extraFields.join('\n')

  // created_time → YYYY-MM-DD
  const created_at = lead.created_time
    ? lead.created_time.split('T')[0]
    : new Date().toISOString().split('T')[0]

  return {
    name,
    phone,
    email,
    message,
    created_at,
    source: `meta_leadgen_${lead.form_id || 'unknown'}`,
    campaign: lead.campaign_name || '',
    ad_name: lead.ad_name || '',
    platform: lead.platform || '',
  }
}

function normalizePhone(phone: string): string {
  // 국가코드 제거 후 숫자만
  let cleaned = phone.replace(/\D/g, '')
  // +82 → 0 변환
  if (cleaned.startsWith('82') && cleaned.length > 10) {
    cleaned = '0' + cleaned.slice(2)
  }
  return cleaned
}

// ===========================
// Airtable 저장 (Webhook 전용 테이블)
// ===========================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function airtableFetch(path: string, options?: RequestInit): Promise<any> {
  const token = AIRTABLE_TOKEN()
  const baseId = WEBHOOK_BASE_ID()
  const url = `https://api.airtable.com/v0/${baseId}${path}`

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  return res.json()
}

async function findExistingLead(phone: string): Promise<{
  id: string
  submission_count: number
  status: string
  assigned_staff: string
  submission_history: string
  created_at: string
} | null> {
  if (!phone) return null

  const tableId = WEBHOOK_TABLE_ID()
  const formula = encodeURIComponent(`FIND('${phone}',SUBSTITUTE({연락처},"-",""))>0`)
  const data = await airtableFetch(
    `/${tableId}?filterByFormula=${formula}&sort[0][field]=접수일&sort[0][direction]=desc`
  )

  if (data.error || !data.records?.length) return null

  const record = data.records[0]
  return {
    id: record.id,
    submission_count: record.fields['submission_count'] || 1,
    status: record.fields['status'] || '접수',
    assigned_staff: record.fields['assigned_staff'] || '',
    submission_history: record.fields['submission_history'] || '',
    created_at: record.fields['접수일'] || '',
  }
}

async function createLeadRecord(fields: AirtableLeadFields): Promise<string | null> {
  const tableId = WEBHOOK_TABLE_ID()
  const data = await airtableFetch(`/${tableId}`, {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        '이름': fields.name,
        '연락처': fields.phone,
        '이메일': fields.email,
        '문의내용': fields.message,
        '접수일': fields.created_at,
        status: '접수',
        submission_count: 1,
        first_submission_date: fields.created_at,
        submission_history: `1차: ${fields.created_at}`,
        source: fields.source,
        campaign: fields.campaign,
        ad_name: fields.ad_name,
        platform: fields.platform,
      },
    }),
  })

  if (data.error) {
    console.error('[meta-webhook] createLeadRecord error:', data.error)
    return null
  }
  return data.id
}

async function updateLeadForResubmission(
  existingId: string,
  fields: AirtableLeadFields,
  currentCount: number,
  currentStatus: string,
  currentStaff: string,
  currentHistory: string,
): Promise<boolean> {
  const tableId = WEBHOOK_TABLE_ID()
  const newCount = currentCount + 1
  const now = fields.created_at || new Date().toISOString().split('T')[0]

  // 이력 추가: "2차: 2026-01-31" 형태로 append
  const newEntry = `${newCount}차: ${now}`
  const updatedHistory = currentHistory
    ? `${currentHistory}\n${newEntry}`
    : `1차: (기존)\n${newEntry}`

  const data = await airtableFetch(`/${tableId}/${existingId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: {
        status: '접수',
        submission_count: newCount,
        previous_status: currentStatus,
        previous_staff: currentStaff,
        previous_date: now,
        submission_history: updatedHistory,
        '문의내용': fields.message,
        last_updated_by: 'webhook',
      },
    }),
  })

  if (data.error) {
    console.error('[meta-webhook] updateLeadForResubmission error:', data.error)
    return false
  }
  return true
}

// ===========================
// 텔레그램 알림
// ===========================
async function sendTelegram(text: string): Promise<void> {
  const token = TELEGRAM_BOT_TOKEN()
  if (!token) {
    console.error('[meta-webhook] TELEGRAM_BOT_TOKEN not set — skipping notification')
    return
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[meta-webhook] Telegram API error (${res.status}):`, body)
    }
  } catch (err) {
    console.error('[meta-webhook] sendTelegram network error:', err)
  }
}

export function sendLeadNotification(fields: AirtableLeadFields, isResubmission: boolean, count?: number): Promise<void> {
  const tag = isResubmission ? `재접수 (${count}회차)` : '신규'
  const lines = [
    `<b>[BAS 리드 ${tag}]</b>`,
    `이름: ${fields.name}`,
    `연락처: ${fields.phone}`,
  ]
  if (fields.campaign) lines.push(`광고명: ${fields.campaign}`)
  if (fields.platform) {
    const platformLabel = fields.platform === 'fb' ? 'Facebook' : fields.platform === 'ig' ? 'Instagram' : fields.platform
    lines.push(`플랫폼: ${platformLabel}`)
  }
  if (fields.email) lines.push(`이메일: ${fields.email}`)
  if (fields.message) {
    const truncated = fields.message.length > 200
      ? fields.message.slice(0, 200) + '...'
      : fields.message
    lines.push(`내용: ${truncated}`)
  }
  lines.push(`접수일: ${fields.created_at}`)

  return sendTelegram(lines.join('\n'))
}

function sendErrorNotification(error: string, context: string): Promise<void> {
  return sendTelegram(
    `<b>[BAS Webhook 에러]</b>\n${context}\n에러: ${error}`
  )
}

// ===========================
// 메인 처리
// ===========================
export interface ProcessResult {
  success: boolean
  action?: 'created' | 'resubmission' | 'skipped'
  recordId?: string
  error?: string
}

export async function processLeadEvent(leadgenId: string): Promise<ProcessResult> {
  // 1. 환경변수 확인
  if (!WEBHOOK_BASE_ID() || !WEBHOOK_TABLE_ID()) {
    const err = 'META_WEBHOOK_LEADS_BASE_ID or META_WEBHOOK_LEADS_TABLE_ID not set'
    console.error('[meta-webhook]', err)
    await sendErrorNotification(err, `leadgen_id: ${leadgenId}`)
    return { success: false, error: err }
  }

  // 2. Meta API로 리드 상세 조회
  const leadData = await fetchLeadData(leadgenId)
  if (!leadData) {
    const err = 'Failed to fetch lead data from Meta API'
    await sendErrorNotification(err, `leadgen_id: ${leadgenId}`)
    return { success: false, error: err }
  }

  // 3. 필드 매핑
  const fields = mapMetaLeadToAirtable(leadData)

  if (!fields.phone && !fields.name) {
    const err = 'No phone or name in lead data'
    await sendErrorNotification(err, `leadgen_id: ${leadgenId}, fields: ${JSON.stringify(leadData.field_data)}`)
    return { success: false, error: err }
  }

  // 4. 중복 체크
  const existing = fields.phone ? await findExistingLead(fields.phone) : null

  if (existing) {
    // 재접수: 기존 레코드 업데이트
    const ok = await updateLeadForResubmission(
      existing.id,
      fields,
      existing.submission_count,
      existing.status,
      existing.assigned_staff,
      existing.submission_history,
    )
    if (!ok) {
      return { success: false, error: 'Failed to update existing lead' }
    }
    await sendLeadNotification(fields, true, existing.submission_count + 1)
    return { success: true, action: 'resubmission', recordId: existing.id }
  }

  // 5. 신규 생성
  const recordId = await createLeadRecord(fields)
  if (!recordId) {
    return { success: false, error: 'Failed to create lead record' }
  }

  await sendLeadNotification(fields, false)
  return { success: true, action: 'created', recordId }
}
