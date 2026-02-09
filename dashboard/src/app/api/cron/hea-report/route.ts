/**
 * Vercel Cron - HEA 판교 주간/월간 리포트 자동 생성 + AI 인사이트
 *
 * 스케줄:
 *   주간: 매주 월요일 09:00 KST (UTC 00:00) → 지난주 리포트
 *   월간: 매월 1일 09:00 KST (UTC 00:00) → 지난달 리포트
 *
 * 데이터 소스: Airtable (이미 KRW 변환됨)
 * 리포트 저장: Airtable polarad_reports
 *
 * GET /api/cron/hea-report?type=weekly
 * GET /api/cron/hea-report?type=monthly
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  fetchAirtableData,
  getReports,
  createReport as createAirtableReport,
  type AirtableAdRecord,
} from '@/lib/airtable'

export const maxDuration = 60

const HEA_CLIENT_ID = 'h-e-a-판교'
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
  const naverRecords = records.filter(r => r.source !== 'meta')

  const metaTotals = {
    impressions: metaRecords.reduce((s, r) => s + r.impressions, 0),
    clicks: metaRecords.reduce((s, r) => s + r.clicks, 0),
    spend: metaRecords.reduce((s, r) => s + r.spend, 0),
    videoViews: metaRecords.reduce((s, r) => s + (r.video_views || 0), 0),
    avgWatchTime: metaRecords.length > 0
      ? metaRecords.reduce((s, r) => s + (r.avg_watch_time || 0), 0) / metaRecords.filter(r => r.avg_watch_time).length || 0
      : 0,
  }

  const naverTotals = {
    impressions: naverRecords.reduce((s, r) => s + r.impressions, 0),
    clicks: naverRecords.reduce((s, r) => s + r.clicks, 0),
    cost: naverRecords.reduce((s, r) => s + r.spend, 0),
  }

  // 키워드별 집계 (네이버)
  const keywordStats: Record<string, { impressions: number; clicks: number; cost: number }> = {}
  naverRecords.forEach((r) => {
    const kw = r.keywords || r.campaign_name || 'unknown'
    if (!keywordStats[kw]) keywordStats[kw] = { impressions: 0, clicks: 0, cost: 0 }
    keywordStats[kw].impressions += r.impressions
    keywordStats[kw].clicks += r.clicks
    keywordStats[kw].cost += r.spend
  })

  const topKeywords = Object.entries(keywordStats)
    .map(([keyword, stats]) => ({ keyword, ...stats }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)

  const totalImpressions = metaTotals.impressions + naverTotals.impressions
  const totalClicks = metaTotals.clicks + naverTotals.clicks
  const totalSpend = metaTotals.spend + naverTotals.cost // 이미 KRW
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'
  const cpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0

  // 일별 데이터 (Meta 기준)
  const dailyMap: Record<string, { impressions: number; clicks: number; spend: number }> = {}
  metaRecords.forEach((r) => {
    if (!dailyMap[r.date]) dailyMap[r.date] = { impressions: 0, clicks: 0, spend: 0 }
    dailyMap[r.date].impressions += r.impressions
    dailyMap[r.date].clicks += r.clicks
    dailyMap[r.date].spend += r.spend
  })

  const dailyStats = Object.entries(dailyMap)
    .map(([date, d]) => ({
      date,
      ...d,
      ctr: d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0.00',
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    metaTotals,
    naverTotals,
    totalImpressions,
    totalClicks,
    totalSpend,
    ctr,
    cpc,
    dailyStats,
    topKeywords,
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
    .map(d => `  ${d.date}: 노출 ${d.impressions.toLocaleString()}, 클릭 ${d.clicks}, 비용 ${d.spend.toLocaleString()}원, CTR ${d.ctr}%`)
    .join('\n')

  const naverLines = data.topKeywords
    .map(k => `  ${k.keyword}: 노출 ${k.impressions.toLocaleString()}, 클릭 ${k.clicks}, 비용 ${k.cost.toLocaleString()}원`)
    .join('\n')

  let comparisonText = ''
  if (prevData) {
    const impChange = calcChange(data.totalImpressions, prevData.totalImpressions)
    const clkChange = calcChange(data.totalClicks, prevData.totalClicks)
    const spendChange = calcChange(data.totalSpend, prevData.totalSpend)
    comparisonText = `\n## 이전 기간 비교\n- 노출: ${impChange > 0 ? '+' : ''}${impChange}%, 클릭: ${clkChange > 0 ? '+' : ''}${clkChange}%, 비용: ${spendChange > 0 ? '+' : ''}${spendChange}%`
  }

  const prompt = `당신은 Meta/Naver 광고 성과 분석 전문가입니다. H.E.A 판교(식당, 트래픽 캠페인) ${typeLabel} 리포트 데이터를 분석해주세요.

## 리포트 정보
- 고객사: H.E.A 판교 (식당, 트래픽 목적)
- 기간: ${startDate} ~ ${endDate}
- 주요 지표: 노출, 클릭, CTR, CPC, 영상조회수 (리드 아님!)

## 종합 성과
- Meta: 노출 ${data.metaTotals.impressions.toLocaleString()}회, 클릭 ${data.metaTotals.clicks}회, 비용 ${data.metaTotals.spend.toLocaleString()}원
- 영상 조회수: ${data.metaTotals.videoViews.toLocaleString()}회
- Naver: 노출 ${data.naverTotals.impressions.toLocaleString()}회, 클릭 ${data.naverTotals.clicks}회, 비용 ${data.naverTotals.cost.toLocaleString()}원
- 합계: 노출 ${data.totalImpressions.toLocaleString()}회, 클릭 ${data.totalClicks}회, CTR ${data.ctr}%, CPC ${data.cpc.toLocaleString()}원
${comparisonText}

## 일별 Meta 성과
${dailyLines || '(없음)'}

## Naver 상위 키워드
${naverLines || '(없음)'}

---
마크다운 텍스트로 분석하세요 (JSON 아닌 순수 텍스트):

### 📊 성과 종합 분석
(3~4문장 요약, 이전 기간 대비 변화 포함)

### 💡 핵심 인사이트
(번호 리스트 5~6개, 구체적 수치 포함)

### 🎯 즉시 실행 가능한 액션
(번호 리스트 2~3개, 제목 + 설명)

모든 금액은 원(₩). 구체적 수치 필수. 리드 관련 분석 금지 (이 클라이언트는 트래픽 캠페인).`

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
  let month = today.getUTCMonth() // 0-indexed

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
    clientId: HEA_CLIENT_ID,
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

  console.log(`📊 HEA ${type} 리포트: ${startDate} ~ ${endDate}`)

  // Duplicate check
  const existingId = await checkExisting(type, year, month, week)
  if (existingId) {
    console.log(`⚠️ 이미 존재: ${existingId}`)
    return { type, period: `${startDate} ~ ${endDate}`, id: existingId, action: 'already_exists' as const }
  }

  // Fetch current period data from Airtable (이미 KRW)
  const records = await fetchAirtableData('hea-pangyo', startDate, endDate)
  if (records.length === 0) {
    console.log('데이터 없음 - 스킵')
    return { type, period: `${startDate} ~ ${endDate}`, action: 'no_data' as const }
  }

  const data = aggregateData(records)

  // Fetch previous period
  const prevRecords = await fetchAirtableData('hea-pangyo', prevStart, prevEnd)
  const prevData = prevRecords.length > 0 ? aggregateData(prevRecords) : null

  // Generate AI insights
  const aiInsightText = await generateAIInsight(type, startDate, endDate, data, prevData)

  // Build highlights
  const impChange = prevData ? calcChange(data.totalImpressions, prevData.totalImpressions) : 0
  const clkChange = prevData ? calcChange(data.totalClicks, prevData.totalClicks) : 0
  const spendChange = prevData ? calcChange(data.totalSpend, prevData.totalSpend) : 0

  const maxClkDay = data.dailyStats.length > 0
    ? data.dailyStats.reduce((max, d) => (d.clicks > max.clicks ? d : max))
    : null
  const maxCtrDay = data.dailyStats.length > 0
    ? data.dailyStats.reduce((max, d) => (parseFloat(d.ctr) > parseFloat(max.ctr) ? d : max))
    : null

  const periodLabel = type === 'monthly'
    ? `${month}월`
    : `${month}월 ${week}주차(${startDate.slice(5)}~${endDate.slice(5)})`

  const aiInsights = {
    summary: aiInsightText
      ? `AI 생성 인사이트 포함. ${periodLabel}, 총 노출 ${data.totalImpressions.toLocaleString()}회, 클릭 ${data.totalClicks.toLocaleString()}회, CTR ${data.ctr}%.`
      : `${periodLabel}, 총 노출 ${data.totalImpressions.toLocaleString()}회, 클릭 ${data.totalClicks.toLocaleString()}회로 CTR ${data.ctr}%를 기록했습니다.${prevData ? ` 전 기간 대비 노출 ${impChange > 0 ? '+' : ''}${impChange}%, 클릭 ${clkChange > 0 ? '+' : ''}${clkChange}% 변동.` : ''}`,
    aiGeneratedText: aiInsightText || null,
    highlights: [
      `CTR ${data.ctr}%로 업계 평균 대비 ${parseFloat(data.ctr) >= 2 ? '우수한' : '양호한'} 성과`,
      maxClkDay ? `${maxClkDay.date} 클릭 ${maxClkDay.clicks}건으로 기간 내 최다` : null,
      maxCtrDay ? `${maxCtrDay.date} CTR ${maxCtrDay.ctr}%로 기간 내 최고 효율` : null,
      data.metaTotals.videoViews > 0 ? `영상 조회수 ${data.metaTotals.videoViews.toLocaleString()}회` : null,
      `클릭당 비용 약 ${data.cpc.toLocaleString()}원으로 효율적 집행`,
    ].filter((v): v is string => v !== null),
    platforms: {
      meta: {
        impressions: data.metaTotals.impressions,
        clicks: data.metaTotals.clicks,
        spend: data.metaTotals.spend,
        videoViews: data.metaTotals.videoViews,
      },
      naver: {
        impressions: data.naverTotals.impressions,
        clicks: data.naverTotals.clicks,
        spend: data.naverTotals.cost,
        topKeywords: data.topKeywords,
      },
    },
    comparison: prevData ? {
      impressions: { current: data.totalImpressions, previous: prevData.totalImpressions, change: impChange },
      clicks: { current: data.totalClicks, previous: prevData.totalClicks, change: clkChange },
      spend: { current: data.totalSpend, previous: prevData.totalSpend, change: spendChange },
    } : null,
    recommendations: [
      {
        type: 'budget' as const,
        platform: 'meta' as const,
        priority: 'high' as const,
        title: '현재 성과 유지',
        description: `CTR ${data.ctr}%는 ${parseFloat(data.ctr) >= 2 ? '우수한' : '양호한'} 성과입니다.`,
      },
    ],
    generatedAt: new Date().toISOString(),
  }

  // Save to Airtable
  const report = await createAirtableReport({
    client_id: HEA_CLIENT_ID,
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

  console.log(`✅ HEA ${type}: created (${report.id})`)

  return {
    type,
    period: `${startDate} ~ ${endDate}`,
    id: report.id,
    action: 'created' as const,
    summary: {
      impressions: data.totalImpressions,
      clicks: data.totalClicks,
      spend: data.totalSpend,
      ctr: data.ctr,
      cpc: data.cpc,
      videoViews: data.metaTotals.videoViews,
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

  console.log(`🚀 HEA 리포트 Cron: ${tasks.join(', ')}`)

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
          (s ? `   노출: ${s.impressions?.toLocaleString()}회, 클릭: ${s.clicks?.toLocaleString()}회\n   CTR: ${s.ctr}%, CPC: ${s.cpc?.toLocaleString()}원\n   광고비: 약 ${Math.round((s.spend || 0) / 10000)}만원` : '') +
          (r.hasAIInsights ? '\n   🤖 AI 인사이트 포함' : '')
      }).join('\n\n')

      await sendTelegram(`✅ <b>HEA 판교 리포트 자동 생성 완료</b>\n\n${lines}`)
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('HEA report cron error:', error)
    await sendTelegram(`❌ <b>HEA 판교 리포트 자동 생성 실패</b>\n\n${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
