/**
 * BAS 리드 상세 / 업데이트 API
 * GET  /api/bas/leads/[id]  - 단일 리드 조회 + 중복 검색
 * PATCH /api/bas/leads/[id] - 상태/담당자/블랙리스트 업데이트
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getBasLead, updateBasLead, findDuplicateLeads } from '@/lib/airtable-bas-leads'
import { sendTelegramMessage } from '@/lib/telegram'

const BACKFILL_CHAT_ID = '-1003394139746'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const lead = await getBasLead(id)
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // 중복 리드도 함께 반환
    const duplicates = lead.phone ? await findDuplicateLeads(lead.phone) : []
    const relatedLeads = duplicates.filter(d => d.id !== lead.id)

    return NextResponse.json({ lead, relatedLeads })
  } catch (error) {
    console.error('GET /api/bas/leads/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // 계약완료 알림을 위해 이전 상태 확인
    let previousStatus: string | undefined
    if (body.status === '계약완료') {
      const current = await getBasLead(id)
      previousStatus = current?.status
    }

    const updated = await updateBasLead(id, {
      status: body.status,
      assigned_staff: body.assigned_staff,
      blacklisted: body.blacklisted,
      last_updated_by: body.last_updated_by || '',
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
    }

    // 계약완료 텔레그램 알림 (이전 상태가 계약완료가 아닌 경우에만)
    if (body.status === '계약완료' && previousStatus !== '계약완료') {
      sendTelegramMessage(
        BACKFILL_CHAT_ID,
        `<b>🎉 BAS 계약완료</b>\n\n<b>이름:</b> ${updated.name || '(이름 없음)'}\n<b>연락처:</b> ${updated.phone || '-'}\n<b>담당자:</b> ${updated.assigned_staff || '미지정'}\n<b>변경자:</b> ${body.last_updated_by || '-'}\n\n⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
      ).catch(err => console.error('텔레그램 계약완료 알림 실패:', err))
    }

    return NextResponse.json({ lead: updated })
  } catch (error) {
    console.error('PATCH /api/bas/leads/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}
