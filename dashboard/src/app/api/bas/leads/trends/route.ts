/**
 * BAS 리드 트렌드 API
 * GET /api/bas/leads/trends
 *
 * 일별 접수추이, 주간/월간 변화율, 캠페인 성과
 * 날짜 파라미터: startDate, endDate (YYYY-MM-DD)
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchBasLeads } from '@/lib/airtable-bas-leads'
import { fetchAirtableData } from '@/lib/airtable'
import type {
  BasLeadTrends,
  DailyLeadCount,
  DailyLeadWithMeta,
  WeeklyChange,
  CampaignPerformance,
} from '@/types/bas-leads'
import type { LeadStatus } from '@/types/bas-leads'

// KST (UTC+9) 기준 날짜 문자열 반환
function toKSTDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

// n일 전 KST 날짜 문자열
function daysAgoKST(n: number): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  kst.setDate(kst.getDate() - n)
  return kst.toISOString().split('T')[0]
}

// KST 기준 오늘 날짜
function todayKST(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

// n일 전 UTC Date (비교용)
function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const startDate = searchParams.get('startDate') || daysAgoKST(29)
    const endDate = searchParams.get('endDate') || todayKST()

    const { leads: allLeads } = await fetchBasLeads({ pageSize: 10000 })

    // 블랙리스트 제외한 유효 리드
    const validLeads = allLeads.filter(l => !l.blacklisted)

    const now = new Date()

    // === 날짜 범위 계산 ===
    const rangeStart = new Date(startDate + 'T00:00:00')
    const rangeEnd = new Date(endDate + 'T23:59:59')
    const rangeDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // === 1. 일별 접수 추이 (요청 기간) ===
    const dailyMap = new Map<string, DailyLeadCount>()

    // 날짜 틀 생성 (KST 기준)
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(rangeStart)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      dailyMap.set(dateStr, {
        date: dateStr,
        count: 0,
        by_status: { '접수': 0, '통화완료': 0, '부재': 0, '수강등록': 0 },
      })
    }

    for (const lead of validLeads) {
      const date = toKSTDate(lead.created_at || '')
      if (dailyMap.has(date)) {
        const entry = dailyMap.get(date)!
        entry.count++
        const s = lead.status as LeadStatus
        if (entry.by_status[s] !== undefined) {
          entry.by_status[s]++
        }
      }
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // === 1-b. Meta 데이터 병합 (daily_enriched) ===
    let dailyEnriched: DailyLeadWithMeta[] = []
    try {
      const metaRecords = await fetchAirtableData('bas', startDate, endDate, 'meta')
      // 날짜별 spend/impressions 집계
      const metaByDate = new Map<string, { spend: number; impressions: number; watchTimeSum: number; watchTimeCount: number }>()
      for (const rec of metaRecords) {
        const d = rec.date
        if (!metaByDate.has(d)) {
          metaByDate.set(d, { spend: 0, impressions: 0, watchTimeSum: 0, watchTimeCount: 0 })
        }
        const entry = metaByDate.get(d)!
        entry.spend += rec.spend || 0
        entry.impressions += rec.impressions || 0
        if (rec.avg_watch_time && rec.avg_watch_time > 0) {
          entry.watchTimeSum += rec.avg_watch_time
          entry.watchTimeCount++
        }
      }

      dailyEnriched = daily.map(d => {
        const meta = metaByDate.get(d.date)
        return {
          ...d,
          spend: meta?.spend,
          impressions: meta?.impressions,
          avg_watch_time: meta && meta.watchTimeCount > 0
            ? Math.round(meta.watchTimeSum / meta.watchTimeCount)
            : undefined,
        }
      })
    } catch (e) {
      console.warn('Meta data merge failed, using daily without enrichment:', e)
      dailyEnriched = daily.map(d => ({ ...d }))
    }

    // === 2. 주간 변화율 ===
    const thisWeekStart = daysAgo(6) // 최근 7일
    const prevWeekStart = daysAgo(13)
    const thisWeekEnd = now

    let currentWeek = 0
    let previousWeek = 0

    for (const lead of validLeads) {
      const d = new Date(lead.created_at)
      if (d >= thisWeekStart && d <= thisWeekEnd) currentWeek++
      else if (d >= prevWeekStart && d < thisWeekStart) previousWeek++
    }

    const weeklyChange: WeeklyChange = {
      current_week: currentWeek,
      previous_week: previousWeek,
      change_rate: previousWeek > 0
        ? Math.round(((currentWeek - previousWeek) / previousWeek) * 1000) / 10
        : currentWeek > 0 ? 100 : 0,
    }

    // === 3. 월간 변화율 ===
    const thisMonthStart = daysAgo(29) // 최근 30일
    const prevMonthStart = daysAgo(59)

    let currentMonth = 0
    let previousMonth = 0

    for (const lead of validLeads) {
      const d = new Date(lead.created_at)
      if (d >= thisMonthStart && d <= now) currentMonth++
      else if (d >= prevMonthStart && d < thisMonthStart) previousMonth++
    }

    const monthlyChange: WeeklyChange = {
      current_week: currentMonth,
      previous_week: previousMonth,
      change_rate: previousMonth > 0
        ? Math.round(((currentMonth - previousMonth) / previousMonth) * 1000) / 10
        : currentMonth > 0 ? 100 : 0,
    }

    // === 4. 캠페인 성과 ===
    const campaignMap = new Map<string, {
      total: number
      by_status: Record<LeadStatus, number>
      recent_7d: number
      prev_7d: number
    }>()

    for (const lead of validLeads) {
      const campaign = lead.campaign || '(미지정)'
      if (!campaignMap.has(campaign)) {
        campaignMap.set(campaign, {
          total: 0,
          by_status: { '접수': 0, '통화완료': 0, '부재': 0, '수강등록': 0 },
          recent_7d: 0,
          prev_7d: 0,
        })
      }
      const entry = campaignMap.get(campaign)!
      entry.total++
      const s = lead.status as LeadStatus
      if (entry.by_status[s] !== undefined) entry.by_status[s]++

      const d = new Date(lead.created_at)
      if (d >= thisWeekStart) entry.recent_7d++
      else if (d >= prevWeekStart && d < thisWeekStart) entry.prev_7d++
    }

    const campaigns: CampaignPerformance[] = Array.from(campaignMap.entries())
      .map(([campaign, data]) => {
        const enrolled = data.by_status['수강등록']
        const called = data.by_status['통화완료'] + enrolled
        return {
          campaign,
          total: data.total,
          by_status: data.by_status,
          conversion_rate: data.total > 0
            ? Math.round((enrolled / data.total) * 1000) / 10
            : 0,
          call_rate: data.total > 0
            ? Math.round((called / data.total) * 1000) / 10
            : 0,
          recent_7d: data.recent_7d,
          trend: data.recent_7d > data.prev_7d ? 'up' as const
            : data.recent_7d < data.prev_7d ? 'down' as const
            : 'flat' as const,
        }
      })
      .sort((a, b) => b.total - a.total)

    // === 5. 일평균 ===
    const totalInRange = daily.reduce((sum, d) => sum + d.count, 0)
    const daysWithData = daily.filter(d => d.count > 0).length || 1

    const trends: BasLeadTrends = {
      daily,
      daily_enriched: dailyEnriched,
      weekly_change: weeklyChange,
      monthly_change: monthlyChange,
      campaigns,
      total_valid: validLeads.length,
      avg_daily: Math.round((totalInRange / daysWithData) * 10) / 10,
      date_range: { start: startDate, end: endDate },
    }

    return NextResponse.json(trends)
  } catch (error) {
    console.error('GET /api/bas/leads/trends error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lead trends' },
      { status: 500 }
    )
  }
}
