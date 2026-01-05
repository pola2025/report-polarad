/**
 * OAuth 콜백 처리 API
 *
 * GET /api/auth/callback
 * - Authorization Code 수신
 * - Access Token 교환
 * - Long-lived Token 변환
 * - DB 저장 (pending 상태)
 * - 텔레그램 알림 전송
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getUserInfo,
  getAdAccounts,
} from '@/lib/meta-oauth'
import {
  getClientByMetaUserId,
  createClientFromOAuth,
  updateClientOAuth,
} from '@/lib/client-status'
import { sendTelegramMessage } from '@/lib/telegram'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://report.polarad.co.kr'
const ADMIN_CHAT_ID = '-1003394139746' // 관리자 알림 채널

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // 에러 응답 처리
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`, BASE_URL)
    )
  }

  // 필수 파라미터 확인
  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=missing_params', BASE_URL))
  }

  // CSRF 검증
  const cookieStore = await cookies()
  const savedState = cookieStore.get('oauth_state')?.value

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/login?error=invalid_state', BASE_URL))
  }

  // state 쿠키 삭제
  cookieStore.delete('oauth_state')

  try {
    // 1. Authorization Code → Access Token
    const tokenData = await exchangeCodeForToken(code)

    // 2. Short-lived → Long-lived Token (60일)
    const longLivedData = await exchangeForLongLivedToken(tokenData.access_token)

    // 3. 사용자 정보 조회
    const userInfo = await getUserInfo(longLivedData.access_token)

    // 4. 광고 계정 목록 조회 (첫 번째 계정 사용)
    let adAccountId: string | undefined
    try {
      const adAccounts = await getAdAccounts(longLivedData.access_token)
      if (adAccounts.length > 0) {
        // account_id는 "act_123456" 형식에서 숫자만 추출
        adAccountId = adAccounts[0].account_id
      }
    } catch (adError) {
      console.warn('Failed to fetch ad accounts:', adError)
    }

    // 5. 토큰 만료 시간 계산 (60일)
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + longLivedData.expires_in)

    // 6. 기존 클라이언트 확인
    const existingClient = await getClientByMetaUserId(userInfo.id)

    let clientId: string
    let isNewClient = false

    if (existingClient) {
      // 기존 클라이언트 - OAuth 정보 업데이트
      await updateClientOAuth(existingClient.id, {
        accessToken: longLivedData.access_token,
        tokenExpiresAt: expiresAt,
        adAccountId,
      })
      clientId = existingClient.id
    } else {
      // 신규 클라이언트 생성
      const newClient = await createClientFromOAuth({
        metaUserId: userInfo.id,
        metaUserName: userInfo.name,
        accessToken: longLivedData.access_token,
        tokenExpiresAt: expiresAt,
        adAccountId,
      })
      clientId = newClient.id
      isNewClient = true

      // 텔레그램 알림 전송 (신규 클라이언트)
      await sendNewClientNotification(userInfo.name, userInfo.id, adAccountId)
    }

    // 7. 클라이언트 ID를 쿠키에 저장 (세션 관리용)
    cookieStore.set('client_id', clientId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: '/',
    })

    // 8. 상태에 따라 리다이렉트
    if (isNewClient) {
      // 신규 클라이언트 → 승인 대기 페이지
      return NextResponse.redirect(new URL('/pending', BASE_URL))
    } else if (existingClient?.status === 'active') {
      // 기존 active 클라이언트 → 대시보드
      return NextResponse.redirect(new URL('/', BASE_URL))
    } else {
      // pending/suspended/expired → 승인 대기 페이지
      return NextResponse.redirect(new URL('/pending', BASE_URL))
    }
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(`/login?error=callback_failed&description=${encodeURIComponent(String(error))}`, BASE_URL)
    )
  }
}

/**
 * 신규 클라이언트 알림 전송
 */
async function sendNewClientNotification(
  userName: string,
  metaUserId: string,
  adAccountId?: string
) {
  const message = `
<b>🆕 신규 OAuth 인증</b>

<b>사용자:</b> ${userName}
<b>Meta ID:</b> ${metaUserId}
${adAccountId ? `<b>광고 계정:</b> ${adAccountId}` : '<b>광고 계정:</b> 없음'}

<b>상태:</b> 승인 대기 (pending)
<a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://report.polarad.co.kr'}/admin/clients">관리자 페이지에서 승인</a>

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
`.trim()

  await sendTelegramMessage(ADMIN_CHAT_ID, message)
}
