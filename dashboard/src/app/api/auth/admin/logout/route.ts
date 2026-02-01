/**
 * POST /api/auth/admin/logout
 *
 * 관리자 로그아웃: 세션 쿠키 삭제
 */

import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/admin-auth'

export async function POST() {
  const response = NextResponse.json({ success: true })
  return clearSessionCookie(response)
}
