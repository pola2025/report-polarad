/**
 * 월간 리포트 조회 API
 * GET /api/reports/monthly/[id]
 * 데이터 소스: Airtable
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  getReport,
  getReportComment,
  getAirtableClient,
  fetchAirtableData,
  getClientSlugById,
  countNarattonLeads,
} from '@/lib/airtable'
import type { ReportWithComment, MonthlyReportData } from '@/types/report'

// 클라이언트별 환율 설정
// ⚠️ CRITICAL: Airtable에 이미 KRW로 저장되어 있음!
// 환율 중복 적용 절대 금지!
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getExchangeRate(_clientSlug: string): number {
  // 모든 클라이언트: Airtable에 KRW로 저장됨 (환율 적용 불필요)
  return 1
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // 1. Airtable에서 리포트 조회
    const report = await getReport(id)

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // 비공개 리포트는 관리자만 접근 가능
    const adminKey = request.headers.get('x-admin-key')
    const isAdmin = adminKey === (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY)

    if (report.status !== 'published' && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 2. 코멘트 조회
    const comment = await getReportComment(id)

    // 3. 클라이언트 정보 조회
    const client = await getAirtableClient(report.client_id)

    // ReportWithComment 형식으로 변환
    const reportWithComment: ReportWithComment = {
      ...report,
      comment: comment || undefined,
      client: client ? {
        client_name: client.client_name,
        slug: client.slug,
        meta_metric_type: client.meta_metric_type,  // video: H.E.A 판교, lead: 나라똔
      } : undefined,
    }

    // 4. 클라이언트 slug로 광고 데이터 조회
    const clientSlug = client?.slug || getClientSlugById(report.client_id)

    if (!clientSlug) {
      // 광고 데이터 없이 리포트만 반환
      const responseData: MonthlyReportData = {
        report: reportWithComment,
        meta: {
          daily: [],
          campaigns: [],
          videoViews: 0,
          avgWatchTime: 0,
        },
        naver: {
          keywords: [],
        },
      }

      return NextResponse.json({
        success: true,
        data: responseData,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      })
    }

    // 5. Airtable에서 광고 데이터 조회
    const allAdData = await fetchAirtableData(
      clientSlug,
      report.period_start,
      report.period_end
    )

    // Meta 데이터 필터링
    const metaData = allAdData.filter(r => r.source === 'meta')

    // Naver 데이터 필터링 (naver_로 시작하는 모든 source, total/aggregate 제외)
    const naverData = allAdData
      .filter(r => r.source && r.source.startsWith('naver_'))
      .filter(r => {
        const kw = (r.keywords || '').toLowerCase()
        // total, _total_ 키워드만 제외 (빈 문자열은 브랜드검색 데이터이므로 포함)
        if (kw === 'total' || kw === '_total_') return false
        return true
      })

    // 6. Meta 일별 데이터 집계
    const metaDailyMap = new Map<string, {
      date: string
      impressions: number
      clicks: number
      leads: number  // 잠재고객 리드 (Meta API)
      spend: number
      videoViews: number
      avgWatchTime: number
      avgWatchTimeCount: number
    }>()

    for (const row of metaData) {
      const existing = metaDailyMap.get(row.date) || {
        date: row.date,
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
        videoViews: 0,
        avgWatchTime: 0,
        avgWatchTimeCount: 0,
      }
      existing.impressions += row.impressions || 0
      existing.clicks += row.clicks || 0
      existing.leads += row.leads || 0
      existing.spend += row.spend || 0
      existing.videoViews += row.video_views || 0
      if (row.avg_watch_time && row.avg_watch_time > 0) {
        existing.avgWatchTime += row.avg_watch_time
        existing.avgWatchTimeCount += 1
      }
      metaDailyMap.set(row.date, existing)
    }

    // 7. Meta campaign
    const campaignMap = new Map<string, {
      campaign_name: string
      impressions: number
      clicks: number
      leads: number
      spend: number
      video_views: number
      avg_watch_time: number
      avg_watch_time_count: number
    }>()

    for (const row of metaData) {
      const name = row.campaign_name || '(no name)'
      const existing = campaignMap.get(name) || {
        campaign_name: name,
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
        video_views: 0,
        avg_watch_time: 0,
        avg_watch_time_count: 0,
      }
      existing.impressions += row.impressions || 0
      existing.clicks += row.clicks || 0
      existing.leads += row.leads || 0
      existing.spend += row.spend || 0
      existing.video_views += row.video_views || 0
      if (row.avg_watch_time && row.avg_watch_time > 0) {
        existing.avg_watch_time += row.avg_watch_time
        existing.avg_watch_time_count += 1
      }
      campaignMap.set(name, existing)
    }

    const exchangeRate = getExchangeRate(clientSlug)

    const campaignsWithMetrics = Array.from(campaignMap.values()).map((c) => ({
      ...c,
      spend: c.spend * exchangeRate,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cpl: c.leads > 0 ? (c.spend * exchangeRate) / c.leads : 0,
      video_views: c.video_views,
      avg_watch_time: c.avg_watch_time_count > 0 ? c.avg_watch_time / c.avg_watch_time_count : 0,
    }))

    // 8. Naver keyword 집계
    const naverDailyMap = new Map<string, {
      impressions: number
      clicks: number
      totalCost: number
    }>()

    const keywordMap = new Map<string, {
      keyword: string
      impressions: number
      clicks: number
      totalCost: number
      avgRank: number
      count: number
    }>()

    for (const row of naverData) {
      // daily
      const dailyExisting = naverDailyMap.get(row.date) || {
        impressions: 0,
        clicks: 0,
        totalCost: 0,
      }
      dailyExisting.impressions += row.impressions || 0
      dailyExisting.clicks += row.clicks || 0
      dailyExisting.totalCost += row.spend || 0
      naverDailyMap.set(row.date, dailyExisting)

      // keyword
      const keyword = row.keywords || '_unknown_'
      const kwExisting = keywordMap.get(keyword) || {
        keyword,
        impressions: 0,
        clicks: 0,
        totalCost: 0,
        avgRank: 0,
        count: 0,
      }
      kwExisting.impressions += row.impressions || 0
      kwExisting.clicks += row.clicks || 0
      kwExisting.totalCost += row.spend || 0
      kwExisting.avgRank += row.avg_rank || 0
      kwExisting.count += 1
      keywordMap.set(keyword, kwExisting)
    }

    const keywordsWithMetrics = Array.from(keywordMap.values())
      .filter((k) => k.keyword !== '_unknown_') // 브랜드검색 데이터는 키워드 분석에서 제외
      .map((k) => ({
        keyword: k.keyword,
        impressions: k.impressions,
        clicks: k.clicks,
        totalCost: k.totalCost,
        ctr: k.impressions > 0 ? (k.clicks / k.impressions) * 100 : 0,
        avgCpc: k.clicks > 0 ? k.totalCost / k.clicks : 0,
        avgRank: k.count > 0 ? k.avgRank / k.count : 0,
      }))

    // 9. daily data
    const allDates = new Set<string>()
    metaDailyMap.forEach((_, date) => allDates.add(date))
    naverDailyMap.forEach((_, date) => allDates.add(date))

    const dailyData = Array.from(allDates)
      .sort()
      .map(date => {
        const meta = metaDailyMap.get(date)
        const naver = naverDailyMap.get(date)

        return {
          date,
          impressions: (meta?.impressions || 0) + (naver?.impressions || 0),
          clicks: (meta?.clicks || 0) + (naver?.clicks || 0),
          leads: meta?.leads || 0,  // 잠재고객 리드 (Meta API)
          spend: ((meta?.spend || 0) * exchangeRate) + (naver?.totalCost || 0),
          videoViews: meta?.videoViews || 0,
          avgWatchTime: meta?.avgWatchTimeCount && meta.avgWatchTimeCount > 0
            ? meta.avgWatchTime / meta.avgWatchTimeCount
            : 0,
          // channel detail
          metaImpressions: meta?.impressions || 0,
          metaClicks: meta?.clicks || 0,
          metaSpend: (meta?.spend || 0) * exchangeRate,
          naverImpressions: naver?.impressions || 0,
          naverClicks: naver?.clicks || 0,
          naverSpend: naver?.totalCost || 0,
        }
      })

    // total video stats
    const totalVideoViews = dailyData.reduce((sum, d) => sum + d.videoViews, 0)
    const validAvgWatchTimeEntries = dailyData.filter(d => d.avgWatchTime > 0)
    const overallAvgWatchTime = validAvgWatchTimeEntries.length > 0
      ? validAvgWatchTimeEntries.reduce((sum, d) => sum + d.avgWatchTime, 0) / validAvgWatchTimeEntries.length
      : 0

    // 리드 집계
    // - 잠재고객 리드 (Meta API leads) - 빨간색
    const totalMetaLeads = dailyData.reduce((sum, d) => sum + d.leads, 0)
    // - 트래픽 리드 (홈페이지 리드상세 테이블에서 집계) - 녹색
    let totalHomepageLeads = 0
    if (clientSlug === 'naratton') {
      try {
        totalHomepageLeads = await countNarattonLeads(report.period_start, report.period_end)
      } catch (e) {
        console.error('나라똔 홈페이지 리드 조회 실패:', e)
      }
    }

    const responseData: MonthlyReportData = {
      report: reportWithComment,
      meta: {
        daily: dailyData,
        campaigns: campaignsWithMetrics,
        videoViews: totalVideoViews,
        avgWatchTime: overallAvgWatchTime,
        actualLeads: totalMetaLeads,  // 잠재고객 리드 (Meta API - 빨간색)
        homepageLeads: totalHomepageLeads,  // 트래픽 리드 (홈페이지 - 녹색)
      },
      naver: {
        keywords: keywordsWithMetrics,
      },
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
