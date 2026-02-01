/**
 * 관리자용 리포트 목록 및 생성 API
 * GET/POST/PATCH /api/admin/reports
 * 데이터 소스: Airtable
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getReports,
  getReportComment,
  getAirtableClient,
  createReport,
  updateReport,
} from '@/lib/airtable'
import type { ReportInsert } from '@/types/report'
import { isAdminRequest } from '@/lib/admin-auth'

// GET: 리포트 목록 조회
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    const reportType = searchParams.get('type') as 'monthly' | 'weekly' | null
    const status = searchParams.get('status') as 'draft' | 'published' | 'archived' | null
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    // Airtable에서 리포트 목록 조회
    const reports = await getReports({
      clientId: clientId || undefined,
      reportType: reportType || undefined,
      status: status || undefined,
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
    })

    // 클라이언트 정보 및 코멘트 조회
    const formattedReports = await Promise.all(
      reports.map(async (r) => {
        const client = await getAirtableClient(r.client_id)
        const comment = await getReportComment(r.id)

        return {
          ...r,
          client: client ? {
            client_name: client.client_name,
            slug: client.slug,
          } : null,
          hasComment: !!comment,
          polarad_clients: client ? {
            client_name: client.client_name,
            slug: client.slug,
          } : null,
          polarad_report_comments: comment ? [{
            id: comment.id,
            content: comment.content,
            author_name: comment.author_name,
          }] : [],
        }
      })
    )

    return NextResponse.json({
      success: true,
      reports: formattedReports,
      total: formattedReports.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 리포트 생성
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: ReportInsert = await request.json()
    const { client_id, report_type, period_start, period_end, year, month, week } = body

    if (!client_id || !report_type || !period_start || !period_end || !year) {
      return NextResponse.json(
        { error: 'client_id, report_type, period_start, period_end, year are required' },
        { status: 400 }
      )
    }

    // 클라이언트 존재 확인
    const client = await getAirtableClient(client_id)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // 리포트 생성
    const report = await createReport({
      client_id,
      report_type,
      period_start,
      period_end,
      year,
      month: month || null,
      week: week || null,
      status: 'draft',
    })

    if (!report) {
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
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
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, status, summary_data, ai_insights, period_start, period_end, year, month, week } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // 업데이트 데이터 구성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

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
    if (period_start !== undefined) updateData.period_start = period_start
    if (period_end !== undefined) updateData.period_end = period_end
    if (year !== undefined) updateData.year = year
    if (month !== undefined) updateData.month = month
    if (week !== undefined) updateData.week = week

    const report = await updateReport(id, updateData)

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
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
