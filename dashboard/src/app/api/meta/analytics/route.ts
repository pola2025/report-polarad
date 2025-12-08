/**
 * Meta 광고 분석 API
 * 일간/주간/월간 집계 및 캠페인/광고별 분석
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, TABLES } from '@/lib/supabase'
import { convertUsdToKrw } from '@/lib/constants'
import type {
  MetaDailyData,
  MetaWeeklyData,
  MetaMonthlyData,
  MetaCampaignData,
  MetaAdData,
  MetaKPISummary,
  MetaPeriodDataResponse,
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
    let clientId = searchParams.get('clientId')
    const clientSlug = searchParams.get('clientSlug')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const view = searchParams.get('view') || 'all' // daily, weekly, monthly, campaigns, ads, all

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

    // 기본 쿼리 빌드
    let query = supabase
      .from(TABLES.META_DATA)
      .select('*')
      .order('date', { ascending: true })

    // clientId가 있으면 필터링
    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data: rawData, error } = await query

    if (error) {
      console.error('Meta analytics error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({
        daily: [],
        weekly: [],
        monthly: [],
        campaigns: [],
        ads: [],
        summary: {
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
        },
      })
    }

    // 일별 집계용 내부 타입 (임시 필드 포함)
    type InternalDailyData = MetaDailyData & { _total_watch_time: number }
    const dailyMap = new Map<string, InternalDailyData>()
    const campaignMap = new Map<string, MetaCampaignData>()
    const adMap = new Map<string, MetaAdData>()

    for (const row of rawData) {
      const date = row.date
      const campaignId = row.campaign_id || 'unknown'
      const adId = row.ad_id

      // 일별 집계
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          spend: 0,
          spend_krw: 0,
          leads: 0,
          cpl: 0,
          cpl_krw: 0,
          video_views: 0,
          avg_watch_time: 0,
          _total_watch_time: 0, // 임시: 총 시청 시간 (video_views * avg_watch_time)
        })
      }
      const daily = dailyMap.get(date)!
      daily.impressions += row.impressions || 0
      daily.clicks += row.clicks || 0
      daily.spend += parseFloat(row.spend) || 0
      daily.leads += row.leads || 0
      const rowVideoViews = row.video_views || 0
      const rowAvgWatchTime = row.avg_watch_time || 0
      daily.video_views += rowVideoViews
      daily._total_watch_time += rowVideoViews * rowAvgWatchTime // 가중치 누적

      // 캠페인별 집계
      if (campaignId && campaignId !== 'unknown') {
        if (!campaignMap.has(campaignId)) {
          campaignMap.set(campaignId, {
            campaign_id: campaignId,
            campaign_name: row.campaign_name || campaignId,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            spend: 0,
            spend_krw: 0,
            leads: 0,
            cpl: 0,
            cpl_krw: 0,
            days_count: 0,
            first_date: date,
            last_date: date,
          })
        }
        const campaign = campaignMap.get(campaignId)!
        campaign.impressions += row.impressions || 0
        campaign.clicks += row.clicks || 0
        campaign.spend += parseFloat(row.spend) || 0
        campaign.leads += row.leads || 0
        campaign.days_count += 1
        if (date < campaign.first_date) campaign.first_date = date
        if (date > campaign.last_date) campaign.last_date = date
      }

      // 광고별 집계
      if (!adMap.has(adId)) {
        adMap.set(adId, {
          ad_id: adId,
          ad_name: row.ad_name || adId,
          campaign_name: row.campaign_name,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          spend: 0,
          spend_krw: 0,
          leads: 0,
          cpl: 0,
          cpl_krw: 0,
          video_views: 0,
          days_count: 0,
          first_date: date,
          last_date: date,
        })
      }
      const ad = adMap.get(adId)!
      ad.impressions += row.impressions || 0
      ad.clicks += row.clicks || 0
      ad.spend += parseFloat(row.spend) || 0
      ad.leads += row.leads || 0
      ad.video_views += row.video_views || 0
      ad.days_count += 1
      if (date < ad.first_date) ad.first_date = date
      if (date > ad.last_date) ad.last_date = date
    }

    // 일별 CTR, CPL, KRW, 평균시청시간 계산
    const daily: MetaDailyData[] = Array.from(dailyMap.values()).map((d) => {
      const avgWatchTime = d.video_views > 0
        ? Math.round((d._total_watch_time / d.video_views) * 10) / 10
        : 0
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _total_watch_time, ...rest } = d
      return {
        ...rest,
        ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
        spend_krw: convertUsdToKrw(d.spend),
        cpl: d.leads > 0 ? Math.round((d.spend / d.leads) * 100) / 100 : 0,
        cpl_krw: d.leads > 0 ? convertUsdToKrw(d.spend / d.leads) : 0,
        avg_watch_time: avgWatchTime,
      }
    })

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
      week.video_views += d.video_views
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
      curr.spend_change =
        prev.spend > 0
          ? Math.round(((curr.spend - prev.spend) / prev.spend) * 1000) / 10
          : 0
      curr.leads_change =
        prev.leads > 0
          ? Math.round(((curr.leads - prev.leads) / prev.leads) * 1000) / 10
          : 0
    }

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
          days: [],
        })
      }
      const monthData = monthlyMap.get(month)!
      monthData.impressions += d.impressions
      monthData.clicks += d.clicks
      monthData.spend += d.spend
      monthData.leads += d.leads
      monthData.video_views += d.video_views
      monthData.days!.push(d)
    }

    const monthly: MetaMonthlyData[] = Array.from(monthlyMap.values())
      .map((m) => {
        // 해당 월의 주별 데이터 추가
        const monthWeeks = weekly.filter(
          (w) => w.week_start.substring(0, 7) === m.month || w.week_end.substring(0, 7) === m.month
        )
        // 월별 평균시청시간 계산 (가중평균)
        const totalWatchTime = m.days!.reduce((sum, d) => sum + (d.video_views * d.avg_watch_time), 0)
        const avgWatchTime = m.video_views > 0
          ? Math.round((totalWatchTime / m.video_views) * 10) / 10
          : 0
        return {
          ...m,
          ctr: m.impressions > 0 ? Math.round((m.clicks / m.impressions) * 10000) / 100 : 0,
          spend_krw: convertUsdToKrw(m.spend),
          cpl: m.leads > 0 ? Math.round((m.spend / m.leads) * 100) / 100 : 0,
          cpl_krw: m.leads > 0 ? convertUsdToKrw(m.spend / m.leads) : 0,
          avg_watch_time: avgWatchTime,
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
      curr.spend_change =
        prev.spend > 0
          ? Math.round(((curr.spend - prev.spend) / prev.spend) * 1000) / 10
          : 0
      curr.leads_change =
        prev.leads > 0
          ? Math.round(((curr.leads - prev.leads) / prev.leads) * 1000) / 10
          : 0
    }

    // 캠페인별 CTR, CPL, KRW 계산
    const campaigns: MetaCampaignData[] = Array.from(campaignMap.values())
      .map((c) => ({
        ...c,
        ctr: c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 10000) / 100 : 0,
        spend_krw: convertUsdToKrw(c.spend),
        cpl: c.leads > 0 ? Math.round((c.spend / c.leads) * 100) / 100 : 0,
        cpl_krw: c.leads > 0 ? convertUsdToKrw(c.spend / c.leads) : 0,
      }))
      .sort((a, b) => b.spend - a.spend)

    // 광고별 CTR, CPL, KRW 계산
    const ads: MetaAdData[] = Array.from(adMap.values())
      .map((a) => ({
        ...a,
        ctr: a.impressions > 0 ? Math.round((a.clicks / a.impressions) * 10000) / 100 : 0,
        spend_krw: convertUsdToKrw(a.spend),
        cpl: a.leads > 0 ? Math.round((a.spend / a.leads) * 100) / 100 : 0,
        cpl_krw: a.leads > 0 ? convertUsdToKrw(a.spend / a.leads) : 0,
      }))
      .sort((a, b) => b.spend - a.spend)

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
      unique_campaigns: campaigns.length,
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
      campaigns: view === 'all' || view === 'campaigns' ? campaigns : [],
      ads: view === 'all' || view === 'ads' ? ads : [],
      summary,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
