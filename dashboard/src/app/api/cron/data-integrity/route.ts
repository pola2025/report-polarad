/**
 * Vercel Cron - 데이터 정합성 자동 검증
 *
 * 매일 백필 후 (UTC 19:00 = KST 04:00) 실행
 *
 * 검증 항목:
 * 1. 광고 데이터 중복 (date+ad_id+device) → 자동 정리
 * 2. 지출 이상치 (일예산 대비 비정상 금액) → 알림
 * 3. 환율 이중 적용 감지 (BAS=USD, 나라똔/HEA=KRW) → 알림
 * 4. 리드 동기화 누락 (OLD→NEW 미동기화) → 알림
 */

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY || ''
const TG_CHAT = '-1003394139746'

// BAS 광고 데이터
const BAS_AD_BASE = process.env.AIRTABLE_BAS_BASE_ID || 'appjo0o2LUEzIqH87'
const BAS_AD_TABLE = process.env.AIRTABLE_BAS_TABLE_ID || 'tblfuy6knQK82AGp4'

// BAS 리드 (OLD=Make.com, NEW=대시보드)
const LEAD_OLD_BASE = 'appdyFH6v4quVvF4z'
const LEAD_OLD_TABLE = 'tbl6p9tWbl5keMvrI'
const LEAD_NEW_BASE = process.env.AIRTABLE_BAS_LEADS_BASE_ID || 'app1Bh2Ny6eqTERqA'
const LEAD_NEW_TABLE = process.env.AIRTABLE_BAS_LEADS_TABLE_ID || 'tblaDj4M0Tlq2IRQu'

// HEA / 나라똔 광고 데이터
const CLIENT_AD_TABLES: Record<string, { baseId: string; tableId: string; currency: string; dailyBudgetMax: number }> = {
  'BAS': {
    baseId: BAS_AD_BASE,
    tableId: BAS_AD_TABLE,
    currency: 'USD',
    dailyBudgetMax: 200, // USD
  },
  'HEA': {
    baseId: process.env.AIRTABLE_HEA_BASE_ID || '',
    tableId: process.env.AIRTABLE_HEA_TABLE_ID || '',
    currency: 'KRW',
    dailyBudgetMax: 100000, // KRW
  },
  '나라똔': {
    baseId: process.env.AIRTABLE_NARATTON_BASE_ID || '',
    tableId: process.env.AIRTABLE_NARATTON_TABLE_ID || '',
    currency: 'KRW',
    dailyBudgetMax: 100000, // KRW
  },
}

// 인증
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  return request.headers.get('x-admin-key') === process.env.ADMIN_KEY
}

// 텔레그램 알림
async function sendTG(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: message, parse_mode: 'HTML' }),
    })
  } catch (e) {
    console.error('TG 알림 실패:', e)
  }
}

