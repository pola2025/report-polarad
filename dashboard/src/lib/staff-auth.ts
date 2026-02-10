/**
 * Staff Authentication Library
 *
 * JWT 세션 + 텔레그램 OTP 기반 담당자 인증
 * admin-auth.ts 패턴 동일
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

// ─── Constants ────────────────────────────────────────────

const STAFF_COOKIE_NAME = 'polarad_staff_session'
const SESSION_MAX_AGE = 24 * 60 * 60 // 24시간 (초)

interface StaffSessionPayload extends JWTPayload {
  role: 'staff'
  staffName: string
  iat: number
  exp: number
}

// ─── Helpers ──────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다')
  return new TextEncoder().encode(secret)
}

// ─── JWT Session ──────────────────────────────────────────

export async function createStaffSession(staffName: string): Promise<string> {
  const secret = getJwtSecret()
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({ role: 'staff', staffName } as StaffSessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE)
    .sign(secret)
}

export async function verifyStaffSession(
  token: string
): Promise<StaffSessionPayload | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'staff' || !payload.staffName) return null
    return payload as StaffSessionPayload
  } catch {
    return null
  }
}

// ─── Cookie Management ────────────────────────────────────

export function setStaffSessionCookie(
  response: NextResponse,
  token: string
): NextResponse {
  response.cookies.set(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}

export function clearStaffSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(STAFF_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}

export function getStaffSessionToken(request: NextRequest): string | null {
  return request.cookies.get(STAFF_COOKIE_NAME)?.value ?? null
}

// ─── Request Authentication ───────────────────────────────

export async function isStaffRequest(
  request: NextRequest
): Promise<StaffSessionPayload | null> {
  const token = getStaffSessionToken(request)
  if (!token) return null
  return verifyStaffSession(token)
}

// ─── Rate Limiting ────────────────────────────────────────

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()

const MAX_ATTEMPTS = 5
const LOCK_DURATION = 15 * 60 * 1000 // 15분

export function checkStaffRateLimit(ip: string): {
  allowed: boolean
  remainingAttempts: number
} {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (entry) {
    if (entry.lockedUntil > now) {
      return { allowed: false, remainingAttempts: 0 }
    }
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

export function recordStaffFailedAttempt(ip: string): void {
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 }
  entry.count += 1

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_DURATION
  }

  loginAttempts.set(ip, entry)
}

export function clearStaffAttempts(ip: string): void {
  loginAttempts.delete(ip)
}
