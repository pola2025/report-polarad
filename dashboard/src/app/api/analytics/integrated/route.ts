/**
 * 통합 광고 분석 API
 * Meta + 네이버 데이터 통합 조회
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'
import { USD_TO_KRW_RATE, convertUsdToKrw } from '@/lib/constants'
import type {
  IntegratedSummary,
  MetaDetailedData,
  MetaDailyData,
  DailyCombinedData,
  ChannelComparisonData,
  IntegratedAnalyticsResponse,
} from '@/types/integrated-analytics'
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!clientId) {
      return NextResponse.json({ success: false, error: 'clientId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // ===== 1. Meta 데이터 조회 =====
    let metaQuery = supabase
      .from(TABLES.META_DATA)
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: true })

    if (startDate) metaQuery = metaQuery.gte('date', startDate)
    if (endDate) metaQuery = metaQuery.lte('date', endDate)

    const { data: metaRaw, error: metaError } = await metaQuery

    if (metaError) {
      console.error('Meta data error:', metaError)
      return NextResponse.json({ success: false, error: metaError.message }, { status: 500 })
    }

    // ===== 2. 네이버 데이터 조회 =====
    let naverQuery = supabase
      .from(TABLES.NAVER_DATA)
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: true })

    if (startDate) naverQuery = naverQuery.gte('date', startDate)
    if (endDate) naverQuery = naverQuery.lte('date', endDate)

    const { data: naverRaw, error: naverError } = await naverQuery

    if (naverError) {
      console.error('Naver data error:', naverError)
      return NextResponse.json({ success: false, error: naverError.message }, { status: 500 })
    }

    // ===== 3. Meta 데이터 집계 =====
    const metaDailyMap = new Map<string, MetaDailyData>()
    let totalMetaSpendUsd = 0
    let totalMetaImpressions = 0
    let totalMetaClicks = 0
    let totalMetaLeads = 0

    for (const row of metaRaw || []) {
      const spendUsd = parseFloat(row.spend) || 0
      totalMetaSpendUsd += spendUsd
      totalMetaImpressions += row.impressions || 0
      totalMetaClicks += row.clicks || 0
      totalMetaLeads += row.leads || 0

      if (!metaDailyMap.has(row.date)) {
        metaDailyMap.set(row.date, {
          date: row.date,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          spend_usd: 0,
          spend_krw: 0,
          leads: 0,
          cpl_usd: 0,
          cpl_krw: 0,
        })
      }
      const daily = metaDailyMap.get(row.date)!
      daily.impressions += row.impressions || 0
      daily.clicks += row.clicks || 0
      daily.spend_usd += spendUsd
      daily.leads += row.leads || 0
    }

    // Meta 일별 CTR, CPL 계산
    const metaDaily: MetaDailyData[] = Array.from(metaDailyMap.values()).map(d => ({
      ...d,
      spend_krw: convertUsdToKrw(d.spend_usd),
      ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
      cpl_usd: d.leads > 0 ? Math.round((d.spend_usd / d.leads) * 100) / 100 : 0,
      cpl_krw: d.leads > 0 ? convertUsdToKrw(d.spend_usd / d.leads) : 0,
    }))

    const metaSpendKrw = convertUsdToKrw(totalMetaSpendUsd)
    const metaCtr = totalMetaImpressions > 0 ? Math.round((totalMetaClicks / totalMetaImpressions) * 10000) / 100 : 0
    const metaCplUsd = totalMetaLeads > 0 ? Math.round((totalMetaSpendUsd / totalMetaLeads) * 100) / 100 : 0
    const metaCplKrw = totalMetaLeads > 0 ? convertUsdToKrw(totalMetaSpendUsd / totalMetaLeads) : 0

    const meta: MetaDetailedData = {
      summary: {
        spend_usd: Math.round(totalMetaSpendUsd * 100) / 100,
        spend_krw: metaSpendKrw,
        impressions: totalMetaImpressions,
        clicks: totalMetaClicks,
        ctr: metaCtr,
        leads: totalMetaLeads,
        cpl_usd: metaCplUsd,
        cpl_krw: metaCplKrw,
      },
      daily: metaDaily,
    }

    // ===== 4. 네이버 데이터 집계 (기존 로직 재사용) =====
    const naverDailyMap = new Map<string, NaverDailyData>()
    const keywordMap = new Map<string, NaverKeywordData>()

    for (const row of naverRaw || []) {
      const date = row.date
      const keyword = row.keyword

      if (!naverDailyMap.has(date)) {
        naverDailyMap.set(date, {
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
      const daily = naverDailyMap.get(date)!
      daily.impressions += row.impressions || 0
      daily.clicks += row.clicks || 0
      daily.total_cost += row.total_cost || 0
      daily.avg_rank += row.avg_rank || 0
      daily.keyword_count += 1

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

    // 네이버 일별 집계
    const naverDaily: NaverDailyData[] = Array.from(naverDailyMap.values()).map(d => ({
      ...d,
      ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
      avg_cpc: d.clicks > 0 ? Math.round(d.total_cost / d.clicks) : 0,
      avg_rank: d.keyword_count > 0 ? Math.round((d.avg_rank / d.keyword_count) * 10) / 10 : 0,
    }))

    // 네이버 주별 집계
    const weeklyMap = new Map<string, NaverWeeklyData>()
    for (const d of naverDaily) {
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

    const naverWeekly: NaverWeeklyData[] = Array.from(weeklyMap.values())
      .map(w => ({
        ...w,
        ctr: w.impressions > 0 ? Math.round((w.clicks / w.impressions) * 10000) / 100 : 0,
        avg_cpc: w.clicks > 0 ? Math.round(w.total_cost / w.clicks) : 0,
        avg_rank: w.keyword_count > 0 ? Math.round((w.avg_rank / w.keyword_count) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.week_start.localeCompare(b.week_start))

    // 네이버 월별 집계
    const monthlyMap = new Map<string, NaverMonthlyData>()
    for (const d of naverDaily) {
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
        })
      }
      const monthData = monthlyMap.get(month)!
      monthData.impressions += d.impressions
      monthData.clicks += d.clicks
      monthData.total_cost += d.total_cost
      monthData.avg_rank += d.avg_rank
      monthData.keyword_count += 1
    }

    const naverMonthly: NaverMonthlyData[] = Array.from(monthlyMap.values())
      .map(m => ({
        ...m,
        ctr: m.impressions > 0 ? Math.round((m.clicks / m.impressions) * 10000) / 100 : 0,
        avg_cpc: m.clicks > 0 ? Math.round(m.total_cost / m.clicks) : 0,
        avg_rank: m.keyword_count > 0 ? Math.round((m.avg_rank / m.keyword_count) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // 네이버 키워드별 집계
    const naverKeywords: NaverKeywordData[] = Array.from(keywordMap.values())
      .map(k => ({
        ...k,
        ctr: k.impressions > 0 ? Math.round((k.clicks / k.impressions) * 10000) / 100 : 0,
        avg_cpc: k.clicks > 0 ? Math.round(k.total_cost / k.clicks) : 0,
        avg_rank: k.days_count > 0 ? Math.round((k.avg_rank / k.days_count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.total_cost - a.total_cost)

    // 네이버 전체 요약
    const totalNaverImpressions = naverDaily.reduce((sum, d) => sum + d.impressions, 0)
    const totalNaverClicks = naverDaily.reduce((sum, d) => sum + d.clicks, 0)
    const totalNaverCost = naverDaily.reduce((sum, d) => sum + d.total_cost, 0)
    const naverDates = naverDaily.map(d => d.date).sort()

    const naverSummary: NaverKPISummary = {
      total_impressions: totalNaverImpressions,
      total_clicks: totalNaverClicks,
      total_cost: totalNaverCost,
      avg_ctr: totalNaverImpressions > 0 ? Math.round((totalNaverClicks / totalNaverImpressions) * 10000) / 100 : 0,
      avg_cpc: totalNaverClicks > 0 ? Math.round(totalNaverCost / totalNaverClicks) : 0,
      avg_rank: naverDaily.length > 0
        ? Math.round((naverDaily.reduce((sum, d) => sum + d.avg_rank, 0) / naverDaily.length) * 10) / 10
        : 0,
      unique_keywords: naverKeywords.length,
      data_days: naverDaily.length,
      date_range: {
        start: naverDates[0] || '',
        end: naverDates[naverDates.length - 1] || '',
      },
    }

    const naver: NaverPeriodDataResponse = {
      daily: naverDaily,
      weekly: naverWeekly,
      monthly: naverMonthly,
      keywords: naverKeywords,
      summary: naverSummary,
    }

    // ===== 5. 통합 일별 데이터 =====
    const allDates = new Set<string>()
    metaDaily.forEach(d => allDates.add(d.date))
    naverDaily.forEach(d => allDates.add(d.date))

    const sortedDates = Array.from(allDates).sort()
    const dailyCombined: DailyCombinedData[] = sortedDates.map(date => {
      const metaDay = metaDailyMap.get(date)
      const naverDay = naverDailyMap.get(date)

      const metaSpendKrw = metaDay ? convertUsdToKrw(metaDay.spend_usd) : 0
      const naverSpend = naverDay?.total_cost || 0

      return {
        date,
        meta_impressions: metaDay?.impressions || 0,
        meta_clicks: metaDay?.clicks || 0,
        meta_spend_usd: metaDay?.spend_usd || 0,
        meta_spend_krw: metaSpendKrw,
        meta_leads: metaDay?.leads || 0,
        naver_impressions: naverDay?.impressions || 0,
        naver_clicks: naverDay?.clicks || 0,
        naver_spend: naverSpend,
        total_impressions: (metaDay?.impressions || 0) + (naverDay?.impressions || 0),
        total_clicks: (metaDay?.clicks || 0) + (naverDay?.clicks || 0),
        total_spend_krw: metaSpendKrw + naverSpend,
      }
    })

    // ===== 6. 통합 요약 =====
    const totalSpendKrw = metaSpendKrw + totalNaverCost
    const totalImpressions = totalMetaImpressions + totalNaverImpressions
    const totalClicks = totalMetaClicks + totalNaverClicks
    const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0
    const avgCpcKrw = totalClicks > 0 ? Math.round(totalSpendKrw / totalClicks) : 0

    const summary: IntegratedSummary = {
      total_spend_krw: totalSpendKrw,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      avg_ctr: avgCtr,
      avg_cpc_krw: avgCpcKrw,
      meta_spend_usd: Math.round(totalMetaSpendUsd * 100) / 100,
      meta_spend_krw: metaSpendKrw,
      meta_impressions: totalMetaImpressions,
      meta_clicks: totalMetaClicks,
      meta_leads: totalMetaLeads,
      meta_cpl_usd: metaCplUsd,
      meta_cpl_krw: metaCplKrw,
      naver_spend_krw: totalNaverCost,
      naver_impressions: totalNaverImpressions,
      naver_clicks: totalNaverClicks,
      naver_avg_rank: naverSummary.avg_rank,
      channel_ratio: {
        meta_percent: totalSpendKrw > 0 ? Math.round((metaSpendKrw / totalSpendKrw) * 1000) / 10 : 0,
        naver_percent: totalSpendKrw > 0 ? Math.round((totalNaverCost / totalSpendKrw) * 1000) / 10 : 0,
      },
    }

    // ===== 7. 채널 비교 데이터 =====
    const comparison: ChannelComparisonData[] = [
      {
        metric: '광고비',
        meta_value: metaSpendKrw,
        naver_value: totalNaverCost,
        difference: metaSpendKrw - totalNaverCost,
        difference_percent: totalNaverCost > 0 ? Math.round(((metaSpendKrw - totalNaverCost) / totalNaverCost) * 1000) / 10 : 0,
      },
      {
        metric: '노출수',
        meta_value: totalMetaImpressions,
        naver_value: totalNaverImpressions,
        difference: totalMetaImpressions - totalNaverImpressions,
        difference_percent: totalNaverImpressions > 0 ? Math.round(((totalMetaImpressions - totalNaverImpressions) / totalNaverImpressions) * 1000) / 10 : 0,
      },
      {
        metric: '클릭수',
        meta_value: totalMetaClicks,
        naver_value: totalNaverClicks,
        difference: totalMetaClicks - totalNaverClicks,
        difference_percent: totalNaverClicks > 0 ? Math.round(((totalMetaClicks - totalNaverClicks) / totalNaverClicks) * 1000) / 10 : 0,
      },
      {
        metric: 'CTR',
        meta_value: metaCtr,
        naver_value: naverSummary.avg_ctr,
        difference: Math.round((metaCtr - naverSummary.avg_ctr) * 100) / 100,
        difference_percent: naverSummary.avg_ctr > 0 ? Math.round(((metaCtr - naverSummary.avg_ctr) / naverSummary.avg_ctr) * 1000) / 10 : 0,
      },
      {
        metric: 'CPC',
        meta_value: totalMetaClicks > 0 ? convertUsdToKrw(totalMetaSpendUsd / totalMetaClicks) : 0,
        naver_value: naverSummary.avg_cpc,
        difference: totalMetaClicks > 0 ? convertUsdToKrw(totalMetaSpendUsd / totalMetaClicks) - naverSummary.avg_cpc : -naverSummary.avg_cpc,
        difference_percent: naverSummary.avg_cpc > 0 && totalMetaClicks > 0
          ? Math.round(((convertUsdToKrw(totalMetaSpendUsd / totalMetaClicks) - naverSummary.avg_cpc) / naverSummary.avg_cpc) * 1000) / 10
          : 0,
      },
    ]

    // ===== 8. 응답 =====
    const response: IntegratedAnalyticsResponse = {
      success: true,
      summary,
      meta,
      naver,
      daily_combined: dailyCombined,
      comparison,
      period: {
        start: startDate || sortedDates[0] || '',
        end: endDate || sortedDates[sortedDates.length - 1] || '',
      },
      exchange_rate: USD_TO_KRW_RATE,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Integrated analytics error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
