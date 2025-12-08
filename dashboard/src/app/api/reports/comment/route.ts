/**
 * 리포트 코멘트 작성 API
 * POST /api/reports/comment
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'
import type { ReportCommentInsert } from '@/types/report'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY
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

    const supabase = getSupabaseAdmin()

    // 리포트 존재 여부 확인
    const { data: report, error: reportError } = await supabase
      .from(TABLES.REPORTS)
      .select('id')
      .eq('id', report_id)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 코멘트 생성 (기존 코멘트가 있으면 업데이트)
    const { data: comment, error: commentError } = await supabase
      .from(TABLES.REPORT_COMMENTS)
      .upsert(
        {
          report_id,
          content,
          author_name: author_name || '폴라애드 광고운영팀',
          author_role: author_role || null,
          is_visible: true,
        },
        {
          onConflict: 'report_id',
        }
      )
      .select()
      .single()

    if (commentError) {
      console.error('Error creating comment:', commentError)
      return NextResponse.json({ error: commentError.message }, { status: 500 })
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
