/**
 * Vercel Cron - Airtable 자동 백필
 *
 * 매일 새벽 3시 KST (UTC 18:00)에 실행
 * Meta 데이터를 수집하여 Airtable에 저장
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'

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

// Meta API 호출
async function fetchMetaData(
  accessToken: string,
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  date_start: string
  device_platform: string
  impressions: string
  clicks: string
  spend: string
  actions?: Array<{ action_type: string; value: string }>
}>> {
  const fields = 'date_start,impressions,clicks,spend,actions'
  const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?` +
    `fields=${fields}&` +
    `breakdowns=device_platform&` +
    `time_range={"since":"${startDate}","until":"${endDate}"}&` +
    `time_increment=1&` +
    `level=account&` +
    `limit=1000&` +
    `access_token=${accessToken}`

  const response = await fetch(url)
  const data = await response.json()

  if (data.error) {
    throw new Error(`Meta API 오류: ${data.error.message}`)
  }

  return data.data || []
}

// Airtable에서 기존 레코드 조회
async function findExistingRecord(
  baseId: string,
  tableId: string,
  date: string,
  source: string,
  device: string
): Promise<{ id: string; fields: { is_finalized?: boolean } } | null> {
  const formula = `AND({date}='${date}', {source}='${source}', {device}='${device}')`
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}`

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  })

  const data = await response.json()
  return data.records?.[0] || null
}

// Airtable 레코드 생성
async function createAirtableRecord(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(`Airtable 생성 오류: ${data.error.message}`)
  }
}

// Airtable 레코드 업데이트
async function updateAirtableRecord(
  baseId: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(`Airtable 업데이트 오류: ${data.error.message}`)
  }
}

// 클라이언트별 백필
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

  // Meta API 호출
  const rawData = await fetchMetaData(accessToken, adAccountId, startDate, endDate)

  let created = 0
  let updated = 0
  let skipped = 0

  for (const row of rawData) {
    const date = row.date_start
    const device = row.device_platform?.toLowerCase() || 'unknown'
    const source = 'meta'

    const fields = {
      date,
      device,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      leads: getActionValue(row.actions, 'lead'),
      spend: Math.round(parseFloat(row.spend) || 0),
      source,
      campaign_name: '',
      keywords: '',
      is_finalized: false,
    }

    // 기존 레코드 확인
    const existing = await findExistingRecord(config.baseId, config.tableId, date, source, device)

    if (existing) {
      if (existing.fields.is_finalized === true) {
        skipped++
        continue
      }
      await updateAirtableRecord(config.baseId, config.tableId, existing.id, fields)
      updated++
    } else {
      await createAirtableRecord(config.baseId, config.tableId, fields)
      created++
    }

    // Rate limit 방지 (200ms)
    await new Promise(r => setTimeout(r, 200))
  }

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

    // 완료 알림
    const successCount = Object.values(results).filter(r => !r.error).length
    const errorCount = Object.values(results).filter(r => r.error).length

    await sendTelegram(
      `✅ <b>Cron 백필 완료</b>\n\n` +
      `📅 기간: ${startDate} ~ ${endDate}\n` +
      `📊 생성: ${totalCreated}개, 업데이트: ${totalUpdated}개\n` +
      `✅ 성공: ${successCount}개 클라이언트\n` +
      (errorCount > 0 ? `❌ 실패: ${errorCount}개 클라이언트` : '')
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
