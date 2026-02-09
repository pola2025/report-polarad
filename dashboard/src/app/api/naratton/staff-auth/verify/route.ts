/**
 * 나라똔 담당자 세션 검증 API
 * GET /api/naratton/staff-auth/verify
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { isStaffRequest } from '@/lib/staff-auth'

export async function GET(request: NextRequest) {
  try {
    const payload = await isStaffRequest(request)

    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      staffName: payload.staffName,
      role: payload.role,
    })
  } catch (error) {
    console.error('GET /api/naratton/staff-auth/verify error:', error)
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
