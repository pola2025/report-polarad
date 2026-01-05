/**
 * 토큰 갱신 API
 *
 * POST /api/auth/refresh
 * - 만료 임박 토큰 갱신
 * - active 상태 클라이언트만 갱신 가능
 */

import { NextRequest, NextResponse } from 'next/server'
import { refreshAccessToken, isTokenExpiringSoon, isTokenExpired } from '@/lib/meta-oauth'
import { getClientById, updateClientOAuth, getClients } from '@/lib/client-status'
import { decrypt } from '@/lib/encryption'
import { sendTelegramMessage, sendErrorNotification } from '@/lib/telegram'

const ADMIN_CHAT_ID = '-1003394139746'

/**
 * 단일 클라이언트 토큰 갱신
 */
export async function POST(request: NextRequest) {
  try {
    const { clientId, adminKey } = await request.json()

    // 관리자 키 검증 (선택적)
    const expectedAdminKey = process.env.NEXT_PUBLIC_ADMIN_KEY
    if (expectedAdminKey && adminKey !== expectedAdminKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
    }

    const client = await getClientById(clientId)

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (client.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active clients can refresh tokens' },
        { status: 403 }
      )
    }

    if (!client.meta_access_token) {
      return NextResponse.json({ error: 'No token to refresh' }, { status: 400 })
    }

    // 토큰 복호화
    const currentToken = decrypt(client.meta_access_token)
    if (!currentToken) {
      return NextResponse.json({ error: 'Failed to decrypt token' }, { status: 500 })
    }

    // 토큰 갱신
    const newTokenData = await refreshAccessToken(currentToken)

    // 만료 시간 계산
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in)

    // DB 업데이트
    await updateClientOAuth(client.id, {
      accessToken: newTokenData.access_token,
      tokenExpiresAt: expiresAt,
    })

    return NextResponse.json({
      success: true,
      clientId: client.id,
      clientName: client.client_name,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: 'Token refresh failed', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * 모든 만료 임박 토큰 일괄 갱신 (Cron Job용)
 *
 * GET /api/auth/refresh?cron=true
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const isCron = searchParams.get('cron') === 'true'
  const adminKey = searchParams.get('adminKey')

  // 관리자 키 검증
  const expectedAdminKey = process.env.NEXT_PUBLIC_ADMIN_KEY
  if (expectedAdminKey && adminKey !== expectedAdminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isCron) {
    return NextResponse.json(
      { error: 'Use cron=true for batch refresh' },
      { status: 400 }
    )
  }

  try {
    // active 상태 클라이언트만 조회
    const activeClients = await getClients('active')

    const results = {
      total: activeClients.length,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{ clientId: string; clientName: string; status: string; error?: string }>,
    }

    for (const client of activeClients) {
      // 토큰이 없거나 만료 임박하지 않으면 스킵
      if (!client.meta_access_token || !client.meta_token_expires_at) {
        results.skipped++
        results.details.push({
          clientId: client.id,
          clientName: client.client_name,
          status: 'skipped',
          error: 'No token',
        })
        continue
      }

      // 만료되었거나 7일 이내 만료 예정인 경우만 갱신
      const needsRefresh =
        isTokenExpired(client.meta_token_expires_at) ||
        isTokenExpiringSoon(client.meta_token_expires_at)

      if (!needsRefresh) {
        results.skipped++
        results.details.push({
          clientId: client.id,
          clientName: client.client_name,
          status: 'skipped',
          error: 'Token not expiring soon',
        })
        continue
      }

      try {
        const currentToken = decrypt(client.meta_access_token)
        if (!currentToken) {
          throw new Error('Failed to decrypt token')
        }

        const newTokenData = await refreshAccessToken(currentToken)

        const expiresAt = new Date()
        expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in)

        await updateClientOAuth(client.id, {
          accessToken: newTokenData.access_token,
          tokenExpiresAt: expiresAt,
        })

        results.refreshed++
        results.details.push({
          clientId: client.id,
          clientName: client.client_name,
          status: 'refreshed',
        })
      } catch (error) {
        results.failed++
        results.details.push({
          clientId: client.id,
          clientName: client.client_name,
          status: 'failed',
          error: String(error),
        })

        // 에러 알림 전송
        await sendErrorNotification(
          'Token Refresh Failed',
          client.client_name,
          String(error)
        )
      }
    }

    // 갱신 결과 알림 (갱신 또는 실패가 있는 경우)
    if (results.refreshed > 0 || results.failed > 0) {
      const message = `
<b>🔄 토큰 갱신 완료</b>

<b>전체:</b> ${results.total}
<b>갱신:</b> ${results.refreshed}
<b>스킵:</b> ${results.skipped}
<b>실패:</b> ${results.failed}

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
`.trim()

      await sendTelegramMessage(ADMIN_CHAT_ID, message)
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Batch token refresh error:', error)
    return NextResponse.json(
      { error: 'Batch refresh failed', details: String(error) },
      { status: 500 }
    )
  }
}
