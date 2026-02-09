/**
 * 나라똔 담당자 TOTP 로그인 API
 * POST /api/naratton/staff-auth/login
 * Body: { name: string, code: string }
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyStaffTOTP,
  createStaffSession,
  setStaffSessionCookie,
  checkStaffRateLimit,
  recordStaffFailedAttempt,
  clearStaffAttempts,
} from '@/lib/staff-auth'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    // Rate limit 체크
    const rateLimit = checkStaffRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, code } = body

    if (!name || !code) {
      return NextResponse.json(
        { error: '이름과 인증 코드를 입력해주세요.' },
        { status: 400 }
      )
    }

    // TOTP 검증
    const isValid = await verifyStaffTOTP(name, code)
    if (!isValid) {
      recordStaffFailedAttempt(ip)
      return NextResponse.json(
        {
          error: '인증에 실패했습니다.',
          remainingAttempts: rateLimit.remainingAttempts - 1,
        },
        { status: 401 }
      )
    }

    // 성공 → 세션 생성
    clearStaffAttempts(ip)
    const token = await createStaffSession(name)

    const response = NextResponse.json({
      success: true,
      staffName: name,
    })

    return setStaffSessionCookie(response, token)
  } catch (error) {
    console.error('POST /api/naratton/staff-auth/login error:', error)
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
