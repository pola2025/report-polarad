/**
 * 리포트 코멘트 수정/삭제 API
 * PUT/DELETE /api/reports/comment/[id]
 * 데이터 소스: Airtable
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateReportComment } from '@/lib/airtable'
import type { ReportCommentUpdate } from '@/types/report'
import { isAdminRequest } from '@/lib/admin-auth'

// PUT: 코멘트 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body: ReportCommentUpdate = await request.json()
    const { content, author_name, author_role, is_visible } = body

    const updateData: ReportCommentUpdate = {}
    if (content !== undefined) updateData.content = content
    if (author_name !== undefined) updateData.author_name = author_name
    if (author_role !== undefined) updateData.author_role = author_role
    if (is_visible !== undefined) updateData.is_visible = is_visible

    const comment = await updateReportComment(id, updateData)

    if (!comment) {
      return NextResponse.json({ error: '코멘트를 찾을 수 없습니다.' }, { status: 404 })
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

// DELETE: 코멘트 삭제 (is_visible = false로 처리)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const comment = await updateReportComment(id, { is_visible: false })

    if (!comment) {
      return NextResponse.json({ error: '코멘트를 찾을 수 없습니다.' }, { status: 404 })
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