// Airtable 페이지네이션 조회
async function airtableQuery(
  baseId: string,
  tableId: string,
  formula: string,
  fields?: string[]
): Promise<Array<{ id: string; fields: Record<string, unknown>; createdTime: string }>> {
  const records: Array<{ id: string; fields: Record<string, unknown>; createdTime: string }> = []
  let offset = ''

  do {
    let url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}&pageSize=100`
    if (fields) url += `&${fields.map(f => `fields[]=${encodeURIComponent(f)}`).join('&')}`
    if (offset) url += `&offset=${offset}`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    })
    const data = await res.json()
    if (data.error) { console.error('Airtable error:', data.error); break }
    if (data.records) records.push(...data.records)
    offset = data.offset || ''
  } while (offset)

  return records
}

// Airtable 배치 삭제
async function batchDelete(baseId: string, tableId: string, ids: string[]): Promise<number> {
  let deleted = 0
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10)
    const params = batch.map(id => `records[]=${id}`).join('&')
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}?${params}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    })
    const data = await res.json()
    if (!data.error) deleted += batch.length
    if (i + 10 < ids.length) await new Promise(r => setTimeout(r, 250))
  }
  return deleted
}

// 전화번호 정규화
function normPhone(p: string): string {
  let c = (p || '').replace(/\D/g, '')
  if (c.startsWith('82') && c.length > 10) c = '0' + c.slice(2)
  return c
}

// ============================================================
// 검증 1: 광고 데이터 중복 체크 + 자동 정리
// ============================================================
interface DedupResult {
  client: string
  totalRecords: number
  duplicateGroups: number
  deleted: number
  excessSpend: number
}

async function checkAndFixDuplicates(
  clientName: string,
  baseId: string,
  tableId: string,
  isAdLevel: boolean
): Promise<DedupResult> {
  if (!baseId || !tableId) return { client: clientName, totalRecords: 0, duplicateGroups: 0, deleted: 0, excessSpend: 0 }

  // 최근 7일 데이터 조회 (매일 실행이므로 7일이면 충분)
  const end = new Date()
  const start = new Date(); start.setDate(start.getDate() - 7)
  const startStr = start.toISOString().split('T')[0]
  const nextDay = new Date(end); nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = nextDay.toISOString().split('T')[0]

  const formula = `AND({date}>='${startStr}', {date}<'${nextDayStr}', {source}='meta')`
  const records = await airtableQuery(baseId, tableId, formula)

  // 키 기준 그룹핑
  const groups: Record<string, Array<{ id: string; spend: number }>> = {}
  for (const rec of records) {
    const f = rec.fields
    const key = isAdLevel
      ? `${f.date}|${f.ad_id || ''}|${f.device || ''}`
      : `${f.date}|${f.campaign_name || ''}|${f.device || ''}`
    if (!groups[key]) groups[key] = []
    groups[key].push({ id: rec.id, spend: (f.spend as number) || 0 })
  }

  const dupeKeys = Object.keys(groups).filter(k => groups[k].length > 1)
  if (dupeKeys.length === 0) {
    return { client: clientName, totalRecords: records.length, duplicateGroups: 0, deleted: 0, excessSpend: 0 }
  }

  // 중복 정리: spend 최대값 레코드 유지, 나머지 삭제
  const toDelete: string[] = []
  let excessSpend = 0
  for (const key of dupeKeys) {
    const recs = groups[key].sort((a, b) => b.spend - a.spend)
    const remove = recs.slice(1)
    for (const r of remove) {
      toDelete.push(r.id)
      excessSpend += r.spend
    }
  }

  const deleted = await batchDelete(baseId, tableId, toDelete)

  return {
    client: clientName,
    totalRecords: records.length,
    duplicateGroups: dupeKeys.length,
    deleted,
    excessSpend: Math.round(excessSpend * 100) / 100,
  }
}

// ============================================================
// 검증 2+3: 지출 이상치 + 환율 이중 적용 감지
// ============================================================
interface SpendAnomaly {
  client: string
  date: string
  totalSpend: number
  currency: string
  issue: string // 'over_budget' | 'possible_double_fx'
}

async function checkSpendAnomalies(
  clientName: string,
  baseId: string,
  tableId: string,
  currency: string,
  dailyBudgetMax: number
): Promise<SpendAnomaly[]> {
  if (!baseId || !tableId) return []

  const end = new Date()
  const start = new Date(); start.setDate(start.getDate() - 7)
  const startStr = start.toISOString().split('T')[0]
  const nextDay = new Date(end); nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = nextDay.toISOString().split('T')[0]

  const formula = `AND({date}>='${startStr}', {date}<'${nextDayStr}', {source}='meta')`
  const records = await airtableQuery(baseId, tableId, formula, ['date', 'spend'])

  // 날짜별 합계
  const byDate: Record<string, number> = {}
  for (const rec of records) {
    const d = rec.fields.date as string
    byDate[d] = (byDate[d] || 0) + ((rec.fields.spend as number) || 0)
  }

  const anomalies: SpendAnomaly[] = []
  for (const [date, spend] of Object.entries(byDate)) {
    // 이상치 1: 일예산 3배 초과 → 중복 또는 이상 데이터
    if (spend > dailyBudgetMax * 3) {
      anomalies.push({ client: clientName, date, totalSpend: Math.round(spend * 100) / 100, currency, issue: 'over_budget' })
    }
    // 이상치 2: USD 클라이언트인데 값이 1000+ → 환율 이중 적용 의심
    if (currency === 'USD' && spend > 1000) {
      anomalies.push({ client: clientName, date, totalSpend: Math.round(spend * 100) / 100, currency, issue: 'possible_double_fx' })
    }
    // 이상치 3: KRW 클라이언트인데 값이 100 미만 → USD 그대로 저장 의심
    if (currency === 'KRW' && spend > 0 && spend < 100) {
      anomalies.push({ client: clientName, date, totalSpend: Math.round(spend * 100) / 100, currency, issue: 'possible_missing_fx' })
    }
  }

  return anomalies
}

// ============================================================
// 검증 4: BAS 리드 동기화 누락 감지
// ============================================================
interface LeadSyncResult {
  oldCount: number
  newCount: number
  missingPhones: string[] // 정규화된 전화번호
  recentMissing: number   // 최근 48시간 내 누락
}

async function checkLeadSync(): Promise<LeadSyncResult> {
  // 최근 48시간 OLD 테이블 레코드 조회
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - 48)
  const cutoffStr = cutoff.toISOString()

  const formula = `IS_AFTER(CREATED_TIME(), '${cutoffStr}')`
  const oldRecords = await airtableQuery(LEAD_OLD_BASE, LEAD_OLD_TABLE, formula, ['전화번호', '이름'])

  if (oldRecords.length === 0) {
    return { oldCount: 0, newCount: 0, missingPhones: [], recentMissing: 0 }
  }

  // OLD 전화번호 목록
  const oldPhones = new Map<string, string>() // normalized → name
  for (const rec of oldRecords) {
    const phone = normPhone(rec.fields['전화번호'] as string || '')
    const name = (rec.fields['이름'] as string) || ''
    if (phone.length >= 10) oldPhones.set(phone, name)
  }

  // NEW 테이블에서 해당 전화번호 존재 여부 확인
  // 전화번호 목록을 OR로 검색 (최대 100개까지)
  const phonesToCheck = Array.from(oldPhones.keys()).slice(0, 100)
  if (phonesToCheck.length === 0) {
    return { oldCount: oldRecords.length, newCount: 0, missingPhones: [], recentMissing: 0 }
  }

  const orClauses = phonesToCheck.map(p => `{phone}='${p}'`).join(',')
  const newFormula = `OR(${orClauses})`
  const newRecords = await airtableQuery(LEAD_NEW_BASE, LEAD_NEW_TABLE, newFormula, ['phone'])

  const newPhones = new Set<string>()
  for (const rec of newRecords) {
    newPhones.add(normPhone(rec.fields.phone as string || ''))
  }

  // 누락된 전화번호
  const missing = phonesToCheck.filter(p => !newPhones.has(p))

  return {
    oldCount: oldRecords.length,
    newCount: newRecords.length,
    missingPhones: missing,
    recentMissing: missing.length,
  }
}

// ============================================================
// 메인 핸들러
// ============================================================
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const issues: string[] = []
  const fixes: string[] = []
  const results: Record<string, unknown> = {}

  try {
    // ── 1. 중복 체크 + 자동 정리 ──
    const dedupResults: DedupResult[] = []

    for (const [name, config] of Object.entries(CLIENT_AD_TABLES)) {
      const isAdLevel = name === 'BAS'
      const result = await checkAndFixDuplicates(name, config.baseId, config.tableId, isAdLevel)
      dedupResults.push(result)

      if (result.deleted > 0) {
        fixes.push(`${name}: 중복 ${result.deleted}건 자동 삭제 (초과 spend: ${config.currency === 'USD' ? '$' : '₩'}${result.excessSpend.toLocaleString()})`)
      }
    }
    results.dedup = dedupResults

    // ── 2+3. 지출 이상치 + 환율 감지 ──
    const allAnomalies: SpendAnomaly[] = []

    for (const [name, config] of Object.entries(CLIENT_AD_TABLES)) {
      const anomalies = await checkSpendAnomalies(name, config.baseId, config.tableId, config.currency, config.dailyBudgetMax)
      allAnomalies.push(...anomalies)
    }

    for (const a of allAnomalies) {
      const symbol = a.currency === 'USD' ? '$' : '₩'
      if (a.issue === 'over_budget') {
        issues.push(`${a.client} ${a.date}: 일 지출 ${symbol}${a.totalSpend.toLocaleString()} (예산 3배 초과)`)
      } else if (a.issue === 'possible_double_fx') {
        issues.push(`${a.client} ${a.date}: USD인데 ${symbol}${a.totalSpend.toLocaleString()} (환율 이중 적용 의심)`)
      } else if (a.issue === 'possible_missing_fx') {
        issues.push(`${a.client} ${a.date}: KRW인데 ${symbol}${a.totalSpend.toLocaleString()} (환율 미적용 의심)`)
      }
    }
    results.anomalies = allAnomalies

    // ── 4. 리드 동기화 누락 ──
    const leadSync = await checkLeadSync()
    results.leadSync = leadSync

    if (leadSync.recentMissing > 0) {
      issues.push(`BAS 리드 누락 ${leadSync.recentMissing}건 (48h 내 OLD→NEW 미동기화)`)
    }

    // ── 결과 보고 ──
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const hasIssues = issues.length > 0
    const hasFixes = fixes.length > 0

    let tgMsg = ''

    if (!hasIssues && !hasFixes) {
      tgMsg = `✅ <b>데이터 정합성 검증 완료</b> (${elapsed}초)\n\n모든 항목 정상`
    } else {
      tgMsg = `${hasIssues ? '⚠️' : '🔧'} <b>데이터 정합성 검증 완료</b> (${elapsed}초)\n`

      if (hasFixes) {
        tgMsg += `\n<b>🔧 자동 수정:</b>\n${fixes.map(f => `• ${f}`).join('\n')}`
      }

      if (hasIssues) {
        tgMsg += `\n\n<b>⚠️ 주의 필요:</b>\n${issues.map(i => `• ${i}`).join('\n')}`
      }
    }

    await sendTG(tgMsg)

    return NextResponse.json({
      success: true,
      elapsed: `${elapsed}s`,
      issues,
      fixes,
      results,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('데이터 정합성 검증 실패:', error)
    await sendTG(`❌ <b>데이터 정합성 검증 실패</b>\n\n${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
