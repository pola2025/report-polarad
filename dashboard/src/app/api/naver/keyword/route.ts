/**
 * 네이버 플레이스 광고 - 키워드별 상세 분석 API
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'
import type { NaverKeywordDailyTrend, NaverKeywordData } from '@/types/naver-analytics'

// GET: 특정 키워드의 일별 추이 또는 키워드 목록
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const keyword = searchParams.get('keyword')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // 특정 키워드의 일별 추이
    if (keyword) {
      let query = getSupabaseAdmin()
        .from(TABLES.NAVER_DATA)
        .select('*')
        .eq('client_id', clientId)
        .eq('keyword', keyword)
        .order('date', { ascending: true })

      if (startDate) query = query.gte('date', startDate)
      if (endDate) query = query.lte('date', endDate)

      const { data, error } = await query

      if (error) {
        console.error('Keyword detail error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const trend: NaverKeywordDailyTrend[] = (data || []).map((row) => ({
        date: row.date,
        keyword: row.keyword,
        impressions: row.impressions || 0,
        clicks: row.clicks || 0,
        ctr: row.ctr || 0,
        avg_cpc: row.avg_cpc || 0,
        total_cost: row.total_cost || 0,
        avg_rank: row.avg_rank || 0,
      }))

      // 키워드 요약 통계
      const totalImpressions = trend.reduce((sum, t) => sum + t.impressions, 0)
      const totalClicks = trend.reduce((sum, t) => sum + t.clicks, 0)
      const totalCost = trend.reduce((sum, t) => sum + t.total_cost, 0)
      const avgRank =
        trend.length > 0
          ? Math.round((trend.reduce((sum, t) => sum + t.avg_rank, 0) / trend.length) * 10) / 10
          : 0

      const summary: NaverKeywordData = {
        keyword,
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
        avg_cpc: totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0,
        total_cost: totalCost,
        avg_rank: avgRank,
        days_count: trend.length,
        first_date: trend.length > 0 ? trend[0].date : '',
        last_date: trend.length > 0 ? trend[trend.length - 1].date : '',
      }

      return NextResponse.json({
        keyword,
        summary,
        trend,
      })
    }

    // 키워드 목록 (집계)
    let query = getSupabaseAdmin()
      .from(TABLES.NAVER_DATA)
      .select('keyword, impressions, clicks, ctr, avg_cpc, total_cost, avg_rank, date')
      .eq('client_id', clientId)
      .order('date', { ascending: false })

    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query

    if (error) {
      console.error('Keywords list error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 키워드별 집계
    const keywordMap = new Map<
      string,
      {
        impressions: number
        clicks: number
        total_cost: number
        avg_rank: number
        count: number
        first_date: string
        last_date: string
      }
    >()

    for (const row of data || []) {
      const kw = row.keyword
      if (!keywordMap.has(kw)) {
        keywordMap.set(kw, {
          impressions: 0,
          clicks: 0,
          total_cost: 0,
          avg_rank: 0,
          count: 0,
          first_date: row.date,
          last_date: row.date,
        })
      }
      const stat = keywordMap.get(kw)!
      stat.impressions += row.impressions || 0
      stat.clicks += row.clicks || 0
      stat.total_cost += row.total_cost || 0
      stat.avg_rank += row.avg_rank || 0
      stat.count += 1
      if (row.date < stat.first_date) stat.first_date = row.date
      if (row.date > stat.last_date) stat.last_date = row.date
    }

    const keywords: NaverKeywordData[] = Array.from(keywordMap.entries())
      .map(([keyword, stat]) => ({
        keyword,
        impressions: stat.impressions,
        clicks: stat.clicks,
        ctr:
          stat.impressions > 0 ? Math.round((stat.clicks / stat.impressions) * 10000) / 100 : 0,
        avg_cpc: stat.clicks > 0 ? Math.round(stat.total_cost / stat.clicks) : 0,
        total_cost: stat.total_cost,
        avg_rank: stat.count > 0 ? Math.round((stat.avg_rank / stat.count) * 10) / 10 : 0,
        days_count: stat.count,
        first_date: stat.first_date,
        last_date: stat.last_date,
      }))
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, limit)

    return NextResponse.json({
      keywords,
      total: keywordMap.size,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
