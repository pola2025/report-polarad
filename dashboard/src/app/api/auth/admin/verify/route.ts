/**
 * GET /api/auth/admin/verify
 *
 * 현재 세션 유효성 확인 (클라이언트에서 인증 상태 확인용)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionToken, verifySession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const token = getSessionToken(request)

  if (!token) {
    return NextResponse.json(
      { authenticated: false, totpEnabled: !!process.env.ADMIN_TOTP_SECRET },
      { status: 401 }
    )
  }

  const payload = await verifySession(token)

  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    scope: payload.scope || 'all',
    expiresAt: payload.exp ? payload.exp * 1000 : null,
  })
}
