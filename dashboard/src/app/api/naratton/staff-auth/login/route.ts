/**
 * 나라똔 담당자 텔레그램 OTP 로그인 API
 * POST /api/naratton/staff-auth/login
 *
 * action: 'send'   → 텔레그램으로 인증코드 발송
 * action: 'verify' → 인증코드 검증 → JWT 세션 발급
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  createStaffSession,
  setStaffSessionCookie,
  checkStaffRateLimit,
  recordStaffFailedAttempt,
  clearStaffAttempts,
} from '@/lib/staff-auth'
import { getNarattonStaffBySlug } from '@/lib/airtable-naratton-leads'
import { sendStaffOTP, verifyStaffOTP } from '@/lib/staff-otp'

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'

    const rateLimit = checkStaffRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.',
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { action, slug, code, email } = body as {
      action: 'send' | 'verify'
      slug: string
      code?: string
      email?: string
    }

    if (!slug) {
      return NextResponse.json(
        { error: '잘못된 요청입니다.' },
        { status: 400 }
      )
    }

    // 담당자 조회
    const staff = await getNarattonStaffBySlug(slug)
    if (!staff) {
      return NextResponse.json(
        { error: '담당자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // telegram_chat_id 확인
    if (!staff.telegram_chat_id) {
      return NextResponse.json(
        { error: '텔레그램이 연동되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 400 }
      )
    }

    if (!staff.is_active) {
      return NextResponse.json(
        { error: '계정이 비활성 상태입니다. 관리자에게 문의하세요.' },
        { status: 403 }
      )
    }

    // ─── OTP 발송 ──────────────────────────
    if (action === 'send') {
      // 이메일 검증 필수
      if (!email) {
        return NextResponse.json(
          { error: '이메일을 입력해주세요.' },
          { status: 400 }
        )
      }

      if (!staff.email) {
        return NextResponse.json(
          { error: '등록된 이메일이 없습니다. 관리자에게 문의하세요.' },
          { status: 400 }
        )
      }

      if (email.trim().toLowerCase() !== staff.email.trim().toLowerCase()) {
        recordStaffFailedAttempt(ip)
        return NextResponse.json(
          { error: '이메일이 일치하지 않습니다.' },
          { status: 401 }
        )
      }

      const result = await sendStaffOTP(staff.name, staff.telegram_chat_id)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({
        success: true,
        message: '텔레그램으로 인증코드를 발송했습니다.',
      })
    }

    // ─── OTP 검증 ──────────────────────────
    if (action === 'verify') {
      if (!code) {
        return NextResponse.json(
          { error: '인증코드를 입력해주세요.' },
          { status: 400 }
        )
      }

      const result = verifyStaffOTP(staff.name, code)
      if (!result.valid) {
        recordStaffFailedAttempt(ip)
        return NextResponse.json(
          {
            error: result.error,
            remainingAttempts: rateLimit.remainingAttempts - 1,
          },
          { status: 401 }
        )
      }

      // 인증 성공 → 세션 생성
      clearStaffAttempts(ip)
      const token = await createStaffSession(staff.name)

      const response = NextResponse.json({
        success: true,
        staffName: staff.name,
      })

      return setStaffSessionCookie(response, token)
    }

    return NextResponse.json(
      { error: '잘못된 요청입니다.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('POST /api/naratton/staff-auth/login error:', error)
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
