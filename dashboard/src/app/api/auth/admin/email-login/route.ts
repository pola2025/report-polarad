/**
 * POST /api/auth/admin/email-login
 *
 * 통합 관리자 이메일 OTP 로그인
 * - 슈퍼관리자: ADMIN_EMAILS → 전체 관리자 채널로 OTP
 * - BAS+나라똔: BAS_NARATTON_ADMIN_EMAILS → 접수관리 채널로 OTP
 * action: 'send' → OTP 발송 (텔레그램)
 * action: 'verify' → OTP 검증 → JWT 세션 발급 (scope 자동 결정)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendOTP, verifyOTP } from '@/lib/admin-otp'
import { createSession, setSessionCookie, checkRateLimit, recordFailedAttempt, clearAttempts } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  const rateCheck = checkRateLimit(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const { action, email, code } = body as {
      action: 'send' | 'verify'
      email?: string
      code?: string
    }

    if (!email) {
      return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 })
    }

    // ─── OTP 발송 ──────────────────────────
    if (action === 'send') {
      const result = await sendOTP(email)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: '인증코드가 발송되었습니다.' })
    }

    // ─── OTP 검증 ──────────────────────────
    if (action === 'verify') {
      if (!code) {
        return NextResponse.json({ error: '인증코드를 입력해주세요.' }, { status: 400 })
      }

      const result = verifyOTP(email, code)
      if (!result.valid) {
        recordFailedAttempt(ip)
        return NextResponse.json(
          { error: result.error, remainingAttempts: rateCheck.remainingAttempts - 1 },
          { status: 401 }
        )
      }

      // 인증 성공 → JWT 세션 발급 (scope는 OTP 검증에서 자동 결정)
      clearAttempts(ip)
      const token = await createSession(result.scope || 'all')
      const response = NextResponse.json({ success: true })
      return setSessionCookie(response, token)
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
