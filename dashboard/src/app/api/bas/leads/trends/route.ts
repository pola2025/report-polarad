/**
 * BAS 리드 트렌드 API
 * GET /api/bas/leads/trends
 *
 * 일별 접수추이, 주간/월간 변화율, 캠페인 성과
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { fetchBasLeads } from '@/lib/airtable-bas-leads'
import type {
  BasLeadTrends,
  DailyLeadCount,
  WeeklyChange,
  CampaignPerformance,
} from '@/types/bas-leads'
import type { LeadStatus } from '@/types/bas-leads'

function dateOnly(d: Date): string {
  return d.toISOString().split('T')[0]
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET() {
  try {
    const { leads: allLeads } = await fetchBasLeads({ pageSize: 10000 })

    // 블랙리스트 제외한 유효 리드
    const validLeads = allLeads.filter(l => !l.blacklisted)

    const now = new Date()
    // === 1. 일별 접수 추이 (최근 30일) ===
    const dailyMap = new Map<string, DailyLeadCount>()

    // 30일 날짜 틀 생성
    for (let i = 29; i >= 0; i--) {
      const d = dateOnly(daysAgo(i))
      dailyMap.set(d, {
        date: d,
        count: 0,
        by_status: { '접수': 0, '통화완료': 0, '부재': 0, '수강등록': 0 },
      })
    }

    for (const lead of validLeads) {
      const date = (lead.created_at || '').split('T')[0]
      if (dailyMap.has(date)) {
        const entry = dailyMap.get(date)!
        entry.count++
        const s = lead.status as LeadStatus
        if (entry.by_status[s] !== undefined) {
          entry.by_status[s]++
        }
      }
    }

    const daily = Array.from(dailyMap.values())

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
    const totalLast30 = daily.reduce((sum, d) => sum + d.count, 0)
    const daysWithData = daily.filter(d => d.count > 0).length || 1

    const trends: BasLeadTrends = {
      daily,
      weekly_change: weeklyChange,
      monthly_change: monthlyChange,
      campaigns,
      total_valid: validLeads.length,
      avg_daily: Math.round((totalLast30 / daysWithData) * 10) / 10,
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
