/**
 * 나라똔 담당자 목록/추가 API
 * GET  /api/naratton/staff - 담당자 목록
 * POST /api/naratton/staff - 담당자 추가
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchNarattonStaff, createNarattonStaff } from '@/lib/airtable-naratton-leads'
import { isAdminRequest } from '@/lib/admin-auth'
import { isStaffRequest } from '@/lib/staff-auth'

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminRequest(request)
  const staffSession = !isAdmin ? await isStaffRequest(request) : null
  if (!isAdmin && !staffSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const staff = await fetchNarattonStaff()
    // totp_secret은 목록에서 제외
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const safeStaff = staff.map(({ totp_secret, ...rest }) => rest)
    return NextResponse.json({ staff: safeStaff })
  } catch (error) {
    console.error('GET /api/naratton/staff error:', error)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const staff = await createNarattonStaff(body.name)
    if (!staff) {
      return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { totp_secret, ...safeStaff } = staff
    return NextResponse.json({ staff: safeStaff })
  } catch (error) {
    console.error('POST /api/naratton/staff error:', error)
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
  }
}
