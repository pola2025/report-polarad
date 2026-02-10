/**
 * 나라똔 담당자 슬러그 기반 2FA 설정 API
 * POST /api/naratton/staff-auth/setup
 *
 * Body: { slug: string, code?: string }
 *
 * 1단계: code 없이 호출 → TOTP 시크릿 생성 + QR URI 반환
 * 2단계: code 있으면 → 검증 + 관리자 텔레그램 승인 요청
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  getNarattonStaffBySlug,
  updateNarattonStaff,
} from '@/lib/airtable-naratton-leads'
import { sendStaffAuthNotification } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug, code } = body

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: '슬러그가 필요합니다.' }, { status: 400 })
    }

    // 담당자 조회
    const staff = await getNarattonStaffBySlug(slug)
    if (!staff) {
      return NextResponse.json({ error: '담당자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 이미 활성화됨
    if (staff.is_active) {
      return NextResponse.json({ error: '이미 인증이 완료된 담당자입니다.' }, { status: 400 })
    }

    const { TOTP, Secret } = await import('otpauth')

    // 1단계: TOTP 시크릿 없으면 생성
    if (!staff.totp_secret) {
      const secret = new Secret({ size: 20 })

      const totp = new TOTP({
        issuer: 'Polarad',
        label: `나라똔:${staff.name}`,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
      })

      // Airtable에 시크릿 저장 (is_active는 false 유지)
      await updateNarattonStaff(staff.id, {
        totp_secret: secret.base32,
      })

      return NextResponse.json({
        step: 'qr',
        qrUri: totp.toString(),
        staffName: staff.name,
      })
    }

    // totp_secret 있지만 code 없으면 → QR URI 재반환
    if (!code) {
      const secret = Secret.fromBase32(staff.totp_secret)
      const totp = new TOTP({
        issuer: 'Polarad',
        label: `나라똔:${staff.name}`,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
      })

      return NextResponse.json({
        step: 'qr',
        qrUri: totp.toString(),
        staffName: staff.name,
      })
    }

    // 2단계: 코드 검증
    if (typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: '6자리 인증 코드를 입력해주세요.' }, { status: 400 })
    }

    const secret = Secret.fromBase32(staff.totp_secret)
    const totp = new TOTP({
      issuer: 'Polarad',
      label: `나라똔:${staff.name}`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    })

    const delta = totp.validate({ token: code, window: 1 })
    if (delta === null) {
      return NextResponse.json({ error: '인증 코드가 올바르지 않습니다.' }, { status: 401 })
    }

    // 코드 검증 성공 → 관리자 텔레그램 승인 요청
    await sendStaffAuthNotification(staff.name, staff.id, slug)

    return NextResponse.json({
      step: 'pending',
      message: '인증 코드가 확인되었습니다. 관리자 승인을 기다려주세요.',
    })
  } catch (error) {
    console.error('POST /api/naratton/staff-auth/setup error:', error)
    return NextResponse.json({ error: '설정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
