/**
 * 네이버 플레이스 광고 - 키워드별 상세 분석 API
 * 데이터 소스: Airtable (클라이언트별 광고 데이터 테이블)
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { AIRTABLE_CONFIG, fetchAirtableData } from '@/lib/airtable'
import type { NaverKeywordDailyTrend, NaverKeywordData } from '@/types/naver-analytics'

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!
const AIRTABLE_CLIENTS_BASE_ID = 'appC3XKBcYgZBTETn'
const AIRTABLE_CLIENTS_TABLE_ID = 'tblwQBbsMyg00qi8F'

// Airtable에서 클라이언트 조회 (UUID 또는 slug로)
async function getClientFromAirtable(clientIdOrSlug: string) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_CLIENTS_BASE_ID}/${AIRTABLE_CLIENTS_TABLE_ID}`

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  })

  const data = await response.json()
  if (data.error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = data.records.find((r: any) =>
    r.fields.id === clientIdOrSlug || r.fields.slug === clientIdOrSlug
  )

  if (!record) return null

  return {
    id: record.fields.id || record.id,
    client_name: record.fields.Name,
    slug: record.fields.slug,
  }
}

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

    // Airtable에서 클라이언트 조회
    const client = await getClientFromAirtable(clientId)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // 클라이언트별 Airtable 설정 확인
    const airtableConfig = AIRTABLE_CONFIG[client.slug]
    if (!airtableConfig) {
      return NextResponse.json({ error: `Airtable config not found for ${client.slug}` }, { status: 400 })
    }

    // Airtable에서 naver_place 데이터 조회
    const airtableData = await fetchAirtableData(
      client.slug,
      startDate || '2020-01-01',
      endDate || new Date().toISOString().split('T')[0],
      'naver_place'
    )

    // Airtable 데이터를 기존 형식으로 변환 (total/총계 제외)
    const rawData = airtableData
      .filter(record => {
        const kw = (record.keywords || '').toLowerCase()
        if (kw === 'total' || kw === '총계' || kw === '합계' || kw === '' || kw === '_unattributed_') return false
        return true
      })
      .map(record => ({
        date: record.date,
        keyword: record.keywords || '_unknown_',
        impressions: record.impressions || 0,
        clicks: record.clicks || 0,
        ctr: record.impressions > 0 ? Math.round((record.clicks / record.impressions) * 10000) / 100 : 0,
        avg_cpc: record.avg_cpc || 0,
        total_cost: record.spend || 0,
        avg_rank: record.avg_rank || 1,
      }))

    // 특정 키워드의 일별 추이
    if (keyword) {
      const keywordData = rawData
        .filter(row => row.keyword === keyword)
        .sort((a, b) => a.date.localeCompare(b.date))

      const trend: NaverKeywordDailyTrend[] = keywordData.map((row) => ({
        date: row.date,
        keyword: row.keyword,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        avg_cpc: row.avg_cpc,
        total_cost: row.total_cost,
        avg_rank: row.avg_rank,
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

    for (const row of rawData) {
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
      stat.impressions += row.impressions
      stat.clicks += row.clicks
      stat.total_cost += row.total_cost
      stat.avg_rank += row.avg_rank
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
