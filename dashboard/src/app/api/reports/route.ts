/**
 * 클라이언트용 리포트 목록 API
 * GET /api/reports?clientSlug=xxx
 * 데이터 소스: Airtable
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getReports, getAirtableClient } from '@/lib/airtable'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug')
    const reportType = searchParams.get('type') as 'monthly' | 'weekly' | null

    if (!clientSlug) {
      return NextResponse.json({ error: 'clientSlug is required' }, { status: 400 })
    }

    // Airtable에서 클라이언트 조회
    const client = await getAirtableClient(clientSlug)

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Airtable에서 리포트 목록 조회 (published만)
    const reports = await getReports({
      clientSlug,
      status: 'published',
      reportType: reportType && reportType !== 'all' ? reportType : undefined,
    })

    // 리포트 포맷팅 (표시용 라벨 추가)
    const formattedReports = reports.map((r) => ({
      id: r.id,
      report_type: r.report_type,
      period_start: r.period_start,
      period_end: r.period_end,
      year: r.year,
      month: r.month,
      week: r.week,
      status: r.status,
      published_at: r.published_at,
      created_at: r.created_at,
      label: r.report_type === 'monthly'
        ? `${r.year}년 ${r.month}월 리포트`
        : `${r.year}년 ${r.month}월 ${r.week}주차 리포트`,
      url: `/report/monthly/${r.id}`,
    }))

    // period_start 내림차순 정렬
    formattedReports.sort((a, b) => b.period_start.localeCompare(a.period_start))

    return NextResponse.json({
      success: true,
      client: {
        slug: clientSlug,
        name: client.client_name,
      },
      reports: formattedReports.slice(0, 50),
      total: formattedReports.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
