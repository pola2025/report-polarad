/**
 * Vercel Cron - Airtable 자동 백필
 *
 * 매일 새벽 3시 KST (UTC 18:00)에 실행
 * Meta 데이터를 수집하여 Airtable에 저장
 *
 * 최적화: 배치 조회/쓰기, 재시도 로직 (2026-01-30)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'

// Vercel Pro: 최대 실행 시간 60초
export const maxDuration = 60

// 텔레그램 설정
const BACKFILL_CHAT_ID = '-1003394139746'

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY
const AIRTABLE_CONFIG: Record<string, { baseId: string; tableId: string }> = {
  'H.E.A 판교': {
    baseId: process.env.AIRTABLE_HEA_BASE_ID || '',
    tableId: process.env.AIRTABLE_HEA_TABLE_ID || '',
  },
  '나라똔': {
    baseId: process.env.AIRTABLE_NARATTON_BASE_ID || '',
    tableId: process.env.AIRTABLE_NARATTON_TABLE_ID || '',
  },
  '비즈액터스쿨': {
    baseId: process.env.AIRTABLE_BAS_BASE_ID || '',
    tableId: process.env.AIRTABLE_BAS_TABLE_ID || '',
  },
}

// Cron 인증 검증
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true
  }
  // 관리자 키로도 허용 (수동 실행용)
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === process.env.ADMIN_KEY
}

// 텔레그램 알림
async function sendTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: BACKFILL_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch (e) {
    console.error('텔레그램 알림 실패:', e)
  }
}

// actions 배열에서 특정 action_type 값 추출
function getActionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  actionType: string
): number {
  if (!actions || !Array.isArray(actions)) return 0
  const action = actions.find((a) => a.action_type === actionType)
  return action ? parseInt(action.value) || 0 : 0
}

// Meta API 응답 타입
interface MetaInsightRow {
  date_start: string
  device_platform: string
  impressions: string
  clicks: string
  spend: string
  campaign_id: string
  campaign_name: string
  ad_id?: string
  ad_name?: string
  actions?: Array<{ action_type: string; value: string }>
  video_p100_watched_actions?: Array<{ action_type: string; value: string }>
  video_play_actions?: Array<{ action_type: string; value: string }>
  video_thruplay_watched_actions?: Array<{ action_type: string; value: string }>
  video_avg_time_watched_actions?: Array<{ action_type: string; value: string }>
}

// 광고 레벨 백필이 필요한 클라이언트 (ad_id 저장)
const AD_LEVEL_CLIENTS = ['비즈액터스쿨']

// Airtable 레코드 타입
interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

// ─── 변경 2: fetchWithRetry ─────────────────────────────────────────
// 3회 재시도 + 지수 백오프 + 429 Retry-After 존중
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options)
    lastResponse = response

    if (response.ok) return response

    // 429 Rate Limit → Retry-After 존중
    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '') || (2 ** attempt)
      console.warn(`⏳ Rate limit (429), ${retryAfter}초 대기 (${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      continue
    }

    // 서버 에러 (5xx) → 지수 백오프 재시도
    if (response.status >= 500 && response.status <= 504 && attempt < maxRetries) {
      const delay = (2 ** attempt) * 1000
      console.warn(`⏳ 서버 에러 (${response.status}), ${delay}ms 대기 (${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, delay))
      continue
    }

    // 재시도 불가능한 에러 또는 마지막 시도
    return response
  }

  return lastResponse!
}

// Meta API 호출 (클라이언트별 캠페인/광고 레벨 분기)
async function fetchMetaData(
  accessToken: string,
  adAccountId: string,
  startDate: string,
  endDate: string,
  clientName: string
): Promise<MetaInsightRow[]> {
  const isAdLevel = AD_LEVEL_CLIENTS.includes(clientName)
  const level = isAdLevel ? 'ad' : 'campaign'

  // 광고 레벨은 ad_id, ad_name 추가 + video_play_actions, video_thruplay 포함
  const fields = isAdLevel
    ? 'date_start,campaign_id,campaign_name,ad_id,ad_name,impressions,clicks,spend,actions,video_play_actions,video_thruplay_watched_actions,video_avg_time_watched_actions'
    : 'date_start,campaign_id,campaign_name,impressions,clicks,spend,actions,video_p100_watched_actions,video_avg_time_watched_actions'

  const allData: MetaInsightRow[] = []

  let url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?` +
    `fields=${fields}&` +
    `breakdowns=device_platform&` +
    `time_range={"since":"${startDate}","until":"${endDate}"}&` +
    `time_increment=1&` +
    `level=${level}&` +
    `limit=500&` +
    `access_token=${accessToken}`

  // 페이지네이션 처리
  while (url) {
    const response = await fetchWithRetry(url)
    const data = await response.json()

    if (data.error) {
      throw new Error(`Meta API 오류: ${data.error.message}`)
    }

    if (data.data) {
      allData.push(...data.data)
    }

    // 다음 페이지 URL (있으면)
    url = data.paging?.next || ''
  }

  return allData
}

// ─── 변경 3: 배치 조회 ──────────────────────────────────────────────
// 날짜 범위 전체 레코드를 1~3회 페이지네이션으로 로드 → Map 구축
// 키: BAS → date|ad_id|device, 나라똔 → date|campaign_name|device, HEA → date||device
async function loadExistingRecords(
  baseId: string,
  tableId: string,
  startDate: string,
  endDate: string,
  clientName: string
): Promise<Map<string, AirtableRecord>> {
  const records: AirtableRecord[] = []
  let offset = ''

  do {
    const formula = encodeURIComponent(
      `AND({date}>='${startDate}', {date}<='${endDate}', {source}='meta')`
    )
    let url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${formula}&pageSize=100`
    if (offset) url += `&offset=${offset}`

    const response = await fetchWithRetry(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    })
    const data = await response.json()
    if (data.records) records.push(...data.records)
    offset = data.offset || ''
  } while (offset)

  // 클라이언트별 키로 Map 구축
  const isAdLevel = AD_LEVEL_CLIENTS.includes(clientName)
  const map = new Map<string, AirtableRecord>()

  for (const r of records) {
    let key: string
    if (isAdLevel) {
      // BAS: date + ad_id + device
      key = `${r.fields.date}|${r.fields.ad_id || ''}|${r.fields.device || ''}`
    } else if (clientName === '나라똔') {
      // 나라똔: date + campaign_name + device
      key = `${r.fields.date}|${r.fields.campaign_name || ''}|${r.fields.device || ''}`
    } else {
      // HEA: date + device (campaign_name 없음)
      key = `${r.fields.date}||${r.fields.device || ''}`
    }
    map.set(key, r)
  }

  return map
}

// ─── 변경 4: 배치 쓰기 ──────────────────────────────────────────────
// Airtable 배치 API: 최대 10건/요청
async function batchCreateRecords(
  baseId: string,
  tableId: string,
  fieldsList: Array<Record<string, unknown>>
): Promise<number> {
  let created = 0
  for (let i = 0; i < fieldsList.length; i += 10) {
    const batch = fieldsList.slice(i, i + 10)
    const response = await fetchWithRetry(
      `https://api.airtable.com/v0/${baseId}/${tableId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: batch.map(fields => ({ fields })),
        }),
      }
    )
    const data = await response.json()
    if (data.error) {
      throw new Error(`Airtable 배치 생성 오류: ${data.error.message}`)
    }
    created += batch.length
  }
  return created
}

async function batchUpdateRecords(
  baseId: string,
  tableId: string,
  updates: Array<{ id: string; fields: Record<string, unknown> }>
): Promise<number> {
  let updated = 0
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10)
    const response = await fetchWithRetry(
      `https://api.airtable.com/v0/${baseId}/${tableId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: batch.map(u => ({ id: u.id, fields: u.fields })),
        }),
      }
    )
    const data = await response.json()
    if (data.error) {
      throw new Error(`Airtable 배치 업데이트 오류: ${data.error.message}`)
    }
    updated += batch.length
  }
  return updated
}

// 클라이언트별 백필 (3단계: Meta 조회 → 분류 → 배치 실행)
async function backfillClient(
  clientName: string,
  accessToken: string,
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<{ created: number; updated: number; skipped: number }> {
  const config = AIRTABLE_CONFIG[clientName]
  if (!config || !config.baseId || !config.tableId) {
    throw new Error(`Airtable 설정 없음: ${clientName}`)
  }

  const isAdLevel = AD_LEVEL_CLIENTS.includes(clientName)

  // Phase 1: Meta API 호출
  const rawData = await fetchMetaData(accessToken, adAccountId, startDate, endDate, clientName)

  // Phase 2: 기존 레코드 배치 로드 + 분류
  const existingMap = await loadExistingRecords(
    config.baseId, config.tableId, startDate, endDate, clientName
  )

  const toCreate = new Map<string, Record<string, unknown>>()
  const toUpdate = new Map<string, { id: string; fields: Record<string, unknown> }>()
  let skipped = 0

  for (const row of rawData) {
    const date = row.date_start
    const device = row.device_platform?.toLowerCase() || 'unknown'
    const source = 'meta'
    const campaignName = row.campaign_name || ''

    // 클라이언트별 필드 구조 (테이블 스키마에 맞춤)
    const fields: Record<string, unknown> = {
      date,
      device,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      spend: Math.round(parseFloat(row.spend) || 0),
      source,
    }

    let key: string

    if (isAdLevel) {
      // 광고 레벨 (BAS): ad_id, campaign_name = "광고명 (캠페인명)" 형식
      const adId = row.ad_id || ''
      const adName = row.ad_name || ''
      fields.ad_id = adId
      fields.campaign_name = `${adName}${campaignName ? ` (${campaignName})` : ''}`
      fields.leads = getActionValue(row.actions, 'lead')
      fields.video_views = row.video_play_actions?.[0]?.value
        ? parseInt(row.video_play_actions[0].value) : 0
      fields.video_thruplay = row.video_thruplay_watched_actions?.[0]?.value
        ? parseInt(row.video_thruplay_watched_actions[0].value) : 0
      fields.avg_watch_time = row.video_avg_time_watched_actions?.[0]?.value
        ? parseFloat(row.video_avg_time_watched_actions[0].value) : 0
      key = `${date}|${adId}|${device}`
    } else if (clientName === '나라똔') {
      // 나라똔: 캠페인 레벨 + 추가 필드
      fields.campaign_name = campaignName
      fields.leads = getActionValue(row.actions, 'lead')
      fields.video_views = row.video_p100_watched_actions?.[0]?.value
        ? parseInt(row.video_p100_watched_actions[0].value) : 0
      fields.avg_watch_time = row.video_avg_time_watched_actions?.[0]?.value
        ? parseFloat(row.video_avg_time_watched_actions[0].value) : 0
      key = `${date}|${campaignName}|${device}`
    } else {
      // HEA 판교: 기본 필드만 (date, device, impressions, clicks, spend, source)
      key = `${date}||${device}`
    }

    // 분류: create / update / skip
    const existing = existingMap.get(key)
    if (existing) {
      if (existing.fields.is_finalized === true) {
        skipped++
        continue
      }
      toUpdate.set(key, { id: existing.id, fields })
    } else {
      toCreate.set(key, fields)
    }
  }

  // Phase 3: 배치 쓰기
  const created = toCreate.size > 0
    ? await batchCreateRecords(config.baseId, config.tableId, Array.from(toCreate.values()))
    : 0
  const updated = toUpdate.size > 0
    ? await batchUpdateRecords(config.baseId, config.tableId, Array.from(toUpdate.values()))
    : 0

  return { created, updated, skipped }
}

// GET: Cron 실행
export async function GET(request: NextRequest) {
  // 인증 검증
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 날짜 계산 (어제~오늘)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const startDate = yesterday.toISOString().split('T')[0]
  const endDate = today.toISOString().split('T')[0]

  console.log(`🔄 Cron 백필 시작: ${startDate} ~ ${endDate}`)

  // 시작 알림
  await sendTelegram(
    `🔄 <b>Cron 백필 시작</b>\n\n` +
    `📅 기간: ${startDate} ~ ${endDate}\n` +
    `📦 소스: Meta → Airtable`
  )

  try {
    // 활성 클라이언트 조회
    const { data: clients, error } = await getSupabaseAdmin()
      .from(TABLES.CLIENTS)
      .select('id, client_name, meta_ad_account_id, meta_access_token')
      .eq('is_active', true)
      .not('meta_ad_account_id', 'is', null)
      .not('meta_access_token', 'is', null)

    if (error || !clients) {
      throw new Error('클라이언트 조회 실패')
    }

    const results: Record<string, { created: number; updated: number; skipped: number; error?: string }> = {}
    let totalCreated = 0
    let totalUpdated = 0

    // 각 클라이언트 백필
    for (const client of clients) {
      try {
        const result = await backfillClient(
          client.client_name,
          client.meta_access_token,
          client.meta_ad_account_id,
          startDate,
          endDate
        )
        results[client.client_name] = result
        totalCreated += result.created
        totalUpdated += result.updated
        console.log(`✅ ${client.client_name}: +${result.created}, ~${result.updated}`)
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error'
        results[client.client_name] = { created: 0, updated: 0, skipped: 0, error: errorMsg }
        console.error(`❌ ${client.client_name}: ${errorMsg}`)
      }
    }

    // 완료 알림 (클라이언트별 상세 포함)
    const successCount = Object.values(results).filter(r => !r.error).length
    const errorCount = Object.values(results).filter(r => r.error).length

    const clientDetails = Object.entries(results)
      .map(([name, r]) => {
        if (r.error) return `❌ ${name}: ${r.error}`
        return `✅ ${name}: +${r.created} / ~${r.updated} / ⏭${r.skipped}`
      })
      .join('\n')

    await sendTelegram(
      `✅ <b>Cron 백필 완료</b>\n\n` +
      `📅 기간: ${startDate} ~ ${endDate}\n` +
      `📊 생성: ${totalCreated}개, 업데이트: ${totalUpdated}개\n` +
      `✅ 성공: ${successCount}개 / ❌ 실패: ${errorCount}개\n\n` +
      `<b>클라이언트별 결과:</b>\n${clientDetails}`
    )

    return NextResponse.json({
      success: true,
      period: { startDate, endDate },
      totalCreated,
      totalUpdated,
      clients: results,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Cron 백필 실패:', error)

    await sendTelegram(`❌ <b>Cron 백필 실패</b>\n\n${errorMsg}`)

    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
