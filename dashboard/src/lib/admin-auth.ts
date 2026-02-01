/**
 * Admin Authentication Library
 *
 * JWT 세션 + TOTP 2FA 기반 관리자 인증
 * - jose: Edge Runtime 호환 JWT (middleware에서 사용)
 * - otpauth: TOTP 검증 (API Route에서 사용)
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

// ─── Constants ────────────────────────────────────────────

const COOKIE_NAME = 'polarad_admin_session'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // 7일 (초)

interface AdminSessionPayload extends JWTPayload {
  role: 'admin'
  iat: number
  exp: number
}

// ─── Helpers ──────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다')
  return new TextEncoder().encode(secret)
}

function getAdminKey(): string {
  const key = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY
  if (!key) throw new Error('ADMIN_KEY 환경변수가 설정되지 않았습니다')
  return key
}

// ─── JWT Session ──────────────────────────────────────────

/** JWT 토큰 생성 */
export async function createSession(): Promise<string> {
  const secret = getJwtSecret()
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({ role: 'admin' } as AdminSessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE)
    .sign(secret)
}

/** JWT 토큰 검증 (middleware + API 공용, Edge Runtime 호환) */
export async function verifySession(
  token: string
): Promise<AdminSessionPayload | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'admin') return null
    return payload as AdminSessionPayload
  } catch {
    return null
  }
}

// ─── TOTP Verification ───────────────────────────────────

/**
 * TOTP 코드 검증
 * otpauth는 Edge Runtime에서 동작하지 않으므로 API Route에서만 사용
 */
export async function verifyTOTP(code: string): Promise<boolean> {
  const secret = process.env.ADMIN_TOTP_SECRET
  if (!secret) {
    // TOTP 시크릿 미설정 → TOTP 비활성화 (관리자 키만으로 인증)
    return true
  }

  // 동적 import (Edge Runtime에서 이 함수가 호출되지 않도록)
  const { TOTP, Secret } = await import('otpauth')

  const totp = new TOTP({
    issuer: 'Polarad',
    label: 'Admin',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  })

  // window=1: 현재 + 전후 30초 허용
  const delta = totp.validate({ token: code, window: 1 })
  return delta !== null
}

/** 관리자 키 검증 */
export function verifyAdminKey(inputKey: string): boolean {
  const adminKey = getAdminKey()
  // timing-safe comparison은 서버에서 crypto.timingSafeEqual 사용이 이상적이지만
  // Edge Runtime 호환을 위해 단순 비교 (brute-force는 rate limit으로 방어)
  return inputKey === adminKey
}

// ─── Cookie Management ────────────────────────────────────

/** 응답에 세션 쿠키 설정 */
export function setSessionCookie(
  response: NextResponse,
  token: string
): NextResponse {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}

/** 응답에서 세션 쿠키 삭제 */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}

/** 요청에서 세션 쿠키 토큰 추출 */
export function getSessionToken(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null
}

// ─── Request Authentication ───────────────────────────────

/**
 * API 요청의 관리자 인증 확인
 * 1. JWT 쿠키 확인 (새 방식)
 * 2. x-admin-key 헤더 폴백 (하위 호환 - cron, 외부 호출 등)
 */
export async function isAdminRequest(
  request: NextRequest
): Promise<boolean> {
  // 1. JWT 쿠키 확인
  const token = getSessionToken(request)
  if (token) {
    const payload = await verifySession(token)
    if (payload) return true
  }

  // 2. x-admin-key 헤더 폴백
  const headerKey =
    request.headers.get('x-admin-key') ||
    request.nextUrl.searchParams.get('adminKey')
  if (headerKey) {
    try {
      return verifyAdminKey(headerKey)
    } catch {
      return false
    }
  }

  return false
}

// ─── Rate Limiting ────────────────────────────────────────

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()

const MAX_ATTEMPTS = 5
const LOCK_DURATION = 15 * 60 * 1000 // 15분

/** 로그인 시도 체크 (IP 기반) */
export function checkRateLimit(ip: string): {
  allowed: boolean
  remainingAttempts: number
} {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (entry) {
    // 잠금 기간 만료 확인
    if (entry.lockedUntil > now) {
      return { allowed: false, remainingAttempts: 0 }
    }
    // 잠금 만료 → 초기화
    if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
      loginAttempts.delete(ip)
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
    }
    return {
      allowed: entry.count < MAX_ATTEMPTS,
      remainingAttempts: MAX_ATTEMPTS - entry.count,
    }
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
}

/** 실패한 로그인 시도 기록 */
export function recordFailedAttempt(ip: string): void {
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 }
  entry.count += 1

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_DURATION
  }

  loginAttempts.set(ip, entry)
}

/** 성공한 로그인 → 시도 횟수 초기화 */
export function clearAttempts(ip: string): void {
  loginAttempts.delete(ip)
}
