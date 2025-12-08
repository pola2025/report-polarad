/**
 * 클라이언트용 리포트 목록 API
 * GET /api/reports?clientSlug=xxx
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug')
    const reportType = searchParams.get('type') // monthly | weekly | all

    if (!clientSlug) {
      return NextResponse.json({ error: 'clientSlug is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 클라이언트 ID 조회
    const { data: client, error: clientError } = await supabase
      .from(TABLES.CLIENTS)
      .select('client_id, client_name')
      .eq('slug', clientSlug)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: '클라이언트를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 리포트 목록 조회 (published만)
    let query = supabase
      .from(TABLES.REPORTS)
      .select(`
        id,
        report_type,
        period_start,
        period_end,
        year,
        month,
        week,
        status,
        published_at,
        created_at
      `)
      .eq('client_id', client.client_id)
      .eq('status', 'published')
      .order('period_start', { ascending: false })

    if (reportType && reportType !== 'all') {
      query = query.eq('report_type', reportType)
    }

    const { data: reports, error: reportsError } = await query.limit(50)

    if (reportsError) {
      console.error('Error fetching reports:', reportsError)
      return NextResponse.json({ error: reportsError.message }, { status: 500 })
    }

    // 리포트 포맷팅 (표시용 라벨 추가)
    const formattedReports = (reports || []).map((r) => ({
      ...r,
      label: r.report_type === 'monthly'
        ? `${r.year}년 ${r.month}월 리포트`
        : `${r.year}년 ${r.month}월 ${r.week}주차 리포트`,
      url: `/report/monthly/${r.id}`,
    }))

    return NextResponse.json({
      success: true,
      client: {
        slug: clientSlug,
        name: client.client_name,
      },
      reports: formattedReports,
      total: formattedReports.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
