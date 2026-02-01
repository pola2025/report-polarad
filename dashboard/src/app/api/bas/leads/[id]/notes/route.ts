/**
 * BAS 리드 메모 API
 * POST   /api/bas/leads/[id]/notes - 메모 추가
 * PUT    /api/bas/leads/[id]/notes - 메모 수정
 * DELETE /api/bas/leads/[id]/notes - 메모 삭제
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { addBasLeadNote, updateBasLeadNote, deleteBasLeadNote, getBasLead } from '@/lib/airtable-bas-leads'
import { sendTelegramMessage } from '@/lib/telegram'

const BACKFILL_CHAT_ID = '-1003394139746'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!body.note || !body.author) {
      return NextResponse.json(
        { error: 'note and author are required' },
        { status: 400 }
      )
    }

    // 리드 이름 조회 (알림용)
    const lead = await getBasLead(id)
    const leadName = lead?.name || '(이름 없음)'

    const updated = await addBasLeadNote(id, body.note, body.author)

    if (!updated) {
      return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
    }

    // 텔레그램 알림 (비동기, 실패해도 응답에 영향 없음)
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    sendTelegramMessage(
      BACKFILL_CHAT_ID,
      `<b>📝 BAS 메모 작성</b>\n\n<b>작성시간:</b> ${now}\n<b>담당자:</b> ${body.author}\n<b>접수자:</b> ${leadName}\n<b>내용:</b> ${body.note}`
    ).catch(err => console.error('텔레그램 메모 알림 실패:', err))

    return NextResponse.json({ lead: updated })
  } catch (error) {
    console.error('POST /api/bas/leads/[id]/notes error:', error)
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (body.noteIndex === undefined || !body.content || !body.author) {
      return NextResponse.json(
        { error: 'noteIndex, content, and author are required' },
        { status: 400 }
      )
    }

    const updated = await updateBasLeadNote(id, body.noteIndex, body.content, body.author)

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
    }

    return NextResponse.json({ lead: updated })
  } catch (error) {
    console.error('PUT /api/bas/leads/[id]/notes error:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (body.noteIndex === undefined) {
      return NextResponse.json(
        { error: 'noteIndex is required' },
        { status: 400 }
      )
    }

    const updated = await deleteBasLeadNote(id, body.noteIndex)

    if (!updated) {
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
    }

    return NextResponse.json({ lead: updated })
  } catch (error) {
    console.error('DELETE /api/bas/leads/[id]/notes error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
