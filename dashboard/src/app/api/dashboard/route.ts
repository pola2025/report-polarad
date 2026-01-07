export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { TABLES } from '@/lib/supabase'
import { fetchAirtableData, AIRTABLE_CONFIG, getClientIdBySlug } from '@/lib/airtable'
import { subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { USD_TO_KRW_RATE } from '@/lib/constants'

// 클라이언트별 환율 설정
// - HEA 판교: USD 데이터 → KRW 환산 필요 (×1500)
// - 나라똔: 이미 KRW 데이터 → 환산 불필요 (×1)
function getExchangeRate(clientSlug: string | null): number {
  if (clientSlug === 'naratton') {
    return 1 // 이미 KRW
  }
  return USD_TO_KRW_RATE // USD → KRW (1500)
}

export async function GET(request: NextRequest) {
  try {
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

    // 클라이언트 slug 확인 (Airtable config 직접 사용 - Supabase 의존성 제거)
    // AIRTABLE_CONFIG에 slug가 있는지 확인하여 유효한 클라이언트인지 판단
    const resolvedSlug = clientSlug && AIRTABLE_CONFIG[clientSlug] ? clientSlug : null

    // ===== 전체 광고 데이터 집계 (Airtable - Meta + Naver 통합) =====
    let metaCurrentData: Array<{impressions: number; clicks: number; leads?: number; spend: number; date: string; video_views?: number}> = []
    let metaPreviousData: Array<{impressions: number; clicks: number; leads?: number; spend: number; video_views?: number}> = []
    let naverCurrentData: Array<{impressions: number; clicks: number; spend: number; date: string}> = []
    let naverPreviousData: Array<{impressions: number; clicks: number; spend: number}> = []

    if (resolvedSlug) {
      // 현재 기간 전체 데이터 (Airtable - source 필터 없이)
      const currentAirtableData = await fetchAirtableData(resolvedSlug, startDateStr, endDateStr)

      // Meta 데이터 필터링 (source = 'meta')
      metaCurrentData = currentAirtableData
        .filter(r => r.source === 'meta')
        .map(r => ({
          impressions: r.impressions,
          clicks: r.clicks,
          leads: r.leads,
          spend: r.spend,
          date: r.date,
          video_views: r.video_views,
        }))

      // Naver 데이터 필터링 (source = 'naver_place' 또는 'naver_brand_search')
      naverCurrentData = currentAirtableData
        .filter(r => r.source === 'naver_place' || r.source === 'naver_brand_search')
        .map(r => ({
          impressions: r.impressions,
          clicks: r.clicks,
          spend: r.spend,
          date: r.date,
        }))

      // 이전 기간 전체 데이터 (Airtable)
      const previousAirtableData = await fetchAirtableData(resolvedSlug, previousStartDateStr, previousEndDateStr)

      // 이전 기간 Meta 데이터
      metaPreviousData = previousAirtableData
        .filter(r => r.source === 'meta')
        .map(r => ({
          impressions: r.impressions,
          clicks: r.clicks,
          leads: r.leads,
          spend: r.spend,
          video_views: r.video_views,
        }))

      // 이전 기간 Naver 데이터
      naverPreviousData = previousAirtableData
        .filter(r => r.source === 'naver_place' || r.source === 'naver_brand_search')
        .map(r => ({
          impressions: r.impressions,
          clicks: r.clicks,
          spend: r.spend,
        }))
    }

    // 현재 기간 Meta 집계
    const metaCurrentPeriod = {
      impressions: 0,
      clicks: 0,
      leads: 0,
      spend: 0,
      video_views: 0,
    }

    metaCurrentData.forEach(row => {
      metaCurrentPeriod.impressions += row.impressions || 0
      metaCurrentPeriod.clicks += row.clicks || 0
      metaCurrentPeriod.leads += row.leads || 0
      metaCurrentPeriod.spend += row.spend || 0
      metaCurrentPeriod.video_views += row.video_views || 0
    })

    // 이전 기간 Meta 집계
    const metaPreviousPeriod = {
      impressions: 0,
      clicks: 0,
      leads: 0,
      spend: 0,
      video_views: 0,
    }

    metaPreviousData.forEach(row => {
      metaPreviousPeriod.impressions += row.impressions || 0
      metaPreviousPeriod.clicks += row.clicks || 0
      metaPreviousPeriod.leads += row.leads || 0
      metaPreviousPeriod.spend += row.spend || 0
      metaPreviousPeriod.video_views += row.video_views || 0
    })

    // ===== 네이버 데이터 집계 (Airtable - 위에서 이미 naverCurrentData, naverPreviousData 설정됨) =====
    const naverCurrentPeriod = {
      impressions: 0,
      clicks: 0,
      spend: 0,
    }

    naverCurrentData.forEach(row => {
      naverCurrentPeriod.impressions += row.impressions || 0
      naverCurrentPeriod.clicks += row.clicks || 0
      naverCurrentPeriod.spend += row.spend || 0
    })

    const naverPreviousPeriod = {
      impressions: 0,
      clicks: 0,
      spend: 0,
    }

    naverPreviousData.forEach(row => {
      naverPreviousPeriod.impressions += row.impressions || 0
      naverPreviousPeriod.clicks += row.clicks || 0
      naverPreviousPeriod.spend += row.spend || 0
    })

    // ===== 일별 트렌드 데이터 =====
    // Meta 일별
    const metaDailyMap = new Map<string, { impressions: number; clicks: number; spend: number; leads: number }>()
    metaCurrentData.forEach(row => {
      const existing = metaDailyMap.get(row.date) || { impressions: 0, clicks: 0, spend: 0, leads: 0 }
      metaDailyMap.set(row.date, {
        impressions: existing.impressions + (row.impressions || 0),
        clicks: existing.clicks + (row.clicks || 0),
        spend: existing.spend + (row.spend || 0),
        leads: existing.leads + (row.leads || 0),
      })
    })

    // 네이버 일별 (Airtable 데이터 사용)
    const naverDailyMap = new Map<string, { impressions: number; clicks: number; spend: number }>()
    naverCurrentData.forEach(row => {
      const existing = naverDailyMap.get(row.date) || { impressions: 0, clicks: 0, spend: 0 }
      naverDailyMap.set(row.date, {
        impressions: existing.impressions + (row.impressions || 0),
        clicks: existing.clicks + (row.clicks || 0),
        spend: existing.spend + (row.spend || 0),
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

    // 클라이언트별 환율 적용
    const exchangeRate = getExchangeRate(resolvedSlug)

    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      const metaDay = metaDailyMap.get(dateStr) || { impressions: 0, clicks: 0, spend: 0, leads: 0 }
      const naverDay = naverDailyMap.get(dateStr) || { impressions: 0, clicks: 0, spend: 0 }

      // Meta spend에 환율 적용 (HEA: ×1500, 나라똔: ×1)
      const metaSpendKrw = metaDay.spend * exchangeRate

      dailyTrend.push({
        date: dateStr,
        meta_impressions: metaDay.impressions,
        meta_clicks: metaDay.clicks,
        meta_spend: metaDay.spend,
        meta_spend_krw: metaSpendKrw,
        meta_leads: metaDay.leads,
        naver_impressions: naverDay.impressions,
        naver_clicks: naverDay.clicks,
        naver_spend: naverDay.spend,
        total_spend_krw: metaSpendKrw + naverDay.spend,
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // ===== 통합 KPI 계산 =====
    const totalImpressions = metaCurrentPeriod.impressions + naverCurrentPeriod.impressions
    const previousTotalImpressions = metaPreviousPeriod.impressions + naverPreviousPeriod.impressions

    const totalClicks = metaCurrentPeriod.clicks + naverCurrentPeriod.clicks
    const previousTotalClicks = metaPreviousPeriod.clicks + naverPreviousPeriod.clicks

    // 총 지출액: Meta(환율 적용) + 네이버(KRW)
    const totalSpendKRW = (metaCurrentPeriod.spend * exchangeRate) + naverCurrentPeriod.spend
    const previousTotalSpendKRW = (metaPreviousPeriod.spend * exchangeRate) + naverPreviousPeriod.spend

    const avgCPL = metaCurrentPeriod.leads > 0
      ? Math.round((metaCurrentPeriod.spend * exchangeRate) / metaCurrentPeriod.leads)
      : 0
    const previousAvgCPL = metaPreviousPeriod.leads > 0
      ? Math.round((metaPreviousPeriod.spend * exchangeRate) / metaPreviousPeriod.leads)
      : 0

    // ===== 키워드 통계 데이터 (직접 fetch로 캐시 우회) =====
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    let keywordApiUrl = `${supabaseUrl}/rest/v1/${TABLES.KEYWORD_STATS}?select=*&order=year_month.asc`
    // resolvedSlug에서 UUID 조회 (Supabase 키워드 통계 테이블은 client_id UUID 사용)
    const clientUuid = resolvedSlug ? getClientIdBySlug(resolvedSlug) : null
    if (clientUuid) {
      keywordApiUrl += `&client_id=eq.${clientUuid}`
    }

    const keywordResponse = await fetch(keywordApiUrl, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      cache: 'no-store',
    })

    const keywordData = await keywordResponse.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keywordStats = (keywordData || []).map((row: any) => ({
      year_month: row.year_month,
      keyword: row.keyword,
      pc_searches: row.pc_searches || 0,
      mobile_searches: row.mobile_searches || 0,
      total_searches: (row.pc_searches || 0) + (row.mobile_searches || 0),
    }))

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
          spend_krw: metaCurrentPeriod.spend * exchangeRate,
        },
        previous: {
          ...metaPreviousPeriod,
          spend_krw: metaPreviousPeriod.spend * exchangeRate,
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
