/**
 * 나라똔 리드 메모 API
 * POST   /api/naratton/leads/[id]/notes - 메모 추가
 * PUT    /api/naratton/leads/[id]/notes - 메모 수정
 * DELETE /api/naratton/leads/[id]/notes - 메모 삭제
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  addNarattonLeadNote,
  updateNarattonLeadNote,
  deleteNarattonLeadNote,
  getNarattonLead,
} from '@/lib/airtable-naratton-leads'
import { sendTelegramMessage } from '@/lib/telegram'
import { isAdminRequest } from '@/lib/admin-auth'
import { isStaffRequest } from '@/lib/staff-auth'

const NARATTON_ADMIN_CHAT_ID = '-1003353283178'

async function checkAuth(request: NextRequest): Promise<NextResponse | null> {
  const isAdmin = await isAdminRequest(request)
  const staffSession = !isAdmin ? await isStaffRequest(request) : null
  if (!isAdmin && !staffSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkAuth(request)
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()

    if (!body.note || !body.author || !body.table_id) {
      return NextResponse.json(
        { error: 'note, author, and table_id are required' },
        { status: 400 }
      )
    }

    const lead = await getNarattonLead(id, body.table_id)
    const leadName = lead?.name || '(이름 없음)'

    const updated = await addNarattonLeadNote(id, body.table_id, body.note, body.author)

    if (!updated) {
      return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
    }

    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    sendTelegramMessage(
      NARATTON_ADMIN_CHAT_ID,
      `<b>📝 나라똔 메모 작성</b>\n\n<b>작성시간:</b> ${now}\n<b>담당자:</b> ${body.author}\n<b>접수자:</b> ${leadName}\n<b>내용:</b> ${body.note}`
    ).catch(err => console.error('텔레그램 메모 알림 실패:', err))

    return NextResponse.json({ lead: updated })
  } catch (error) {
    console.error('POST /api/naratton/leads/[id]/notes error:', error)
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkAuth(request)
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()

    if (body.noteIndex === undefined || !body.content || !body.author || !body.table_id) {
      return NextResponse.json(
        { error: 'noteIndex, content, author, and table_id are required' },
        { status: 400 }
      )
    }

    const lead = await getNarattonLead(id, body.table_id)
    const leadName = lead?.name || '(이름 없음)'

    const updated = await updateNarattonLeadNote(id, body.table_id, body.noteIndex, body.content, body.author)

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
    }

    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    sendTelegramMessage(
      NARATTON_ADMIN_CHAT_ID,
      `<b>✏️ 나라똔 메모 수정</b>\n\n<b>수정시간:</b> ${now}\n<b>담당자:</b> ${body.author}\n<b>접수자:</b> ${leadName}\n<b>내용:</b> ${body.content}`
    ).catch(err => console.error('텔레그램 메모 수정 알림 실패:', err))

    return NextResponse.json({ lead: updated })
  } catch (error) {
    console.error('PUT /api/naratton/leads/[id]/notes error:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkAuth(request)
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()

    if (body.noteIndex === undefined || !body.table_id) {
      return NextResponse.json(
        { error: 'noteIndex and table_id are required' },
        { status: 400 }
      )
    }

    const updated = await deleteNarattonLeadNote(id, body.table_id, body.noteIndex)

    if (!updated) {
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
    }

    return NextResponse.json({ lead: updated })
  } catch (error) {
    console.error('DELETE /api/naratton/leads/[id]/notes error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
