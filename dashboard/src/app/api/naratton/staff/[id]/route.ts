/**
 * 나라똔 담당자 수정/삭제 API
 * PATCH  /api/naratton/staff/[id] - 수정 (이름, 활성화)
 * DELETE /api/naratton/staff/[id] - 삭제
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { updateNarattonStaff, deleteNarattonStaff } from '@/lib/airtable-naratton-leads'
import { isAdminRequest } from '@/lib/admin-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const staff = await updateNarattonStaff(id, {
      name: body.name,
      slug: body.slug,
      email: body.email,
      is_active: body.is_active,
      telegram_chat_id: body.telegram_chat_id,
    })

    if (!staff) {
      return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { totp_secret, ...safeStaff } = staff
    return NextResponse.json({ staff: safeStaff })
  } catch (error) {
    console.error('PATCH /api/naratton/staff/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const success = await deleteNarattonStaff(id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/naratton/staff/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
  }
}
