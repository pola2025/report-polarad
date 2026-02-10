/**
 * 담당자 텔레그램 OTP 인증
 *
 * 담당자의 개인 telegram_chat_id로 인증코드를 직접 전송
 * 관리자가 사전에 telegram_chat_id를 등록해야 사용 가능
 *
 * TOTP(QR코드) 방식 대체 → Google Authenticator 불필요
 */

const OTP_EXPIRY_MS = 5 * 60 * 1000 // 5분
const OTP_LENGTH = 6

// 인메모리 OTP 저장소
const staffOtpStore = new Map<
  string,
  { code: string; expiresAt: number; attempts: number; staffName: string }
>()

function generateOTP(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return String(array[0] % 1000000).padStart(OTP_LENGTH, '0')
}

async function sendViaTelegram(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      console.error('Staff OTP 전송 실패:', err)
      return false
    }
    return true
  } catch (error) {
    console.error('Staff OTP 전송 오류:', error)
    return false
  }
}

/** OTP 생성 및 담당자 개인 텔레그램으로 전송 */
export async function sendStaffOTP(
  staffName: string,
  telegramChatId: string
): Promise<{ success: boolean; error?: string }> {
  const key = `staff:${staffName}`

  // 재발송 쿨다운 (30초)
  const existing = staffOtpStore.get(key)
  if (existing && existing.expiresAt - OTP_EXPIRY_MS + 30000 > Date.now()) {
    return { success: false, error: '잠시 후 다시 시도해주세요.' }
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return { success: false, error: '텔레그램 봇이 설정되지 않았습니다.' }
  }

  const code = generateOTP()
  staffOtpStore.set(key, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    staffName,
  })

  const message = `
<b>🔑 나라똔 리드관리 인증코드</b>

<b>담당자:</b> ${staffName}
<b>인증코드:</b> <code>${code}</code>
<b>유효시간:</b> 5분

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
`.trim()

  const sent = await sendViaTelegram(botToken, telegramChatId, message)
  if (!sent) {
    staffOtpStore.delete(key)
    return {
      success: false,
      error:
        '인증코드 발송에 실패했습니다. 텔레그램 봇과 대화를 시작했는지 확인해주세요.',
    }
  }

  return { success: true }
}

/** OTP 검증 */
export function verifyStaffOTP(
  staffName: string,
  code: string
): { valid: boolean; error?: string } {
  const key = `staff:${staffName}`
  const entry = staffOtpStore.get(key)

  if (!entry) {
    return { valid: false, error: '인증코드를 먼저 요청해주세요.' }
  }

  if (Date.now() > entry.expiresAt) {
    staffOtpStore.delete(key)
    return {
      valid: false,
      error: '인증코드가 만료되었습니다. 다시 요청해주세요.',
    }
  }

  if (entry.attempts >= 5) {
    staffOtpStore.delete(key)
    return {
      valid: false,
      error: '인증 시도 횟수를 초과했습니다. 다시 요청해주세요.',
    }
  }

  entry.attempts++

  if (entry.code !== code) {
    return {
      valid: false,
      error: `인증코드가 올바르지 않습니다. (${5 - entry.attempts}회 남음)`,
    }
  }

  staffOtpStore.delete(key)
  return { valid: true }
}
