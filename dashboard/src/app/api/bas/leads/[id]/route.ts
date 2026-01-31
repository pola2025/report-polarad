/**
 * BAS 리드 상세 / 업데이트 API
 * GET  /api/bas/leads/[id]  - 단일 리드 조회 + 중복 검색
 * PATCH /api/bas/leads/[id] - 상태/담당자/블랙리스트 업데이트
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getBasLead, updateBasLead, findDuplicateLeads } from '@/lib/airtable-bas-leads'

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

    const updated = await updateBasLead(id, {
      status: body.status,
      assigned_staff: body.assigned_staff,
      blacklisted: body.blacklisted,
      last_updated_by: body.last_updated_by || '',
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
    }

    return NextResponse.json({ lead: updated })
  } catch (error) {
    console.error('PATCH /api/bas/leads/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}
