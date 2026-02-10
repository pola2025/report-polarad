/**
 * 나라똔 담당자 셀프 활성화 API
 * POST /api/naratton/staff-auth/setup
 *
 * action: 'save-email'       → 이메일 저장, 봇 정보 반환
 * action: 'check-telegram'   → getUpdates로 봇 연결 확인, chat_id 저장
 * action: 'send-otp'         → 텔레그램 OTP 발송
 * action: 'verify-otp'       → OTP 검증 → is_active = true
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  getNarattonStaffBySlug,
  updateNarattonStaff,
} from '@/lib/airtable-naratton-leads'
import { findActivationChat, sendViaAdminOtpBot } from '@/lib/telegram'
import { sendStaffOTP, verifyStaffOTP } from '@/lib/staff-otp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, slug } = body

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: '슬러그가 필요합니다.' }, { status: 400 })
    }

    const staff = await getNarattonStaffBySlug(slug)
    if (!staff) {
      return NextResponse.json({ error: '담당자를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (staff.is_active) {
      return NextResponse.json({ error: '이미 활성화된 계정입니다.' }, { status: 400 })
    }

    // ─── Step 1: 이메일 저장 ──────────────────────
    if (action === 'save-email') {
      const { email } = body
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json({ error: '올바른 이메일을 입력해주세요.' }, { status: 400 })
      }

      // 이메일 저장 + activation_token 갱신 (없으면 생성)
      const token = staff.activation_token || Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(36).padStart(2, '0'))
        .join('')
        .slice(0, 12)

      await updateNarattonStaff(staff.id, {
        email,
        activation_token: token,
      })

      return NextResponse.json({
        success: true,
        botUsername: 'polamkt2026_bot',
        activationToken: token,
        telegramConnected: !!staff.telegram_chat_id,
      })
    }

    // ─── Step 2: 텔레그램 연결 확인 ────────────────
    if (action === 'check-telegram') {
      // 이미 chat_id가 있으면 바로 성공
      if (staff.telegram_chat_id) {
        return NextResponse.json({ success: true, connected: true })
      }

      if (!staff.activation_token) {
        return NextResponse.json({ error: '먼저 이메일을 등록해주세요.' }, { status: 400 })
      }

      const chatId = await findActivationChat(staff.activation_token)
      if (!chatId) {
        return NextResponse.json({
          success: false,
          connected: false,
          error: '텔레그램 봇과 대화를 시작해주세요.',
        })
      }

      // chat_id 저장
      await updateNarattonStaff(staff.id, { telegram_chat_id: chatId })

      return NextResponse.json({ success: true, connected: true })
    }

    // ─── Step 3: OTP 발송 ─────────────────────────
    if (action === 'send-otp') {
      const chatId = staff.telegram_chat_id
      if (!chatId) {
        return NextResponse.json({ error: '텔레그램이 연결되지 않았습니다.' }, { status: 400 })
      }

      const result = await sendStaffOTP(staff.name, chatId)
      return NextResponse.json(result)
    }

    // ─── Step 4: OTP 검증 → 활성화 ────────────────
    if (action === 'verify-otp') {
      const { code } = body
      if (!code || typeof code !== 'string' || code.length !== 6) {
        return NextResponse.json({ error: '6자리 인증코드를 입력해주세요.' }, { status: 400 })
      }

      const result = verifyStaffOTP(staff.name, code)
      if (!result.valid) {
        return NextResponse.json({ success: false, error: result.error }, { status: 401 })
      }

      // 활성화
      await updateNarattonStaff(staff.id, { is_active: true })

      // 관리자에게 알림
      const adminChatId = process.env.ADMIN_OTP_CHAT_ID
      if (adminChatId) {
        await sendViaAdminOtpBot(
          adminChatId,
          `<b>✅ 담당자 활성화 완료</b>\n\n<b>이름:</b> ${staff.name}\n<b>이메일:</b> ${staff.email || '-'}\n\n⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
        )
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: '잘못된 action입니다.' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/naratton/staff-auth/setup error:', error)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
