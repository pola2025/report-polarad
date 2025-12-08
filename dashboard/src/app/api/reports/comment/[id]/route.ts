/**
 * 리포트 코멘트 수정/삭제 API
 * PUT/DELETE /api/reports/comment/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'
import type { ReportCommentUpdate } from '@/types/report'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY)
}

// PUT: 코멘트 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body: ReportCommentUpdate = await request.json()
    const { content, author_name, author_role, is_visible } = body

    const supabase = getSupabaseAdmin()

    const updateData: ReportCommentUpdate = {}
    if (content !== undefined) updateData.content = content
    if (author_name !== undefined) updateData.author_name = author_name
    if (author_role !== undefined) updateData.author_role = author_role
    if (is_visible !== undefined) updateData.is_visible = is_visible

    const { data: comment, error } = await supabase
      .from(TABLES.REPORT_COMMENTS)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '코멘트를 찾을 수 없습니다.' }, { status: 404 })
      }
      console.error('Error updating comment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      comment,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 코멘트 삭제 (실제로는 is_visible = false로 처리)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from(TABLES.REPORT_COMMENTS)
      .update({ is_visible: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting comment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '코멘트가 삭제되었습니다.',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
