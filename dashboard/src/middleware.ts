/**
 * Next.js Middleware — 관리자 라우트 보호
 *
 * /admin/* 페이지: JWT 쿠키 확인 → 실패 시 /login 리다이렉트
 * /api/admin/* API: JWT 쿠키 확인 → 실패 시 x-admin-key 폴백 → 실패 시 401
 *
 * Edge Runtime에서 실행되므로 jose만 사용 (otpauth 사용 불가)
 */

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'polarad_admin_session'

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not set')
  return new TextEncoder().encode(secret)
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload.role === 'admin'
  } catch {
    return false
  }
}

function verifyHeaderKey(request: NextRequest): boolean {
  const headerKey =
    request.headers.get('x-admin-key') ||
    request.nextUrl.searchParams.get('adminKey')
  if (!headerKey) return false

  const adminKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY
  if (headerKey === adminKey) return true

  const basNarattonKey = process.env.BAS_NARATTON_ADMIN_KEY
  if (basNarattonKey && headerKey === basNarattonKey) return true

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── /admin/* 페이지 보호 ──────────────────────────
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get(COOKIE_NAME)?.value

    if (token && (await verifyToken(token))) {
      return NextResponse.next()
    }

    // 인증 실패 → 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ─── /api/admin/* API 보호 ─────────────────────────
  if (pathname.startsWith('/api/admin')) {
    // 1. JWT 쿠키 확인
    const token = request.cookies.get(COOKIE_NAME)?.value
    if (token && (await verifyToken(token))) {
      return NextResponse.next()
    }

    // 2. x-admin-key 헤더 폴백 (cron, 외부 호출 등)
    if (verifyHeaderKey(request)) {
      return NextResponse.next()
    }

    // 인증 실패
    return NextResponse.json(
      { error: '인증이 필요합니다.' },
      { status: 401 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // 관리자 페이지
    '/admin/:path*',
    // 관리자 API
    '/api/admin/:path*',
  ],
}
