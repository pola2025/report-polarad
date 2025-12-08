/**
 * 네이버 플레이스 광고 분석 API
 * 일간/주간/월간 집계 및 키워드별 분석
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, TABLES } from '@/lib/supabase'
import type {
  NaverDailyData,
  NaverWeeklyData,
  NaverMonthlyData,
  NaverKeywordData,
  NaverKPISummary,
  NaverPeriodDataResponse,
} from '@/types/naver-analytics'

// 주차 계산 (월요일 시작)
function getWeekLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const jan1 = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((days + jan1.getDay() + 1) / 7)
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// 주의 시작일 (월요일)
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date.setDate(diff))
  return monday.toISOString().split('T')[0]
}

// 주의 종료일 (일요일)
function getWeekEnd(dateStr: string): string {
  const start = new Date(getWeekStart(dateStr))
  start.setDate(start.getDate() + 6)
  return start.toISOString().split('T')[0]
}

// GET: 네이버 분석 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let clientId = searchParams.get('clientId')
    const clientSlug = searchParams.get('clientSlug') // 클라이언트 slug 지원
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const view = searchParams.get('view') || 'all' // daily, weekly, monthly, keywords, all

    // slug로 clientId 조회
    const supabase = createServerClient()
    if (!clientId && clientSlug) {
      const { data: client } = await supabase
        .from(TABLES.CLIENTS)
        .select('id')
        .eq('slug', clientSlug)
        .single()
      clientId = client?.id || null
    }

    // 페이지네이션을 통해 모든 데이터 조회 (Supabase 기본 limit 1000개 극복)
    const fetchAllData = async () => {
      const allData: any[] = []
      const pageSize = 1000
      let offset = 0
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from(TABLES.NAVER_DATA)
          .select('*')
          .order('date', { ascending: true })
          .range(offset, offset + pageSize - 1)

        if (clientId) {
          query = query.eq('client_id', clientId)
        }
        if (startDate) {
          query = query.gte('date', startDate)
        }
        if (endDate) {
          query = query.lte('date', endDate)
        }

        const { data, error } = await query

        if (error) throw error

        if (data && data.length > 0) {
          allData.push(...data)
          offset += pageSize
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }

      return allData
    }

    const rawData = await fetchAllData().catch((err) => {
      console.error('Naver analytics error:', err)
      return null
    })

    const error = rawData === null ? { message: 'Failed to fetch data' } : null

    if (error) {
      console.error('Naver analytics error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({
        daily: [],
        weekly: [],
        monthly: [],
        keywords: [],
        summary: {
          total_impressions: 0,
          total_clicks: 0,
          total_cost: 0,
          avg_ctr: 0,
          avg_cpc: 0,
          avg_rank: 0,
          unique_keywords: 0,
          data_days: 0,
          date_range: { start: '', end: '' },
        },
      })
    }

    // 일별 집계
    const dailyMap = new Map<string, NaverDailyData>()
    const keywordMap = new Map<string, NaverKeywordData>()

    for (const row of rawData) {
      const date = row.date
      const keyword = row.keyword

      // 일별 집계
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          avg_cpc: 0,
          total_cost: 0,
          avg_rank: 0,
          keyword_count: 0,
        })
      }
      const daily = dailyMap.get(date)!
      daily.impressions += row.impressions || 0
      daily.clicks += row.clicks || 0
      daily.total_cost += row.total_cost || 0
      daily.avg_rank += row.avg_rank || 0
      daily.keyword_count += 1

      // 키워드별 집계
      if (!keywordMap.has(keyword)) {
        keywordMap.set(keyword, {
          keyword,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          avg_cpc: 0,
          total_cost: 0,
          avg_rank: 0,
          days_count: 0,
          first_date: date,
          last_date: date,
        })
      }
      const kw = keywordMap.get(keyword)!
      kw.impressions += row.impressions || 0
      kw.clicks += row.clicks || 0
      kw.total_cost += row.total_cost || 0
      kw.avg_rank += row.avg_rank || 0
      kw.days_count += 1
      if (date < kw.first_date) kw.first_date = date
      if (date > kw.last_date) kw.last_date = date
    }

    // 일별 CTR, CPC, 평균 순위 계산
    const daily: NaverDailyData[] = Array.from(dailyMap.values()).map((d) => ({
      ...d,
      ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
      avg_cpc: d.clicks > 0 ? Math.round(d.total_cost / d.clicks) : 0,
      avg_rank: d.keyword_count > 0 ? Math.round((d.avg_rank / d.keyword_count) * 10) / 10 : 0,
    }))

    // 주별 집계
    const weeklyMap = new Map<string, NaverWeeklyData>()
    for (const d of daily) {
      const weekLabel = getWeekLabel(d.date)
      if (!weeklyMap.has(weekLabel)) {
        weeklyMap.set(weekLabel, {
          week_label: weekLabel,
          week_start: getWeekStart(d.date),
          week_end: getWeekEnd(d.date),
          impressions: 0,
          clicks: 0,
          ctr: 0,
          avg_cpc: 0,
          total_cost: 0,
          avg_rank: 0,
          keyword_count: 0,
        })
      }
      const week = weeklyMap.get(weekLabel)!
      week.impressions += d.impressions
      week.clicks += d.clicks
      week.total_cost += d.total_cost
      week.avg_rank += d.avg_rank
      week.keyword_count += 1
    }

    const weekly: NaverWeeklyData[] = Array.from(weeklyMap.values())
      .map((w) => ({
        ...w,
        ctr: w.impressions > 0 ? Math.round((w.clicks / w.impressions) * 10000) / 100 : 0,
        avg_cpc: w.clicks > 0 ? Math.round(w.total_cost / w.clicks) : 0,
        avg_rank: w.keyword_count > 0 ? Math.round((w.avg_rank / w.keyword_count) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.week_start.localeCompare(b.week_start))

    // 전주 대비 변화율 계산
    for (let i = 1; i < weekly.length; i++) {
      const prev = weekly[i - 1]
      const curr = weekly[i]
      curr.impressions_change =
        prev.impressions > 0
          ? Math.round(((curr.impressions - prev.impressions) / prev.impressions) * 1000) / 10
          : 0
      curr.clicks_change =
        prev.clicks > 0
          ? Math.round(((curr.clicks - prev.clicks) / prev.clicks) * 1000) / 10
          : 0
      curr.cost_change =
        prev.total_cost > 0
          ? Math.round(((curr.total_cost - prev.total_cost) / prev.total_cost) * 1000) / 10
          : 0
    }

    // 월별 집계
    const monthlyMap = new Map<string, NaverMonthlyData>()
    for (const d of daily) {
      const month = d.date.substring(0, 7)
      if (!monthlyMap.has(month)) {
        const [year, m] = month.split('-')
        monthlyMap.set(month, {
          month,
          month_label: `${year}년 ${parseInt(m)}월`,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          avg_cpc: 0,
          total_cost: 0,
          avg_rank: 0,
          keyword_count: 0,
          days: [],
        })
      }
      const monthData = monthlyMap.get(month)!
      monthData.impressions += d.impressions
      monthData.clicks += d.clicks
      monthData.total_cost += d.total_cost
      monthData.avg_rank += d.avg_rank
      monthData.keyword_count += 1
      monthData.days!.push(d)
    }

    const monthly: NaverMonthlyData[] = Array.from(monthlyMap.values())
      .map((m) => {
        // 해당 월의 주별 데이터 추가
        const monthWeeks = weekly.filter(
          (w) => w.week_start.substring(0, 7) === m.month || w.week_end.substring(0, 7) === m.month
        )
        return {
          ...m,
          ctr: m.impressions > 0 ? Math.round((m.clicks / m.impressions) * 10000) / 100 : 0,
          avg_cpc: m.clicks > 0 ? Math.round(m.total_cost / m.clicks) : 0,
          avg_rank: m.keyword_count > 0 ? Math.round((m.avg_rank / m.keyword_count) * 10) / 10 : 0,
          weeks: monthWeeks,
        }
      })
      .sort((a, b) => a.month.localeCompare(b.month))

    // 전월 대비 변화율 계산
    for (let i = 1; i < monthly.length; i++) {
      const prev = monthly[i - 1]
      const curr = monthly[i]
      curr.impressions_change =
        prev.impressions > 0
          ? Math.round(((curr.impressions - prev.impressions) / prev.impressions) * 1000) / 10
          : 0
      curr.clicks_change =
        prev.clicks > 0
          ? Math.round(((curr.clicks - prev.clicks) / prev.clicks) * 1000) / 10
          : 0
      curr.cost_change =
        prev.total_cost > 0
          ? Math.round(((curr.total_cost - prev.total_cost) / prev.total_cost) * 1000) / 10
          : 0
    }

    // 키워드별 CTR, CPC, 평균 순위 계산
    const keywords: NaverKeywordData[] = Array.from(keywordMap.values())
      .map((k) => ({
        ...k,
        ctr: k.impressions > 0 ? Math.round((k.clicks / k.impressions) * 10000) / 100 : 0,
        avg_cpc: k.clicks > 0 ? Math.round(k.total_cost / k.clicks) : 0,
        avg_rank: k.days_count > 0 ? Math.round((k.avg_rank / k.days_count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.total_cost - a.total_cost)

    // 전체 요약
    const totalImpressions = daily.reduce((sum, d) => sum + d.impressions, 0)
    const totalClicks = daily.reduce((sum, d) => sum + d.clicks, 0)
    const totalCost = daily.reduce((sum, d) => sum + d.total_cost, 0)
    const dates = daily.map((d) => d.date).sort()

    const summary: NaverKPISummary = {
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_cost: totalCost,
      avg_ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
      avg_cpc: totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0,
      avg_rank:
        daily.length > 0
          ? Math.round((daily.reduce((sum, d) => sum + d.avg_rank, 0) / daily.length) * 10) / 10
          : 0,
      unique_keywords: keywords.length,
      data_days: daily.length,
      date_range: {
        start: dates[0] || '',
        end: dates[dates.length - 1] || '',
      },
    }

    // 응답 데이터 구성
    const response: NaverPeriodDataResponse = {
      daily: view === 'all' || view === 'daily' ? daily : [],
      weekly: view === 'all' || view === 'weekly' ? weekly : [],
      monthly: view === 'all' || view === 'monthly' ? monthly : [],
      keywords: view === 'all' || view === 'keywords' ? keywords : [],
      summary,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
