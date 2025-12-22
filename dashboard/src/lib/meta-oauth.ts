/**
 * Meta OAuth 유틸리티
 *
 * Meta Ads API OAuth 인증 플로우 관리
 */

import crypto from 'crypto'

// 환경변수
const META_APP_ID = process.env.META_APP_ID || ''
const META_APP_SECRET = process.env.META_APP_SECRET || ''
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_META_REDIRECT_URI || 'https://report.polarad.co.kr/api/auth/callback'

// Meta Graph API 버전
const API_VERSION = 'v22.0'

// OAuth 스코프 (ads_read만 필요)
const OAUTH_SCOPE = 'ads_read'

/**
 * CSRF 방지용 state 토큰 생성
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Meta OAuth 로그인 URL 생성
 */
export function getOAuthLoginUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: OAUTH_SCOPE,
    state: state,
    response_type: 'code',
  })

  return `https://www.facebook.com/${API_VERSION}/dialog/oauth?${params.toString()}`
}

/**
 * Authorization Code로 Access Token 교환
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  token_type: string
  expires_in?: number
}> {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: REDIRECT_URI,
    code: code,
  })

  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/oauth/access_token?${params.toString()}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Token exchange failed')
  }

  return response.json()
}

/**
 * Short-lived Token을 Long-lived Token으로 교환 (60일 유효)
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
}> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  })

  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/oauth/access_token?${params.toString()}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Long-lived token exchange failed')
  }

  return response.json()
}

/**
 * Access Token 갱신 (Long-lived Token → 새 Long-lived Token)
 */
export async function refreshAccessToken(currentToken: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
}> {
  // Long-lived token은 만료 전에 동일한 방식으로 갱신
  return exchangeForLongLivedToken(currentToken)
}

/**
 * Access Token 유효성 검증
 */
export async function validateToken(accessToken: string): Promise<{
  isValid: boolean
  userId?: string
  scopes?: string[]
  expiresAt?: number
  error?: string
}> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`
    )

    if (!response.ok) {
      return { isValid: false, error: 'Token validation request failed' }
    }

    const data = await response.json()
    const tokenData = data.data

    if (!tokenData.is_valid) {
      return { isValid: false, error: tokenData.error?.message || 'Token is invalid' }
    }

    return {
      isValid: true,
      userId: tokenData.user_id,
      scopes: tokenData.scopes,
      expiresAt: tokenData.expires_at,
    }
  } catch (error) {
    return { isValid: false, error: String(error) }
  }
}

/**
 * 사용자의 광고 계정 목록 조회
 */
export async function getAdAccounts(accessToken: string): Promise<
  Array<{
    id: string
    account_id: string
    name: string
    account_status: number
  }>
> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/me/adaccounts?fields=id,account_id,name,account_status&access_token=${accessToken}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to fetch ad accounts')
  }

  const data = await response.json()
  return data.data || []
}

/**
 * Meta 사용자 정보 조회
 */
export async function getUserInfo(accessToken: string): Promise<{
  id: string
  name: string
  email?: string
}> {
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/me?fields=id,name,email&access_token=${accessToken}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to fetch user info')
  }

  return response.json()
}

/**
 * 토큰 만료까지 남은 시간 (일 단위)
 */
export function getDaysUntilExpiry(expiresAt: Date | string | null): number | null {
  if (!expiresAt) return null

  const expiry = new Date(expiresAt)
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * 토큰 만료 임박 여부 (7일 이내)
 */
export function isTokenExpiringSoon(expiresAt: Date | string | null): boolean {
  const daysLeft = getDaysUntilExpiry(expiresAt)
  return daysLeft !== null && daysLeft <= 7
}

/**
 * 토큰 만료 여부
 */
export function isTokenExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return true

  const expiry = new Date(expiresAt)
  return new Date() > expiry
}
