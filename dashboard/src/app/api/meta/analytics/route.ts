/**
 * Meta 광고 분석 API
 * Airtable에서 데이터 조회 (일별 집계)
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, TABLES } from '@/lib/supabase'
import { fetchAirtableData, getClientSlugById } from '@/lib/airtable'
import { convertUsdToKrw } from '@/lib/constants'
import type {
  MetaDailyData,
  MetaWeeklyData,
  MetaMonthlyData,
  MetaKPISummary,
  MetaPeriodDataResponse,
  MetaAdData,
} from '@/types/meta-analytics'

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

// GET: Meta 분석 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const clientSlug = searchParams.get('clientSlug')
    const startDate = searchParams.get('startDate') || '2025-01-01'
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const view = searchParams.get('view') || 'all'

    // slug 결정 로직
    const supabase = createServerClient()
    let resolvedSlug = clientSlug

    // clientId가 이미 slug 형태인지 확인 (Airtable config에 있으면 slug)
    if (clientId) {
      const { AIRTABLE_CONFIG } = await import('@/lib/airtable')
      if (AIRTABLE_CONFIG[clientId]) {
        // clientId가 이미 slug 형태
        resolvedSlug = clientId
      } else {
        // clientId가 UUID라면 slug로 변환
        resolvedSlug = getClientSlugById(clientId)
      }
    }

    // clientSlug만 제공된 경우 Supabase에서 조회
    if (!resolvedSlug && clientSlug) {
      const { data: client } = await supabase
        .from(TABLES.CLIENTS)
        .select('id')
        .eq('slug', clientSlug)
        .single()
      if (client?.id) {
        resolvedSlug = getClientSlugById(client.id)
      }
    }

    if (!resolvedSlug) {
      return NextResponse.json({
        daily: [],
        weekly: [],
        monthly: [],
        campaigns: [],
        ads: [],
        summary: createEmptySummary(),
      })
    }

    // Airtable에서 Meta 데이터 조회
    const rawData = await fetchAirtableData(resolvedSlug, startDate, endDate, 'meta')

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({
        daily: [],
        weekly: [],
        monthly: [],
        campaigns: [],
        ads: [],
        summary: createEmptySummary(),
      })
    }

    // 일별 집계
    const dailyMap = new Map<string, {
      impressions: number
      clicks: number
      leads: number
      spend: number
      video_views: number
      video_thruplay: number
    }>()

    for (const row of rawData) {
      const date = row.date
      const existing = dailyMap.get(date) || { impressions: 0, clicks: 0, leads: 0, spend: 0, video_views: 0, video_thruplay: 0 }
      existing.impressions += row.impressions || 0
      existing.clicks += row.clicks || 0
      existing.leads += row.leads || 0
      existing.spend += row.spend || 0
      existing.video_views += row.video_views || 0
      existing.video_thruplay += row.video_thruplay || 0
      dailyMap.set(date, existing)
    }

    // 일별 데이터 생성
    const daily: MetaDailyData[] = Array.from(dailyMap.entries())
      .map(([date, d]) => ({
        date,
        impressions: d.impressions,
        clicks: d.clicks,
        ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
        spend: d.spend,
        spend_krw: convertUsdToKrw(d.spend),
        leads: d.leads,
        cpl: d.leads > 0 ? Math.round((d.spend / d.leads) * 100) / 100 : 0,
        cpl_krw: d.leads > 0 ? convertUsdToKrw(d.spend / d.leads) : 0,
        video_views: d.video_views,
        avg_watch_time: d.video_thruplay > 0 && d.video_views > 0
          ? Math.round((d.video_thruplay / d.video_views) * 100) / 100
          : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // 주별 집계
    const weeklyMap = new Map<string, MetaWeeklyData>()
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
          spend: 0,
          spend_krw: 0,
          leads: 0,
          cpl: 0,
          cpl_krw: 0,
          video_views: 0,
        })
      }
      const week = weeklyMap.get(weekLabel)!
      week.impressions += d.impressions
      week.clicks += d.clicks
      week.spend += d.spend
      week.leads += d.leads
    }

    const weekly: MetaWeeklyData[] = Array.from(weeklyMap.values())
      .map((w) => ({
        ...w,
        ctr: w.impressions > 0 ? Math.round((w.clicks / w.impressions) * 10000) / 100 : 0,
        spend_krw: convertUsdToKrw(w.spend),
        cpl: w.leads > 0 ? Math.round((w.spend / w.leads) * 100) / 100 : 0,
        cpl_krw: w.leads > 0 ? convertUsdToKrw(w.spend / w.leads) : 0,
      }))
      .sort((a, b) => a.week_start.localeCompare(b.week_start))

    // 월별 집계
    const monthlyMap = new Map<string, MetaMonthlyData>()
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
          spend: 0,
          spend_krw: 0,
          leads: 0,
          cpl: 0,
          cpl_krw: 0,
          video_views: 0,
        })
      }
      const monthData = monthlyMap.get(month)!
      monthData.impressions += d.impressions
      monthData.clicks += d.clicks
      monthData.spend += d.spend
      monthData.leads += d.leads
    }

    const monthly: MetaMonthlyData[] = Array.from(monthlyMap.values())
      .map((m) => ({
        ...m,
        ctr: m.impressions > 0 ? Math.round((m.clicks / m.impressions) * 10000) / 100 : 0,
        spend_krw: convertUsdToKrw(m.spend),
        cpl: m.leads > 0 ? Math.round((m.spend / m.leads) * 100) / 100 : 0,
        cpl_krw: m.leads > 0 ? convertUsdToKrw(m.spend / m.leads) : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // 광고별 집계 (ad_id 기준)
    const adMap = new Map<string, {
      ad_id: string
      ad_name: string  // campaign_name 필드에 저장된 "광고명 (캠페인명)"
      impressions: number
      clicks: number
      leads: number
      spend: number
      video_views: number
      video_thruplay: number
      dates: Set<string>
      firstDate: string
      lastDate: string
    }>()

    for (const row of rawData) {
      // ad_id가 있으면 ad_id 기준, 없으면 campaign_name 기준 (호환성)
      const adId = row.ad_id || row.campaign_name || '(광고 없음)'
      const adName = row.campaign_name || '(광고명 없음)'

      const existing = adMap.get(adId) || {
        ad_id: adId,
        ad_name: adName,
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
        video_views: 0,
        video_thruplay: 0,
        dates: new Set<string>(),
        firstDate: row.date,
        lastDate: row.date,
      }
      existing.impressions += row.impressions || 0
      existing.clicks += row.clicks || 0
      existing.leads += row.leads || 0
      existing.spend += row.spend || 0
      existing.video_views += row.video_views || 0
      existing.video_thruplay += row.video_thruplay || 0
      existing.dates.add(row.date)
      if (row.date < existing.firstDate) existing.firstDate = row.date
      if (row.date > existing.lastDate) existing.lastDate = row.date
      adMap.set(adId, existing)
    }

    const ads: MetaAdData[] = Array.from(adMap.values())
      .map((data) => ({
        ad_id: data.ad_id,
        ad_name: data.ad_name,
        campaign_name: data.ad_name,  // 호환성 유지
        impressions: data.impressions,
        clicks: data.clicks,
        ctr: data.impressions > 0 ? Math.round((data.clicks / data.impressions) * 10000) / 100 : 0,
        spend: data.spend,
        spend_krw: convertUsdToKrw(data.spend),
        leads: data.leads,
        cpl: data.leads > 0 ? Math.round((data.spend / data.leads) * 100) / 100 : 0,
        cpl_krw: data.leads > 0 ? convertUsdToKrw(data.spend / data.leads) : 0,
        video_views: data.video_views,
        video_thruplay: data.video_thruplay,
        avg_watch_time: data.video_views > 0 && data.video_thruplay > 0
          ? Math.round((data.video_thruplay / data.video_views) * 100) / 100
          : 0,
        days_count: data.dates.size,
        first_date: data.firstDate,
        last_date: data.lastDate,
      }))
      .filter(ad => ad.ad_name !== '(광고 없음)' || ad.impressions > 0)  // 빈 광고 제외 (데이터 있으면 포함)
      .sort((a, b) => b.spend_krw - a.spend_krw)  // 지출액 높은 순 정렬

    // 전체 요약
    const totalImpressions = daily.reduce((sum, d) => sum + d.impressions, 0)
    const totalClicks = daily.reduce((sum, d) => sum + d.clicks, 0)
    const totalSpend = daily.reduce((sum, d) => sum + d.spend, 0)
    const totalLeads = daily.reduce((sum, d) => sum + d.leads, 0)
    const totalVideoViews = daily.reduce((sum, d) => sum + d.video_views, 0)
    const dates = daily.map((d) => d.date).sort()

    const summary: MetaKPISummary = {
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_spend: Math.round(totalSpend * 100) / 100,
      total_spend_krw: convertUsdToKrw(totalSpend),
      total_leads: totalLeads,
      avg_ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
      avg_cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : 0,
      avg_cpl_krw: totalLeads > 0 ? convertUsdToKrw(totalSpend / totalLeads) : 0,
      total_video_views: totalVideoViews,
      unique_campaigns: ads.length,
      unique_ads: ads.length,
      data_days: daily.length,
      date_range: {
        start: dates[0] || '',
        end: dates[dates.length - 1] || '',
      },
    }

    // 응답 데이터 구성
    const response: MetaPeriodDataResponse = {
      daily: view === 'all' || view === 'daily' ? daily : [],
      weekly: view === 'all' || view === 'weekly' ? weekly : [],
      monthly: view === 'all' || view === 'monthly' ? monthly : [],
      campaigns: [], // 추후 캠페인 상세 분석용
      ads,  // 캠페인별 성과 분석
      summary,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Meta analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function createEmptySummary(): MetaKPISummary {
  return {
    total_impressions: 0,
    total_clicks: 0,
    total_spend: 0,
    total_spend_krw: 0,
    total_leads: 0,
    avg_ctr: 0,
    avg_cpl: 0,
    avg_cpl_krw: 0,
    total_video_views: 0,
    unique_campaigns: 0,
    unique_ads: 0,
    data_days: 0,
    date_range: { start: '', end: '' },
  }
}
