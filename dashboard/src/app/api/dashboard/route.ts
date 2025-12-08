export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, TABLES } from '@/lib/supabase'
import { subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { USD_TO_KRW_RATE, convertUsdToKrw } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)

    // 클라이언트 필터 (선택적)
    const clientSlug = searchParams.get('client')

    // 날짜 범위 설정 (startDate, endDate 파라미터 또는 기본값: 최근 30일)
    const customStartDate = searchParams.get('startDate')
    const customEndDate = searchParams.get('endDate')
    const period = searchParams.get('period') || '30d'
    const today = new Date()
    let startDate: Date
    let endDate: Date
    let previousStartDate: Date
    let previousEndDate: Date

    if (customStartDate && customEndDate) {
      // 커스텀 날짜 범위
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
      // 기간 길이 계산
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      previousEndDate = subDays(startDate, 1)
      previousStartDate = subDays(previousEndDate, diffDays - 1)
    } else {
      // 기존 기간 옵션 사용
      endDate = today
      switch (period) {
        case '7d':
          startDate = subDays(today, 6)
          previousStartDate = subDays(today, 13)
          previousEndDate = subDays(today, 7)
          break
        case '30d':
          startDate = subDays(today, 29)
          previousStartDate = subDays(today, 59)
          previousEndDate = subDays(today, 30)
          break
        case 'thisMonth':
          startDate = startOfMonth(today)
          const lastMonth = subMonths(today, 1)
          previousStartDate = startOfMonth(lastMonth)
          previousEndDate = endOfMonth(lastMonth)
          break
        default:
          startDate = subDays(today, 29)
          previousStartDate = subDays(today, 59)
          previousEndDate = subDays(today, 30)
      }
    }

    const startDateStr = format(startDate, 'yyyy-MM-dd')
    const endDateStr = format(endDate, 'yyyy-MM-dd')
    const previousStartDateStr = format(previousStartDate, 'yyyy-MM-dd')
    const previousEndDateStr = format(previousEndDate, 'yyyy-MM-dd')

    // 클라이언트 ID 가져오기
    let clientId: string | null = null
    if (clientSlug) {
      const { data: client } = await supabase
        .from(TABLES.CLIENTS)
        .select('id')
        .eq('slug', clientSlug)
        .single()
      clientId = client?.id || null
    }

    // ===== META 데이터 집계 =====
    let metaQuery = supabase
      .from(TABLES.META_DATA)
      .select('impressions, clicks, leads, spend, date')
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    if (clientId) {
      metaQuery = metaQuery.eq('client_id', clientId)
    }

    const { data: metaData, error: metaError } = await metaQuery

    if (metaError) throw metaError

    // 현재 기간 Meta 집계
    const metaCurrentPeriod = {
      impressions: 0,
      clicks: 0,
      leads: 0,
      spend: 0,
    }

    metaData?.forEach(row => {
      metaCurrentPeriod.impressions += row.impressions || 0
      metaCurrentPeriod.clicks += row.clicks || 0
      metaCurrentPeriod.leads += row.leads || 0
      metaCurrentPeriod.spend += parseFloat(row.spend) || 0
    })

    // 이전 기간 Meta 데이터
    let metaPreviousQuery = supabase
      .from(TABLES.META_DATA)
      .select('impressions, clicks, leads, spend')
      .gte('date', previousStartDateStr)
      .lte('date', previousEndDateStr)

    if (clientId) {
      metaPreviousQuery = metaPreviousQuery.eq('client_id', clientId)
    }

    const { data: metaPreviousData } = await metaPreviousQuery

    const metaPreviousPeriod = {
      impressions: 0,
      clicks: 0,
      leads: 0,
      spend: 0,
    }

    metaPreviousData?.forEach(row => {
      metaPreviousPeriod.impressions += row.impressions || 0
      metaPreviousPeriod.clicks += row.clicks || 0
      metaPreviousPeriod.leads += row.leads || 0
      metaPreviousPeriod.spend += parseFloat(row.spend) || 0
    })

    // ===== 네이버 데이터 집계 =====
    let naverQuery = supabase
      .from(TABLES.NAVER_DATA)
      .select('impressions, clicks, total_cost, date')
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    if (clientId) {
      naverQuery = naverQuery.eq('client_id', clientId)
    }

    const { data: naverData } = await naverQuery

    const naverCurrentPeriod = {
      impressions: 0,
      clicks: 0,
      spend: 0,
    }

    naverData?.forEach(row => {
      naverCurrentPeriod.impressions += row.impressions || 0
      naverCurrentPeriod.clicks += row.clicks || 0
      naverCurrentPeriod.spend += row.total_cost || 0
    })

    // 이전 기간 네이버 데이터
    let naverPreviousQuery = supabase
      .from(TABLES.NAVER_DATA)
      .select('impressions, clicks, total_cost')
      .gte('date', previousStartDateStr)
      .lte('date', previousEndDateStr)

    if (clientId) {
      naverPreviousQuery = naverPreviousQuery.eq('client_id', clientId)
    }

    const { data: naverPreviousData } = await naverPreviousQuery

    const naverPreviousPeriod = {
      impressions: 0,
      clicks: 0,
      spend: 0,
    }

    naverPreviousData?.forEach(row => {
      naverPreviousPeriod.impressions += row.impressions || 0
      naverPreviousPeriod.clicks += row.clicks || 0
      naverPreviousPeriod.spend += row.total_cost || 0
    })

    // ===== 일별 트렌드 데이터 =====
    // Meta 일별
    const metaDailyMap = new Map<string, { impressions: number; clicks: number; spend: number; leads: number }>()
    metaData?.forEach(row => {
      const existing = metaDailyMap.get(row.date) || { impressions: 0, clicks: 0, spend: 0, leads: 0 }
      metaDailyMap.set(row.date, {
        impressions: existing.impressions + (row.impressions || 0),
        clicks: existing.clicks + (row.clicks || 0),
        spend: existing.spend + (parseFloat(row.spend) || 0),
        leads: existing.leads + (row.leads || 0),
      })
    })

    // 네이버 일별
    const naverDailyMap = new Map<string, { impressions: number; clicks: number; spend: number }>()
    naverData?.forEach(row => {
      const existing = naverDailyMap.get(row.date) || { impressions: 0, clicks: 0, spend: 0 }
      naverDailyMap.set(row.date, {
        impressions: existing.impressions + (row.impressions || 0),
        clicks: existing.clicks + (row.clicks || 0),
        spend: existing.spend + (row.total_cost || 0),
      })
    })

    // 날짜 범위 생성 및 합치기
    const dailyTrend: Array<{
      date: string
      meta_impressions: number
      meta_clicks: number
      meta_spend: number
      meta_spend_krw: number
      meta_leads: number
      naver_impressions: number
      naver_clicks: number
      naver_spend: number
      total_spend_krw: number
    }> = []

    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      const metaDay = metaDailyMap.get(dateStr) || { impressions: 0, clicks: 0, spend: 0, leads: 0 }
      const naverDay = naverDailyMap.get(dateStr) || { impressions: 0, clicks: 0, spend: 0 }

      dailyTrend.push({
        date: dateStr,
        meta_impressions: metaDay.impressions,
        meta_clicks: metaDay.clicks,
        meta_spend: metaDay.spend,
        meta_spend_krw: convertUsdToKrw(metaDay.spend),
        meta_leads: metaDay.leads,
        naver_impressions: naverDay.impressions,
        naver_clicks: naverDay.clicks,
        naver_spend: naverDay.spend,
        total_spend_krw: convertUsdToKrw(metaDay.spend) + naverDay.spend,
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // ===== 통합 KPI 계산 =====
    const totalImpressions = metaCurrentPeriod.impressions + naverCurrentPeriod.impressions
    const previousTotalImpressions = metaPreviousPeriod.impressions + naverPreviousPeriod.impressions

    const totalClicks = metaCurrentPeriod.clicks + naverCurrentPeriod.clicks
    const previousTotalClicks = metaPreviousPeriod.clicks + naverPreviousPeriod.clicks

    // 총 지출액: Meta(USD→KRW 변환) + 네이버(KRW)
    const totalSpendKRW = convertUsdToKrw(metaCurrentPeriod.spend) + naverCurrentPeriod.spend
    const previousTotalSpendKRW = convertUsdToKrw(metaPreviousPeriod.spend) + naverPreviousPeriod.spend

    const avgCPL = metaCurrentPeriod.leads > 0
      ? Math.round(metaCurrentPeriod.spend / metaCurrentPeriod.leads)
      : 0
    const previousAvgCPL = metaPreviousPeriod.leads > 0
      ? Math.round(metaPreviousPeriod.spend / metaPreviousPeriod.leads)
      : 0

    // ===== 키워드 통계 데이터 =====
    let keywordQuery = supabase
      .from(TABLES.KEYWORD_STATS)
      .select('*')
      .order('year_month', { ascending: true })

    if (clientId) {
      keywordQuery = keywordQuery.eq('client_id', clientId)
    }

    const { data: keywordData } = await keywordQuery

    const keywordStats = keywordData?.map(row => ({
      year_month: row.year_month,
      keyword: row.keyword,
      pc_searches: row.pc_searches || 0,
      mobile_searches: row.mobile_searches || 0,
      total_searches: (row.pc_searches || 0) + (row.mobile_searches || 0),
    })) || []

    return NextResponse.json({
      success: true,
      period: {
        start: startDateStr,
        end: endDateStr,
        label: customStartDate ? 'custom' : period,
      },
      kpi: {
        totalImpressions,
        previousTotalImpressions,
        totalClicks,
        previousTotalClicks,
        totalSpend: totalSpendKRW,
        previousTotalSpend: previousTotalSpendKRW,
        totalLeads: metaCurrentPeriod.leads,
        previousTotalLeads: metaPreviousPeriod.leads,
        avgCPL,
        previousAvgCPL,
      },
      meta: {
        current: {
          ...metaCurrentPeriod,
          spend_krw: convertUsdToKrw(metaCurrentPeriod.spend),
        },
        previous: {
          ...metaPreviousPeriod,
          spend_krw: convertUsdToKrw(metaPreviousPeriod.spend),
        },
      },
      exchange_rate: USD_TO_KRW_RATE,
      naver: {
        current: naverCurrentPeriod,
        previous: naverPreviousPeriod,
      },
      dailyTrend,
      keywordStats,
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
