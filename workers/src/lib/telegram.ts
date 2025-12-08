import type { Env, WeeklySummary } from '../types'

/**
 * 텔레그램 메시지 발송
 */
export async function sendTelegramMessage(
  env: Env,
  chatId: string,
  message: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown'
): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN이 설정되지 않았습니다')
    return false
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: parseMode,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ 텔레그램 발송 실패:', error)
      return false
    }

    console.log('✅ 텔레그램 메시지 발송 완료')
    return true
  } catch (error) {
    console.error('❌ 텔레그램 발송 오류:', error)
    return false
  }
}

/**
 * 데이터 수집 완료 알림
 */
export async function sendCollectionCompleteNotification(
  env: Env,
  clientName: string,
  startDate: string,
  endDate: string,
  recordCount: number
): Promise<void> {
  const chatId = '-1003394139746' // 백필 알림 채널

  const message = `✅ **[Polarad] 데이터 수집 완료**

📋 클라이언트: ${clientName}
📅 기간: ${startDate} ~ ${endDate}
📊 수집: ${recordCount}건

---
🤖 Polarad Meta Analytics`

  await sendTelegramMessage(env, chatId, message)
}

/**
 * 에러 알림
 */
export async function sendErrorNotification(
  env: Env,
  clientName: string,
  errorMessage: string
): Promise<void> {
  const chatId = env.TELEGRAM_ERROR_CHAT_ID || '-1003394139746'

  const message = `❌ **[Polarad] 오류 발생**

📋 클라이언트: ${clientName}
⚠️ 오류: ${errorMessage}

---
🤖 Polarad Meta Analytics`

  await sendTelegramMessage(env, chatId, message)
}

/**
 * 주간 리포트 메시지 생성
 */
export function generateWeeklyReportMessage(
  clientName: string,
  thisWeek: WeeklySummary,
  lastWeek: WeeklySummary,
  startDate: string,
  endDate: string
): string {
  const formatNumber = (n: number) => n.toLocaleString('ko-KR')
  const formatCurrency = (n: number) => `₩${n.toLocaleString('ko-KR')}`
  const formatPercent = (n: number) => `${n.toFixed(2)}%`

  const calculateChange = (current: number, previous: number): string => {
    if (previous === 0) return current > 0 ? '+∞' : '0%'
    const change = ((current - previous) / previous) * 100
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }

  const message = `📊 **[${clientName}] 주간 리포트**

📅 ${startDate} ~ ${endDate}

**이번 주 성과**
• 노출수: ${formatNumber(thisWeek.impressions)} (${calculateChange(thisWeek.impressions, lastWeek.impressions)})
• 클릭수: ${formatNumber(thisWeek.clicks)} (${calculateChange(thisWeek.clicks, lastWeek.clicks)})
• 리드수: ${formatNumber(thisWeek.leads)} (${calculateChange(thisWeek.leads, lastWeek.leads)})
• 지출액: ${formatCurrency(thisWeek.spend)} (${calculateChange(thisWeek.spend, lastWeek.spend)})
• CTR: ${formatPercent(thisWeek.ctr)}
• CPL: ${formatCurrency(thisWeek.cpl)}

**지난 주 대비**
• 노출: ${calculateChange(thisWeek.impressions, lastWeek.impressions)}
• 클릭: ${calculateChange(thisWeek.clicks, lastWeek.clicks)}
• 리드: ${calculateChange(thisWeek.leads, lastWeek.leads)}
• 지출: ${calculateChange(thisWeek.spend, lastWeek.spend)}

---
🤖 Polarad Meta Analytics`

  return message
}
