/**
 * Vercel Cron - 나라똔 주간/월간 리포트 자동 생성 + AI 인사이트
 *
 * 스케줄:
 *   주간: 매주 월요일 09:00 KST (UTC 00:00) → 지난주 리포트
 *   월간: 매월 1일 09:00 KST (UTC 00:00) → 지난달 리포트
 *
 * 데이터 소스: Airtable (이미 KRW 변환됨)
 * 리포트 저장: Airtable polarad_reports
 *
 * GET /api/cron/naratton-report?type=weekly
 * GET /api/cron/naratton-report?type=monthly
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  fetchAirtableData,
  getReports,
  createReport as createAirtableReport,
  type AirtableAdRecord,
} from '@/lib/airtable'

export const maxDuration = 60

const NARATTON_CLIENT_ID = '나라똔'
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

// ─── Aggregate ──────────────────────────────────────────────

function aggregateData(records: AirtableAdRecord[]) {
  const metaRecords = records.filter(r => r.source === 'meta')

  const totalImpressions = metaRecords.reduce((s, r) => s + r.impressions, 0)
  const totalClicks = metaRecords.reduce((s, r) => s + r.clicks, 0)
  const totalSpend = metaRecords.reduce((s, r) => s + r.spend, 0)
  const totalLeads = metaRecords.reduce((s, r) => s + (r.leads || 0), 0)

  // 캠페인별 집계
  const campaignMap: Record<string, { campaign_name: string; impressions: number; clicks: number; spend: number; leads: number }> = {}
  metaRecords.forEach(r => {
    const name = r.campaign_name || 'unknown'
    if (!campaignMap[name]) campaignMap[name] = { campaign_name: name, impressions: 0, clicks: 0, spend: 0, leads: 0 }
    campaignMap[name].impressions += r.impressions
    campaignMap[name].clicks += r.clicks
    campaignMap[name].spend += r.spend
    campaignMap[name].leads += (r.leads || 0)
  })

  const campaignPerformance = Object.values(campaignMap)
    .map(c => ({
      ...c,
      cpl: c.leads > 0 ? Math.round(c.spend / c.leads) : null,
      ctr: c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 10000) / 100 : 0,
    }))
    .sort((a, b) => (b.leads || 0) - (a.leads || 0))

  // 일별 데이터
  const dailyMap: Record<string, { impressions: number; clicks: number; spend: number; leads: number }> = {}
  metaRecords.forEach(r => {
    if (!dailyMap[r.date]) dailyMap[r.date] = { impressions: 0, clicks: 0, spend: 0, leads: 0 }
    dailyMap[r.date].impressions += r.impressions
    dailyMap[r.date].clicks += r.clicks
    dailyMap[r.date].spend += r.spend
    dailyMap[r.date].leads += (r.leads || 0)
  })

  const dailyStats = Object.entries(dailyMap)
    .map(([date, d]) => ({
      date,
      ...d,
      ctr: d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0.00',
      cpl: d.leads > 0 ? Math.round(d.spend / d.leads) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'
  const cpl = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0
  const cpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0

  return {
    totalImpressions,
    totalClicks,
    totalSpend,
    totalLeads,
    ctr,
    cpl,
    cpc,
    dailyStats,
    campaignPerformance,
  }
}

// ─── Change Rate ────────────────────────────────────────────

function calcChange(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100 * 10) / 10
}

// ─── AI Insights (Gemini) ───────────────────────────────────

async function generateAIInsight(
  reportType: string,
  startDate: string,
  endDate: string,
  data: ReturnType<typeof aggregateData>,
  prevData: ReturnType<typeof aggregateData> | null
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.log('GEMINI_API_KEY not set, skipping AI insights')
    return null
  }

  const typeLabel = reportType === 'monthly' ? '월간' : '주간'

  const dailyLines = data.dailyStats
    .map(d => `  ${d.date}: 노출 ${d.impressions.toLocaleString()}, 클릭 ${d.clicks}, 리드 ${d.leads}, 비용 ${d.spend.toLocaleString()}원, CPL ${d.cpl ? d.cpl.toLocaleString() + '원' : 'N/A'}`)
    .join('\n')

  const campaignLines = data.campaignPerformance
    .slice(0, 10)
    .map(c => `  ${c.campaign_name}: 리드 ${c.leads}, 비용 ${c.spend.toLocaleString()}원, CPL ${c.cpl ? c.cpl.toLocaleString() + '원' : 'N/A'}, CTR ${c.ctr}%`)
    .join('\n')

  let comparisonText = ''
  if (prevData) {
    const impChange = calcChange(data.totalImpressions, prevData.totalImpressions)
    const leadChange = calcChange(data.totalLeads, prevData.totalLeads)
    const spendChange = calcChange(data.totalSpend, prevData.totalSpend)
    const cplChange = calcChange(data.cpl, prevData.cpl)
    comparisonText = `\n## 이전 기간 비교\n- 노출: ${impChange > 0 ? '+' : ''}${impChange}%, 리드: ${leadChange > 0 ? '+' : ''}${leadChange}%, 비용: ${spendChange > 0 ? '+' : ''}${spendChange}%, CPL: ${cplChange > 0 ? '+' : ''}${cplChange}%`
  }

  const prompt = `당신은 Meta 광고 성과 분석 전문가입니다. 나라똔(쇼핑몰, 리드 수집 캠페인) ${typeLabel} 리포트 데이터를 분석해주세요.

## 리포트 정보
- 고객사: 나라똔 (쇼핑몰, 리드 수집형)
- 기간: ${startDate} ~ ${endDate}
- 주요 지표: 리드(leads), CPL(리드당비용), 노출, 클릭, CTR

## 종합 성과
- 노출: ${data.totalImpressions.toLocaleString()}회, 클릭: ${data.totalClicks.toLocaleString()}회
- 리드: ${data.totalLeads}건, 비용: ${data.totalSpend.toLocaleString()}원
- CPL: ${data.cpl.toLocaleString()}원, CTR: ${data.ctr}%, CPC: ${data.cpc.toLocaleString()}원
${comparisonText}

## 일별 성과
${dailyLines || '(없음)'}

## 캠페인별 성과
${campaignLines || '(없음)'}

---
마크다운 텍스트로 분석하세요 (JSON 아닌 순수 텍스트):

### 📊 성과 종합 분석
(3~4문장 요약, 이전 기간 대비 변화 포함)

### 💡 핵심 인사이트
(번호 리스트 5~6개, 구체적 수치 포함)

### 🎯 즉시 실행 가능한 액션
(번호 리스트 2~3개, 제목 + 설명)

모든 금액은 원(₩). 구체적 수치 필수.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
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

// ─── Date Helpers ───────────────────────────────────────────

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr)
  return Math.ceil(date.getDate() / 7)
}

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
  let month = today.getUTCMonth()

  if (month === 0) {
    month = 12
    year -= 1
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0)
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

// ─── Duplicate Check ────────────────────────────────────────

async function checkExisting(reportType: string, year: number, month: number, week: number | null): Promise<string | null> {
  const reports = await getReports({
    clientId: NARATTON_CLIENT_ID,
    reportType: reportType as 'monthly' | 'weekly',
    year,
    month,
  })

  if (reportType === 'weekly' && week !== null) {
    const match = reports.find(r => r.week === week)
    return match?.id || null
  }

  return reports.length > 0 ? reports[0].id : null
}

// ─── Create Report ──────────────────────────────────────────

async function handleReport(type: 'weekly' | 'monthly') {
  let startDate: string, endDate: string
  let prevStart: string, prevEnd: string

  if (type === 'weekly') {
    const range = getLastWeekRange()
    startDate = range.start
    endDate = range.end
    const prev = getPrevWeekRange(startDate)
    prevStart = prev.start
    prevEnd = prev.end
  } else {
    const range = getLastMonthRange()
    startDate = range.start
    endDate = range.end
    const prev = getPrevMonthRange(range.year, range.month)
    prevStart = prev.start
    prevEnd = prev.end
  }

  const year = parseInt(startDate.split('-')[0])
  const month = parseInt(startDate.split('-')[1])
  const week = type === 'weekly' ? getWeekNumber(startDate) : null

  console.log(`📊 나라똔 ${type} 리포트: ${startDate} ~ ${endDate}`)

  // Duplicate check
  const existingId = await checkExisting(type, year, month, week)
  if (existingId) {
    console.log(`⚠️ 이미 존재: ${existingId}`)
    return { type, period: `${startDate} ~ ${endDate}`, id: existingId, action: 'already_exists' as const }
  }

  // Fetch current period data from Airtable (이미 KRW)
  const records = await fetchAirtableData('naratton', startDate, endDate)
  if (records.length === 0) {
    console.log('데이터 없음 - 스킵')
    return { type, period: `${startDate} ~ ${endDate}`, action: 'no_data' as const }
  }

  const data = aggregateData(records)

  // Fetch previous period
  const prevRecords = await fetchAirtableData('naratton', prevStart, prevEnd)
  const prevData = prevRecords.length > 0 ? aggregateData(prevRecords) : null

  // Generate AI insights
  const aiInsightText = await generateAIInsight(type, startDate, endDate, data, prevData)

  // Build highlights
  const impChange = prevData ? calcChange(data.totalImpressions, prevData.totalImpressions) : 0
  const leadChange = prevData ? calcChange(data.totalLeads, prevData.totalLeads) : 0
  const spendChange = prevData ? calcChange(data.totalSpend, prevData.totalSpend) : 0
  const cplChange = prevData ? calcChange(data.cpl, prevData.cpl) : 0

  const maxLeadDay = data.dailyStats.length > 0
    ? data.dailyStats.reduce((max, d) => (d.leads > max.leads ? d : max))
    : null
  const bestCplCampaign = data.campaignPerformance.find(c => c.cpl !== null && c.leads > 0)

  const periodLabel = type === 'monthly'
    ? `${month}월`
    : `${month}월 ${week}주차(${startDate.slice(5)}~${endDate.slice(5)})`

  const aiInsights = {
    summary: aiInsightText
      ? `AI 생성 인사이트 포함. ${periodLabel}, 총 리드 ${data.totalLeads}건, CPL ${data.cpl.toLocaleString()}원, 지출 ${data.totalSpend.toLocaleString()}원.`
      : `${periodLabel}, 총 리드 ${data.totalLeads}건, CPL ${data.cpl.toLocaleString()}원, 지출 ${data.totalSpend.toLocaleString()}원.${prevData ? ` 전 기간 대비 리드 ${leadChange > 0 ? '+' : ''}${leadChange}%, CPL ${cplChange > 0 ? '+' : ''}${cplChange}% 변동.` : ''}`,
    aiGeneratedText: aiInsightText || null,
    highlights: [
      `리드 ${data.totalLeads}건, CPL ${data.cpl.toLocaleString()}원`,
      maxLeadDay ? `${maxLeadDay.date} 리드 ${maxLeadDay.leads}건으로 기간 내 최다` : null,
      bestCplCampaign ? `${bestCplCampaign.campaign_name} 캠페인 CPL ${bestCplCampaign.cpl?.toLocaleString()}원으로 최우수` : null,
      `CTR ${data.ctr}%, CPC ${data.cpc.toLocaleString()}원`,
      prevData ? `전 기간 대비 리드 ${leadChange > 0 ? '+' : ''}${leadChange}%, CPL ${cplChange > 0 ? '+' : ''}${cplChange}%` : null,
    ].filter((v): v is string => v !== null),
    platforms: {
      meta: {
        impressions: data.totalImpressions,
        clicks: data.totalClicks,
        spend: data.totalSpend,
        leads: data.totalLeads,
        cpl: data.cpl,
      },
    },
    comparison: prevData ? {
      impressions: { current: data.totalImpressions, previous: prevData.totalImpressions, change: impChange },
      clicks: { current: data.totalClicks, previous: prevData.totalClicks, change: calcChange(data.totalClicks, prevData.totalClicks) },
      spend: { current: data.totalSpend, previous: prevData.totalSpend, change: spendChange },
      leads: { current: data.totalLeads, previous: prevData.totalLeads, change: leadChange },
      cpl: { current: data.cpl, previous: prevData.cpl, change: cplChange },
    } : null,
    campaignPerformance: data.campaignPerformance.slice(0, 5),
    recommendations: [
      {
        type: 'budget' as const,
        platform: 'meta' as const,
        priority: 'high' as const,
        title: '리드 효율 분석',
        description: `CPL ${data.cpl.toLocaleString()}원으로 ${data.cpl <= 10000 ? '우수한' : '양호한'} 효율을 보이고 있습니다.`,
      },
    ],
    generatedAt: new Date().toISOString(),
  }

  // Save to Airtable
  const report = await createAirtableReport({
    client_id: NARATTON_CLIENT_ID,
    report_type: type,
    period_start: startDate,
    period_end: endDate,
    year,
    month,
    week,
    status: 'published',
    published_at: new Date().toISOString(),
    ai_insights: aiInsights,
    ai_generated_at: new Date().toISOString(),
  })

  if (!report) {
    throw new Error('Airtable 리포트 저장 실패')
  }

  console.log(`✅ 나라똔 ${type}: created (${report.id})`)

  return {
    type,
    period: `${startDate} ~ ${endDate}`,
    id: report.id,
    action: 'created' as const,
    summary: {
      impressions: data.totalImpressions,
      clicks: data.totalClicks,
      spend: data.totalSpend,
      leads: data.totalLeads,
      cpl: data.cpl,
      ctr: data.ctr,
    },
    hasAIInsights: !!aiInsightText,
  }
}

// ─── GET Handler ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const typeParam = url.searchParams.get('type')

  const today = new Date()
  const dayOfWeek = today.getUTCDay()
  const dayOfMonth = today.getUTCDate()

  const tasks: ('weekly' | 'monthly')[] = []

  if (typeParam === 'weekly' || typeParam === 'monthly') {
    tasks.push(typeParam)
  } else {
    if (dayOfWeek === 1) tasks.push('weekly')
    if (dayOfMonth === 1) tasks.push('monthly')
    if (tasks.length === 0) tasks.push('weekly')
  }

  console.log(`🚀 나라똔 리포트 Cron: ${tasks.join(', ')}`)

  const results = []

  try {
    for (const type of tasks) {
      const result = await handleReport(type)
      results.push(result)
    }

    // Telegram (only for newly created)
    const created = results.filter(r => r.action === 'created')
    if (created.length > 0) {
      const lines = created.map(r => {
        const s = 'summary' in r ? r.summary : null
        const typeLabel = r.type === 'monthly' ? '월간' : '주간'
        return `📊 ${typeLabel} ${r.period}\n` +
          (s ? `   리드: ${s.leads}건, CPL: ${s.cpl?.toLocaleString()}원\n   광고비: ${Math.round((s.spend || 0) / 10000)}만원, CTR: ${s.ctr}%` : '') +
          (r.hasAIInsights ? '\n   🤖 AI 인사이트 포함' : '')
      }).join('\n\n')

      await sendTelegram(`✅ <b>나라똔 리포트 자동 생성 완료</b>\n\n${lines}`)
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Naratton report cron error:', error)
    await sendTelegram(`❌ <b>나라똔 리포트 자동 생성 실패</b>\n\n${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
