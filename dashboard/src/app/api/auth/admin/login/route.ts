/**
 * POST /api/auth/admin/login
 *
 * 관리자 로그인: adminKey + TOTP 코드 검증 → JWT 세션 쿠키 발급
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAdminKey,
  verifyTOTP,
  createSession,
  setSessionCookie,
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
} from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  // IP 추출
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  // Rate limit 확인
  const rateCheck = checkRateLimit(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const { adminKey, totpCode } = body as {
      adminKey?: string
      totpCode?: string
    }

    // TOTP 우선 인증 (ADMIN_TOTP_SECRET이 설정된 경우)
    if (process.env.ADMIN_TOTP_SECRET) {
      if (!totpCode) {
        return NextResponse.json(
          { error: 'OTP 코드를 입력해주세요.' },
          { status: 400 }
        )
      }

      const totpValid = await verifyTOTP(totpCode)
      if (!totpValid) {
        recordFailedAttempt(ip)
        return NextResponse.json(
          {
            error: '인증 코드가 올바르지 않습니다.',
            remainingAttempts: rateCheck.remainingAttempts - 1,
          },
          { status: 401 }
        )
      }
    } else {
      // TOTP 미설정 시 기존 관리자 키 방식 폴백
      if (!adminKey) {
        return NextResponse.json(
          { error: '관리자 키를 입력해주세요.' },
          { status: 400 }
        )
      }

      if (!verifyAdminKey(adminKey)) {
        recordFailedAttempt(ip)
        return NextResponse.json(
          {
            error: '인증에 실패했습니다.',
            remainingAttempts: rateCheck.remainingAttempts - 1,
          },
          { status: 401 }
        )
      }
    }

    // 3. 인증 성공 → JWT 발급 + 쿠키 설정
    clearAttempts(ip)
    const token = await createSession()

    const response = NextResponse.json({ success: true })
    return setSessionCookie(response, token)
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
