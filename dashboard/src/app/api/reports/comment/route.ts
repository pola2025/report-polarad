/**
 * 리포트 코멘트 작성 API
 * POST /api/reports/comment
 * 데이터 소스: Airtable
 */

import { NextRequest, NextResponse } from 'next/server'
import { createReportComment, getReport, getReportComment } from '@/lib/airtable'
import type { ReportCommentInsert } from '@/types/report'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY)
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: ReportCommentInsert = await request.json()
    const { report_id, content, author_name, author_role } = body

    if (!report_id || !content) {
      return NextResponse.json(
        { error: 'report_id와 content는 필수입니다.' },
        { status: 400 }
      )
    }

    // 리포트 존재 여부 확인
    const report = await getReport(report_id)

    if (!report) {
      return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 기존 코멘트가 있는지 확인
    const existingComment = await getReportComment(report_id)

    if (existingComment) {
      // 기존 코멘트가 있으면 PUT 요청으로 리다이렉트 안내
      return NextResponse.json(
        { error: '이미 코멘트가 존재합니다. PUT 요청을 사용하세요.', existingComment },
        { status: 409 }
      )
    }

    // 코멘트 생성
    const comment = await createReportComment({
      report_id,
      content,
      author_name: author_name || '폴라애드 광고운영팀',
      author_role: author_role || null,
      is_visible: true,
    })

    if (!comment) {
      return NextResponse.json({ error: '코멘트 생성에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      comment,
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
