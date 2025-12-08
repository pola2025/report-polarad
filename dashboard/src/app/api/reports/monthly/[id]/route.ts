/**
 * 월간 리포트 조회 API
 * GET /api/reports/monthly/[id]
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'
import type { ReportWithComment, MonthlyReportData } from '@/types/report'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = getSupabaseAdmin()

    // 리포트 조회 (코멘트, 클라이언트 정보 포함)
    const { data: report, error: reportError } = await supabase
      .from(TABLES.REPORTS)
      .select(`
        *,
        polarad_report_comments (
          id,
          content,
          content_html,
          author_name,
          author_role,
          is_visible,
          created_at,
          updated_at
        ),
        polarad_clients (
          id,
          client_name,
          slug
        )
      `)
      .eq('id', id)
      .single()

    if (reportError) {
      if (reportError.code === 'PGRST116') {
        return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 })
      }
      console.error('Error fetching report:', reportError)
      return NextResponse.json({ error: reportError.message }, { status: 500 })
    }

    // 공개되지 않은 리포트는 관리자만 접근 가능
    const adminKey = request.headers.get('x-admin-key')
    const isAdmin = adminKey === (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY)

    if (report.status !== 'published' && !isAdmin) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    // 형식 변환
    const reportWithComment: ReportWithComment = {
      ...report,
      comment: report.polarad_report_comments?.[0] || null,
      client: report.polarad_clients || null,
    }

    // 클라이언트 UUID 가져오기 (Meta 데이터 조회용)
    const clientUuid = report.polarad_clients?.id

    // Meta 일별 데이터 조회
    const { data: metaDaily } = await supabase
      .from(TABLES.META_DATA)
      .select('date, impressions, clicks, leads, spend')
      .eq('client_id', clientUuid)
      .gte('date', report.period_start)
      .lte('date', report.period_end)
      .order('date', { ascending: true })

    // Meta 캠페인별 데이터 집계
    const { data: metaCampaigns } = await supabase
      .from(TABLES.META_DATA)
      .select('campaign_name, impressions, clicks, leads, spend')
      .eq('client_id', clientUuid)
      .gte('date', report.period_start)
      .lte('date', report.period_end)

    // 캠페인별 집계
    const campaignMap = new Map<string, {
      campaign_name: string
      impressions: number
      clicks: number
      leads: number
      spend: number
    }>()

    metaCampaigns?.forEach((row) => {
      const name = row.campaign_name || '(이름 없음)'
      const existing = campaignMap.get(name) || {
        campaign_name: name,
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
      }
      existing.impressions += row.impressions || 0
      existing.clicks += row.clicks || 0
      existing.leads += row.leads || 0
      existing.spend += row.spend || 0
      campaignMap.set(name, existing)
    })

    const campaignsWithMetrics = Array.from(campaignMap.values()).map((c) => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cpl: c.leads > 0 ? c.spend / c.leads : 0,
    }))

    // 네이버 키워드 데이터 조회
    const { data: naverKeywords } = await supabase
      .from(TABLES.NAVER_DATA)
      .select('keyword, impressions, clicks, total_cost, ctr, avg_cpc, avg_rank')
      .eq('client_id', clientUuid)
      .gte('date', report.period_start)
      .lte('date', report.period_end)

    // 키워드별 집계
    const keywordMap = new Map<string, {
      keyword: string
      impressions: number
      clicks: number
      totalCost: number
      avgRank: number
      count: number
    }>()

    naverKeywords?.forEach((row) => {
      const keyword = row.keyword
      const existing = keywordMap.get(keyword) || {
        keyword,
        impressions: 0,
        clicks: 0,
        totalCost: 0,
        avgRank: 0,
        count: 0,
      }
      existing.impressions += row.impressions || 0
      existing.clicks += row.clicks || 0
      existing.totalCost += row.total_cost || 0
      existing.avgRank += row.avg_rank || 0
      existing.count += 1
      keywordMap.set(keyword, existing)
    })

    const keywordsWithMetrics = Array.from(keywordMap.values()).map((k) => ({
      keyword: k.keyword,
      impressions: k.impressions,
      clicks: k.clicks,
      totalCost: k.totalCost,
      ctr: k.impressions > 0 ? (k.clicks / k.impressions) * 100 : 0,
      avgCpc: k.clicks > 0 ? k.totalCost / k.clicks : 0,
      avgRank: k.count > 0 ? k.avgRank / k.count : 0,
    }))

    // 일별 데이터 집계
    const dailyMap = new Map<string, {
      date: string
      impressions: number
      clicks: number
      leads: number
      spend: number
    }>()

    metaDaily?.forEach((row) => {
      const date = row.date
      const existing = dailyMap.get(date) || {
        date,
        impressions: 0,
        clicks: 0,
        leads: 0,
        spend: 0,
      }
      existing.impressions += row.impressions || 0
      existing.clicks += row.clicks || 0
      existing.leads += row.leads || 0
      existing.spend += row.spend || 0
      dailyMap.set(date, existing)
    })

    const dailyData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    const responseData: MonthlyReportData = {
      report: reportWithComment,
      meta: {
        daily: dailyData,
        campaigns: campaignsWithMetrics,
      },
      naver: {
        keywords: keywordsWithMetrics,
      },
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
