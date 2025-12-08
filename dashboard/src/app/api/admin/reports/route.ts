/**
 * 관리자용 리포트 목록 및 생성 API
 * GET/POST /api/admin/reports
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'
import type { ReportInsert, ReportUpdate } from '@/types/report'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY)
}

// GET: 리포트 목록 조회
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const reportType = searchParams.get('type') // monthly | weekly
    const status = searchParams.get('status') // draft | published | archived
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from(TABLES.REPORTS)
      .select(`
        *,
        polarad_clients (
          client_name,
          slug
        ),
        polarad_report_comments (
          id,
          content,
          author_name
        )
      `)
      .order('period_start', { ascending: false })

    if (clientId) query = query.eq('client_id', clientId)
    if (reportType) query = query.eq('report_type', reportType)
    if (status) query = query.eq('status', status)
    if (year) query = query.eq('year', parseInt(year))
    if (month) query = query.eq('month', parseInt(month))

    const { data: reports, error } = await query

    if (error) {
      console.error('Error fetching reports:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 형식 변환
    const formattedReports = reports?.map((r) => ({
      ...r,
      client: r.polarad_clients || null,
      hasComment: r.polarad_report_comments?.length > 0,
    }))

    return NextResponse.json({
      success: true,
      reports: formattedReports,
      total: formattedReports?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 리포트 생성
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: ReportInsert = await request.json()
    const { client_id, report_type, period_start, period_end, year, month, week } = body

    if (!client_id || !report_type || !period_start || !period_end || !year) {
      return NextResponse.json(
        { error: 'client_id, report_type, period_start, period_end, year는 필수입니다.' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // 클라이언트 존재 확인
    const { data: client, error: clientError } = await supabase
      .from(TABLES.CLIENTS)
      .select('id, client_id')
      .eq('client_id', client_id)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: '클라이언트를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 리포트 생성
    const { data: report, error: reportError } = await supabase
      .from(TABLES.REPORTS)
      .insert({
        client_id,
        report_type,
        period_start,
        period_end,
        year,
        month: month || null,
        week: week || null,
        status: 'draft',
      })
      .select()
      .single()

    if (reportError) {
      if (reportError.code === '23505') {
        return NextResponse.json(
          { error: '해당 기간의 리포트가 이미 존재합니다.' },
          { status: 409 }
        )
      }
      console.error('Error creating report:', reportError)
      return NextResponse.json({ error: reportError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      report,
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: 리포트 상태 변경 (발행 등)
export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, status, summary_data, ai_insights } = body

    if (!id) {
      return NextResponse.json({ error: 'id는 필수입니다.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const updateData: ReportUpdate = {}
    if (status !== undefined) {
      updateData.status = status
      if (status === 'published') {
        updateData.published_at = new Date().toISOString()
      }
    }
    if (summary_data !== undefined) updateData.summary_data = summary_data
    if (ai_insights !== undefined) {
      updateData.ai_insights = ai_insights
      updateData.ai_generated_at = new Date().toISOString()
    }

    const { data: report, error } = await supabase
      .from(TABLES.REPORTS)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 })
      }
      console.error('Error updating report:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      report,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
