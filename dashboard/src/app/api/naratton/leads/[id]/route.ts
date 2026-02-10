/**
 * 나라똔 리드 상세 / 업데이트 API
 * GET  /api/naratton/leads/[id]?table_id=tblXXX  - 단일 리드 조회 + 중복 검색
 * PATCH /api/naratton/leads/[id] - 상태/담당자/블랙리스트 업데이트
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getNarattonLead, updateNarattonLead, findDuplicateLeads } from '@/lib/airtable-naratton-leads'
import { sendTelegramMessage } from '@/lib/telegram'
import { isAdminRequest } from '@/lib/admin-auth'
import { isStaffRequest } from '@/lib/staff-auth'

const BACKFILL_CHAT_ID = '-1003394139746'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminRequest(request)
  const staffSession = !isAdmin ? await isStaffRequest(request) : null
  if (!isAdmin && !staffSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const tableId = request.nextUrl.searchParams.get('table_id')
    if (!tableId) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 })
    }

    const lead = await getNarattonLead(id, tableId)
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const duplicates = lead.phone ? await findDuplicateLeads(lead.phone) : []
    const relatedLeads = duplicates.filter(d => d.id !== lead.id)

    return NextResponse.json({ lead, relatedLeads })
  } catch (error) {
    console.error('GET /api/naratton/leads/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await isAdminRequest(request)
  const staffSession = !isAdmin ? await isStaffRequest(request) : null
  if (!isAdmin && !staffSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    if (!body.table_id) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 })
    }

    // 계약 완료 알림을 위해 이전 상태 확인
    let previousStatus: string | undefined
    if (body.status === '계약 완료') {
      const current = await getNarattonLead(id, body.table_id)
      previousStatus = current?.status
    }

    const updated = await updateNarattonLead(id, body.table_id, {
      status: body.status,
      assigned_staff: body.assigned_staff,
      blacklisted: body.blacklisted,
      is_test: body.is_test,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
    }

    // 계약 완료 텔레그램 알림
    if (body.status === '계약 완료' && previousStatus !== '계약 완료') {
      sendTelegramMessage(
        BACKFILL_CHAT_ID,
        `<b>🎉 나라똔 계약 완료</b>\n\n<b>이름:</b> ${updated.name || '(이름 없음)'}\n<b>연락처:</b> ${updated.phone || '-'}\n<b>채널:</b> ${updated.channel === 'homepage' ? '홈페이지' : updated.channel === 'test' ? '테스트' : 'Meta 리드'}\n<b>담당자:</b> ${updated.assigned_staff || '미지정'}\n\n⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
      ).catch(err => console.error('텔레그램 계약 완료 알림 실패:', err))
    }

    return NextResponse.json({ lead: updated })
  } catch (error) {
    console.error('PATCH /api/naratton/leads/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}
