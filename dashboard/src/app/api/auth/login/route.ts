/**
 * OAuth 로그인 시작 API
 *
 * GET /api/auth/login
 * → Meta OAuth 페이지로 리다이렉트
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateState, getOAuthLoginUrl } from '@/lib/meta-oauth'

export async function GET() {
  try {
    // CSRF 방지용 state 생성
    const state = generateState()

    // state를 쿠키에 저장 (5분 유효)
    const cookieStore = await cookies()
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5분
      path: '/',
    })

    // Meta OAuth 페이지로 리다이렉트
    const loginUrl = getOAuthLoginUrl(state)

    return NextResponse.redirect(loginUrl)
  } catch (error) {
    console.error('OAuth login error:', error)
    return NextResponse.redirect(
      new URL('/login?error=oauth_init_failed', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    )
  }
}
