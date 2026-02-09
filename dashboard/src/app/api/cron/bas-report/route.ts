/**
 * Vercel Cron - BAS 주간/월간 리포트 자동 생성 + AI 인사이트
 *
 * 스케줄:
 *   주간: 매주 월요일 09:00 KST (UTC 00:00) → 지난주 리포트
 *   월간: 매월 1일 09:00 KST (UTC 00:00) → 지난달 리포트
 *
 * GET /api/cron/bas-report
 * GET /api/cron/bas-report?type=weekly
 * GET /api/cron/bas-report?type=monthly
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 60

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY
const BAS_BASE_ID = process.env.AIRTABLE_BAS_BASE_ID || 'appjo0o2LUEzIqH87'
const BAS_TABLE_ID = process.env.AIRTABLE_BAS_TABLE_ID || 'tblfuy6knQK82AGp4'
const BAS_CLIENT_ID = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515'
const BACKFILL_CHAT_ID = '-1003394139746'

// ─── Auth ───────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === process.env.ADMIN_KEY
}

// ─── Telegram ───────────────────────────────────────────────

async function sendTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: BACKFILL_CHAT_ID, text: message, parse_mode: 'HTML' }),
    })
  } catch { /* silent */ }
}

// ─── Airtable Fetch ─────────────────────────────────────────

interface AirtableFields {
  date: string
  impressions: number
  clicks: number
  spend: number
  leads: number
  video_views: number
  avg_watch_time: number
  ad_id: string
  campaign_name: string
}

async function fetchAirtableRecords(startDate: string, endDate: string) {
  const records: { fields: AirtableFields }[] = []
  let offset = ''

  const nextDay = new Date(endDate)
  nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = nextDay.toISOString().split('T')[0]

  do {
    const formula = encodeURIComponent(
      `AND({date}>='${startDate}', {date}<'${nextDayStr}', {source}='meta')`
    )
    let url = `https://api.airtable.com/v0/${BAS_BASE_ID}/${BAS_TABLE_ID}?filterByFormula=${formula}&pageSize=100`
    if (offset) url += `&offset=${offset}`

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    })
    const data = await response.json()
    if (data.error) throw new Error(`Airtable: ${JSON.stringify(data.error)}`)
    if (data.records) records.push(...data.records)
    offset = data.offset || ''
  } while (offset)

  return records
}

// ─── Aggregate ──────────────────────────────────────────────

