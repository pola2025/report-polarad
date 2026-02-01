/**
 * BAS 담당자 상세 API
 * PATCH  /api/bas/staff/[id] - 업데이트
 * DELETE /api/bas/staff/[id] - 삭제
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { updateBasStaff, deleteBasStaff } from '@/lib/airtable-bas-leads'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updated = await updateBasStaff(id, {
      name: body.name,
      is_active: body.is_active,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
    }

    return NextResponse.json({ staff: updated })
  } catch (error) {
    console.error('PATCH /api/bas/staff/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deleted = await deleteBasStaff(id)

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/bas/staff/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
  }
}
