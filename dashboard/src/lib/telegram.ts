/**
 * 텔레그램 알림 유틸리티
 *
 * 백필 완료 알림 채널: -1003394139746
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const BACKFILL_CHAT_ID = '-1003394139746'

interface TelegramMessage {
  chat_id: string
  text: string
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disable_web_page_preview?: boolean
}

/**
 * 텔레그램 메시지 전송
 */
export async function sendTelegramMessage(
  chatId: string,
  message: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.')
    return false
  }

  try {
    const payload: TelegramMessage = {
      chat_id: chatId,
      text: message,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('텔레그램 메시지 전송 실패:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('텔레그램 메시지 전송 오류:', error)
    return false
  }
}

/**
 * 백필 완료 알림 전송 (고정 채널)
 */
export async function sendBackfillNotification(
  clientName: string,
  dataType: 'meta' | 'naver',
  summary: {
    period: { start: string; end: string }
    totalRecords: number
    totalCost?: number
    totalClicks?: number
  }
): Promise<boolean> {
  const dataTypeLabel = dataType === 'meta' ? 'Meta 광고' : '네이버 플레이스 광고'

  const message = `
<b>📊 데이터 백필 완료</b>

<b>클라이언트:</b> ${clientName}
<b>데이터 유형:</b> ${dataTypeLabel}
<b>기간:</b> ${summary.period.start} ~ ${summary.period.end}
<b>총 레코드:</b> ${summary.totalRecords.toLocaleString()}건
${summary.totalCost ? `<b>총 비용:</b> ${summary.totalCost.toLocaleString()}원` : ''}
${summary.totalClicks ? `<b>총 클릭:</b> ${summary.totalClicks.toLocaleString()}회` : ''}

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
  `.trim()

  return sendTelegramMessage(BACKFILL_CHAT_ID, message)
}

/**
 * 네이버 데이터 업로드 완료 알림
 */
export async function sendNaverUploadNotification(
  clientName: string,
  summary: {
    dateRange: { start: string; end: string }
    totalRecords: number
    uniqueKeywords: number
    totalCost: number
    totalClicks: number
  }
): Promise<boolean> {
  const message = `
<b>📤 네이버 광고 데이터 업로드 완료</b>

<b>클라이언트:</b> ${clientName}
<b>기간:</b> ${summary.dateRange.start} ~ ${summary.dateRange.end}
<b>총 레코드:</b> ${summary.totalRecords.toLocaleString()}건
<b>고유 키워드:</b> ${summary.uniqueKeywords}개
<b>총 비용:</b> ${summary.totalCost.toLocaleString()}원
<b>총 클릭:</b> ${summary.totalClicks.toLocaleString()}회

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
  `.trim()

  return sendTelegramMessage(BACKFILL_CHAT_ID, message)
}

/**
 * 일일 리포트 알림 (클라이언트별)
 */
export async function sendDailyReportNotification(
  chatId: string,
  clientName: string,
  report: {
    date: string
    meta?: {
      impressions: number
      clicks: number
      leads: number
      spend: number
      ctr: number
    }
    naver?: {
      impressions: number
      clicks: number
      totalCost: number
      avgRank: number
    }
  }
): Promise<boolean> {
  let message = `<b>📈 ${clientName} 일일 리포트</b>\n<b>날짜:</b> ${report.date}\n\n`

  if (report.meta) {
    message += `<b>🔵 Meta 광고</b>
• 노출: ${report.meta.impressions.toLocaleString()}
• 클릭: ${report.meta.clicks.toLocaleString()}
• 리드: ${report.meta.leads.toLocaleString()}
• 비용: $${report.meta.spend.toFixed(2)}
• CTR: ${report.meta.ctr.toFixed(2)}%\n\n`
  }

  if (report.naver) {
    message += `<b>🟢 네이버 플레이스</b>
• 노출: ${report.naver.impressions.toLocaleString()}
• 클릭: ${report.naver.clicks.toLocaleString()}
• 비용: ${report.naver.totalCost.toLocaleString()}원
• 평균순위: ${report.naver.avgRank.toFixed(1)}위`
  }

  return sendTelegramMessage(chatId, message.trim())
}

/**
 * 에러 알림 (관리자용)
 */
export async function sendErrorNotification(
  errorType: string,
  clientName: string,
  errorMessage: string
): Promise<boolean> {
  const message = `
<b>⚠️ 오류 발생</b>

<b>유형:</b> ${errorType}
<b>클라이언트:</b> ${clientName}
<b>오류:</b> ${errorMessage}

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
  `.trim()

  return sendTelegramMessage(BACKFILL_CHAT_ID, message)
}
