/**
 * 관리자 이메일 OTP 인증 (텔레그램 발송)
 *
 * 환경변수:
 * - ADMIN_EMAILS: 슈퍼관리자 이메일 (콤마 구분)
 * - ADMIN_OTP_BOT_TOKEN: 슈퍼관리자 OTP 봇 토큰
 * - ADMIN_OTP_CHAT_ID: 슈퍼관리자 OTP 채널
 * - BAS_NARATTON_ADMIN_EMAILS: BAS+나라똔 관리자 이메일 (콤마 구분)
 * - BAS_NARATTON_TELEGRAM_BOT_TOKEN: 접수관리 봇 토큰
 * - BAS_NARATTON_OTP_CHAT_ID: 접수관리 OTP 채널
 */

import type { AdminScope } from './admin-auth'
import { findSubAdminByEmail } from './airtable-sub-admins'

const OTP_EXPIRY_MS = 5 * 60 * 1000 // 5분
const OTP_LENGTH = 6

// 인메모리 OTP 저장소
const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number; scope: AdminScope }>()

// ─── 관리자 유형 판별 ────────────────────────────

interface AdminInfo {
  scope: AdminScope
  botToken: string
  chatId: string
}

function parseEmails(raw: string): string[] {
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
}

/** 이메일로 관리자 유형 판별 → scope + 봇/채널 반환
 *  1. env 슈퍼관리자 확인
 *  2. env BAS+나라똔 관리자 확인
 *  3. Airtable sub_admins 테이블 확인 (동적 관리)
 */
export async function resolveAdmin(email: string): Promise<AdminInfo | null> {
  const normalized = email.trim().toLowerCase()

  // 1. 슈퍼관리자 확인 (env)
  const superAdminEmails = parseEmails(process.env.ADMIN_EMAILS || '')
  if (superAdminEmails.includes(normalized)) {
    const botToken = process.env.ADMIN_OTP_BOT_TOKEN || ''
    const chatId = process.env.ADMIN_OTP_CHAT_ID || ''
    if (!botToken || !chatId) return null
    return { scope: 'all', botToken, chatId }
  }

  // 2. BAS+나라똔 관리자 확인 (env)
  const basNarattonEmails = parseEmails(process.env.BAS_NARATTON_ADMIN_EMAILS || '')
  if (basNarattonEmails.includes(normalized)) {
    const botToken = process.env.BAS_NARATTON_TELEGRAM_BOT_TOKEN || ''
    const chatId = process.env.BAS_NARATTON_OTP_CHAT_ID || ''
    if (!botToken || !chatId) return null
    return { scope: 'bas-naratton', botToken, chatId }
  }

  // 3. Airtable 서브관리자 확인 (동적)
  try {
    const subAdmin = await findSubAdminByEmail(normalized)
    if (subAdmin) {
      // 서브관리자는 BAS+나라똔 OTP 채널로 발송
      const botToken = process.env.BAS_NARATTON_TELEGRAM_BOT_TOKEN || ''
      const chatId = process.env.BAS_NARATTON_OTP_CHAT_ID || ''
      if (!botToken || !chatId) return null
      return { scope: subAdmin.scope, botToken, chatId }
    }
  } catch (error) {
    console.error('Airtable 서브관리자 조회 실패:', error)
    // Airtable 실패 시 env 기반으로만 동작 (graceful degradation)
  }

  return null
}

// ─── 텔레그램 OTP 발송 ──────────────────────────

async function sendViaTelegram(botToken: string, chatId: string, message: string): Promise<boolean> {
  if (!botToken) {
    console.warn('OTP 봇 토큰 미설정')
    return false
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('OTP 텔레그램 전송 실패:', err)
      return false
    }
    return true
  } catch (error) {
    console.error('OTP 텔레그램 전송 오류:', error)
    return false
  }
}

// ─── OTP 생성/검증 ──────────────────────────────

function generateOTP(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return String(array[0] % 1000000).padStart(OTP_LENGTH, '0')
}

/** OTP 생성 및 텔레그램 전송 */
export async function sendOTP(email: string): Promise<{ success: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase()
  const admin = await resolveAdmin(normalized)

  if (!admin) {
    return { success: false, error: '등록되지 않은 이메일입니다.' }
  }

  // 재발송 쿨다운 (30초)
  const existing = otpStore.get(normalized)
  if (existing && existing.expiresAt - OTP_EXPIRY_MS + 30000 > Date.now()) {
    return { success: false, error: '잠시 후 다시 시도해주세요.' }
  }

  const code = generateOTP()
  otpStore.set(normalized, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    scope: admin.scope,
  })

  const scopeLabel = admin.scope === 'all' ? '전체 관리자' : 'BAS/나라똔 관리자'
  const message = `
<b>🔑 ${scopeLabel} 로그인 인증코드</b>

<b>이메일:</b> ${normalized}
<b>인증코드:</b> <code>${code}</code>
<b>유효시간:</b> 5분

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
`.trim()

  const sent = await sendViaTelegram(admin.botToken, admin.chatId, message)
  if (!sent) {
    otpStore.delete(normalized)
    return { success: false, error: '인증코드 발송에 실패했습니다.' }
  }

  return { success: true }
}

/** OTP 검증 → scope 반환 */
export function verifyOTP(email: string, code: string): { valid: boolean; scope?: AdminScope; error?: string } {
  const normalized = email.trim().toLowerCase()
  const entry = otpStore.get(normalized)

  if (!entry) {
    return { valid: false, error: '인증코드를 먼저 요청해주세요.' }
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalized)
    return { valid: false, error: '인증코드가 만료되었습니다. 다시 요청해주세요.' }
  }

  if (entry.attempts >= 5) {
    otpStore.delete(normalized)
    return { valid: false, error: '인증 시도 횟수를 초과했습니다. 다시 요청해주세요.' }
  }

  entry.attempts++

  if (entry.code !== code) {
    return { valid: false, error: `인증코드가 올바르지 않습니다. (${5 - entry.attempts}회 남음)` }
  }

  const scope = entry.scope
  otpStore.delete(normalized)
  return { valid: true, scope }
}