function aggregateData(records: { fields: AirtableFields }[]) {
  const dailyMap: Record<string, { date: string; impressions: number; clicks: number; spend: number; leads: number; cpl?: number | null }> = {}
  const adMap: Record<string, { ad_id: string; ad_name: string; impressions: number; clicks: number; spend: number; leads: number }> = {}
  const campaignMap: Record<string, { campaign_name: string; impressions: number; clicks: number; spend: number; leads: number }> = {}

  for (const rec of records) {
    const f = rec.fields
    const date = f.date
    const adId = f.ad_id || ''
    const campaignName = f.campaign_name || ''
    const impressions = f.impressions || 0
    const clicks = f.clicks || 0
    const spend = parseFloat(String(f.spend)) || 0
    const leads = f.leads || 0

    if (!dailyMap[date]) dailyMap[date] = { date, impressions: 0, clicks: 0, spend: 0, leads: 0 }
    dailyMap[date].impressions += impressions
    dailyMap[date].clicks += clicks
    dailyMap[date].spend += spend
    dailyMap[date].leads += leads

    if (adId) {
      if (!adMap[adId]) adMap[adId] = { ad_id: adId, ad_name: '', impressions: 0, clicks: 0, spend: 0, leads: 0 }
      adMap[adId].impressions += impressions
      adMap[adId].clicks += clicks
      adMap[adId].spend += spend
      adMap[adId].leads += leads
      if (!adMap[adId].ad_name && campaignName) {
        const match = campaignName.match(/^(.+?)\s*\(/)
        adMap[adId].ad_name = match ? match[1].trim() : campaignName
      }
    }

    const campMatch = campaignName.match(/\((.+?)\)$/)
    const campName = campMatch ? campMatch[1] : campaignName
    if (campName) {
      if (!campaignMap[campName]) campaignMap[campName] = { campaign_name: campName, impressions: 0, clicks: 0, spend: 0, leads: 0 }
      campaignMap[campName].impressions += impressions
      campaignMap[campName].clicks += clicks
      campaignMap[campName].spend += spend
      campaignMap[campName].leads += leads
    }
  }

  const dailyStats = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
  const totalImpressions = dailyStats.reduce((s, d) => s + d.impressions, 0)
  const totalClicks = dailyStats.reduce((s, d) => s + d.clicks, 0)
  const totalSpend = dailyStats.reduce((s, d) => s + d.spend, 0)
  const totalLeads = dailyStats.reduce((s, d) => s + d.leads, 0)

  for (const d of dailyStats) {
    d.cpl = d.leads > 0 ? Math.round((d.spend / d.leads) * 100) / 100 : null
  }

  const adPerformance = Object.values(adMap)
    .map(ad => ({
      ...ad,
      spend: Math.round(ad.spend * 100) / 100,
      cpl: ad.leads > 0 ? Math.round((ad.spend / ad.leads) * 100) / 100 : null,
      ctr: ad.impressions > 0 ? Math.round((ad.clicks / ad.impressions) * 10000) / 100 : 0,
      lead_percent: totalLeads > 0 ? Math.round((ad.leads / totalLeads) * 1000) / 10 : 0,
      spend_percent: totalSpend > 0 ? Math.round((ad.spend / totalSpend) * 1000) / 10 : 0,
    }))
    .sort((a, b) => (b.leads || 0) - (a.leads || 0))

  const campaignPerformance = Object.values(campaignMap)
    .map(c => ({
      ...c,
      spend: Math.round(c.spend * 100) / 100,
      cpl: c.leads > 0 ? Math.round((c.spend / c.leads) * 100) / 100 : null,
      lead_percent: totalLeads > 0 ? Math.round((c.leads / totalLeads) * 1000) / 10 : 0,
      spend_percent: totalSpend > 0 ? Math.round((c.spend / totalSpend) * 1000) / 10 : 0,
    }))
    .sort((a, b) => (b.leads || 0) - (a.leads || 0))

  return {
    summary: {
      impressions: totalImpressions,
      clicks: totalClicks,
      spend: Math.round(totalSpend * 100) / 100,
      leads: totalLeads,
      cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : 0,
      ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
      conversion_rate: totalClicks > 0 ? Math.round((totalLeads / totalClicks) * 10000) / 100 : 0,
    },
    dailyStats,
    adPerformance,
    campaignPerformance,
  }
}

// ─── Change Rate ────────────────────────────────────────────

function calcChange(current: number, previous: number): number {
  if (!previous || previous === 0) return 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

// ─── AI Insights (Gemini) ───────────────────────────────────

async function generateAIInsight(
  reportType: string,
  weekStart: string,
  weekEnd: string,
  data: ReturnType<typeof aggregateData>,
  comparison: Record<string, number> | null
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.log('GEMINI_API_KEY not set, skipping AI insights')
    return null
  }

  const s = data.summary
  const typeLabel = reportType === 'monthly' ? '월간' : '주간'

  const dailyLines = data.dailyStats
    .map(d => `  ${d.date}: 노출 ${d.impressions}, 클릭 ${d.clicks}, 리드 ${d.leads}, 지출 $${d.spend.toFixed(2)}`)
    .join('\n')

  const adLines = data.adPerformance
    .slice(0, 10)
    .map(a => `  ${a.ad_name || a.ad_id}: 리드 ${a.leads}, 지출 $${a.spend}, CPL ${a.cpl ? '$' + a.cpl : 'N/A'}, CTR ${a.ctr}%`)
    .join('\n')

  let comparisonText = ''
  if (comparison) {
    comparisonText = `\n## 이전 기간 비교\n- 이전 리드: ${comparison.prev_leads}건, 이전 지출: $${comparison.prev_spend}, 이전 CPL: $${comparison.prev_cpl}`
  }

  const prompt = `당신은 Meta 광고 성과 분석 전문가입니다. BAS(비즈액터스쿨) ${typeLabel} 리포트 데이터를 분석해주세요.

## 리포트 정보
- 고객사: BAS (비즈액터스쿨) - 보험 영업 교육 (리드 수집형)
- 기간: ${weekStart} ~ ${weekEnd}

## 종합 성과
- 노출: ${s.impressions.toLocaleString()}회, 클릭: ${s.clicks.toLocaleString()}회
- 리드: ${s.leads}건, 지출: $${s.spend.toLocaleString()}, CPL: $${s.cpl}, CTR: ${s.ctr}%
${comparisonText}

## 일별 성과
${dailyLines || '(없음)'}

## 광고별 성과
${adLines || '(없음)'}

---
마크다운 텍스트로 분석하세요 (JSON 아닌 순수 텍스트):

### 📊 성과 종합 분석
(3~4문장 요약, 이전 기간 대비 변화 포함)

### 💡 핵심 인사이트
(번호 리스트 5~6개, 구체적 수치 포함)

### 🎯 즉시 실행 가능한 액션
(번호 리스트 2~3개, 제목 + 설명)

모든 금액은 달러($). 구체적 수치 필수.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    )
    const result = await res.json()
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text
    return text?.trim() || null
  } catch (e) {
    console.error('AI insight generation failed:', e)
    return null
  }
}

// ─── Save Report ────────────────────────────────────────────

async function saveReport(
  reportType: string,
  weekStart: string,
  weekEnd: string,
  data: ReturnType<typeof aggregateData>,
  prevData: ReturnType<typeof aggregateData> | null,
  aiInsights: string | null
) {
  const supabase = getSupabaseAdmin()

  // Check existing
  const { data: existing } = await supabase
    .from('telegram_reports')
    .select('id')
    .eq('client_id', BAS_CLIENT_ID)
    .eq('report_type', reportType)
    .eq('week_start', weekStart)
    .eq('week_end', weekEnd)
    .maybeSingle()

  if (existing) {
    return { id: existing.id, action: 'already_exists' as const }
  }

  const spendChange = prevData ? calcChange(data.summary.spend, prevData.summary.spend) : 0
  const leadsChange = prevData ? calcChange(data.summary.leads, prevData.summary.leads) : 0
  const cplChange = prevData ? calcChange(data.summary.cpl, prevData.summary.cpl) : 0
  const ctrChange = prevData ? calcChange(data.summary.ctr, prevData.summary.ctr) : 0

  const typeLabel = reportType === 'monthly' ? '월간' : '주간'
  const messageText = `📊 BAS ${typeLabel} 리포트 (${weekStart} ~ ${weekEnd})\n` +
    `지출: $${data.summary.spend.toLocaleString()} | 리드: ${data.summary.leads}건 | CPL: $${data.summary.cpl}`

  const record = {
    client_id: BAS_CLIENT_ID,
    report_type: reportType,
    week_start: weekStart,
    week_end: weekEnd,
    message_text: messageText,
    total_spend: data.summary.spend,
    total_leads: data.summary.leads,
    total_impressions: data.summary.impressions,
    total_clicks: data.summary.clicks,
    avg_cpl: data.summary.cpl,
    avg_ctr: data.summary.ctr,
    spend_change: spendChange,
    leads_change: leadsChange,
    cpl_change: cplChange,
    ctr_change: ctrChange,
    ai_insights: aiInsights,
    report_data: {
      summary: data.summary,
      comparison: prevData ? {
        prev_cpl: prevData.summary.cpl,
        prev_ctr: prevData.summary.ctr,
        prev_leads: prevData.summary.leads,
        prev_spend: prevData.summary.spend,
        prev_clicks: prevData.summary.clicks,
        prev_impressions: prevData.summary.impressions,
      } : null,
      daily_stats: data.dailyStats,
      ad_performance: data.adPerformance,
      campaign_performance: data.campaignPerformance,
    },
    sent_at: new Date().toISOString(),
  }

  const { data: result, error } = await supabase
    .from('telegram_reports')
    .insert(record)
    .select('id')
    .single()

  if (error) throw new Error(`저장 실패: ${error.message}`)

  return { id: result.id, action: 'created' as const }
}

// ─── Date Helpers ───────────────────────────────────────────

function getLastWeekRange(): { start: string; end: string } {
  const today = new Date()
  const dayOfWeek = today.getUTCDay()
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const lastMonday = new Date(today)
  lastMonday.setUTCDate(today.getUTCDate() - daysToLastMonday - 7)
  const lastSunday = new Date(lastMonday)
  lastSunday.setUTCDate(lastMonday.getUTCDate() + 6)

  return {
    start: lastMonday.toISOString().split('T')[0],
    end: lastSunday.toISOString().split('T')[0],
  }
}

function getLastMonthRange(): { start: string; end: string; year: number; month: number } {
  const today = new Date()
  let year = today.getUTCFullYear()
  let month = today.getUTCMonth() // 0-indexed, so this is already "last month" if today is 1st

  if (month === 0) {
    month = 12
    year -= 1
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0) // last day
  const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

  return { start: startDate, end: endDateStr, year, month }
}

function getPrevWeekRange(startDate: string): { start: string; end: string } {
  const d = new Date(startDate)
  d.setDate(d.getDate() - 7)
  const prevEnd = new Date(startDate)
  prevEnd.setDate(prevEnd.getDate() - 1)
  return {
    start: d.toISOString().split('T')[0],
    end: prevEnd.toISOString().split('T')[0],
  }
}

function getPrevMonthRange(year: number, month: number): { start: string; end: string } {
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const endDate = new Date(prevYear, prevMonth, 0)
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  return { start, end }
}

// ─── Create Report (Weekly or Monthly) ──────────────────────

async function createReport(type: 'weekly' | 'monthly') {
  let weekStart: string, weekEnd: string
  let prevStart: string, prevEnd: string

  if (type === 'weekly') {
    const range = getLastWeekRange()
    weekStart = range.start
    weekEnd = range.end
    const prev = getPrevWeekRange(weekStart)
    prevStart = prev.start
    prevEnd = prev.end
  } else {
    const range = getLastMonthRange()
    weekStart = range.start
    weekEnd = range.end
    const prev = getPrevMonthRange(range.year, range.month)
    prevStart = prev.start
    prevEnd = prev.end
  }

  console.log(`📊 BAS ${type} 리포트: ${weekStart} ~ ${weekEnd}`)

  // Fetch current period
  const records = await fetchAirtableRecords(weekStart, weekEnd)
  if (records.length === 0) {
    console.log('데이터 없음 - 스킵')
    return { type, period: `${weekStart} ~ ${weekEnd}`, action: 'no_data' as const }
  }

  const data = aggregateData(records)

  // Fetch previous period for comparison
  const prevRecords = await fetchAirtableRecords(prevStart, prevEnd)
  const prevData = prevRecords.length > 0 ? aggregateData(prevRecords) : null

  // Generate AI insights
  const comparison = prevData ? {
    prev_leads: prevData.summary.leads,
    prev_spend: prevData.summary.spend,
    prev_cpl: prevData.summary.cpl,
  } : null
  const aiInsights = await generateAIInsight(type, weekStart, weekEnd, data, comparison)

  // Save
  const result = await saveReport(type, weekStart, weekEnd, data, prevData, aiInsights)

  console.log(`✅ ${type}: ${result.action} (${result.id})`)

  return {
    type,
    period: `${weekStart} ~ ${weekEnd}`,
    ...result,
    summary: {
      leads: data.summary.leads,
      spend: data.summary.spend,
      cpl: data.summary.cpl,
    },
    hasAIInsights: !!aiInsights,
  }
}

// ─── GET Handler ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const typeParam = url.searchParams.get('type')

  // Determine what to create
  const today = new Date()
  const dayOfWeek = today.getUTCDay() // 0=Sun, 1=Mon
  const dayOfMonth = today.getUTCDate()

  const tasks: ('weekly' | 'monthly')[] = []

  if (typeParam === 'weekly' || typeParam === 'monthly') {
    tasks.push(typeParam)
  } else {
    // Auto-detect: Monday → weekly, 1st → monthly, both if Monday + 1st
    if (dayOfWeek === 1) tasks.push('weekly')
    if (dayOfMonth === 1) tasks.push('monthly')
    // manual trigger without type → create both
    if (tasks.length === 0) tasks.push('weekly')
  }

  console.log(`🚀 BAS 리포트 Cron: ${tasks.join(', ')}`)

  const results = []

  try {
    for (const type of tasks) {
      const result = await createReport(type)
      results.push(result)
    }

    // Telegram notification
    const created = results.filter(r => r.action === 'created')
    if (created.length > 0) {
      const lines = created.map(r => {
        const s = 'summary' in r ? r.summary : null
        return `📊 ${r.type === 'monthly' ? '월간' : '주간'} ${r.period}\n` +
          (s ? `   리드: ${s.leads}건, 지출: $${s.spend}, CPL: $${s.cpl}` : '') +
          (r.hasAIInsights ? '\n   🤖 AI 인사이트 포함' : '')
      }).join('\n\n')

      await sendTelegram(`✅ <b>BAS 리포트 자동 생성 완료</b>\n\n${lines}`)
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('BAS report cron error:', error)
    await sendTelegram(`❌ <b>BAS 리포트 자동 생성 실패</b>\n\n${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
