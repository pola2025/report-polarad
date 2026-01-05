/**
 * 클라이언트 일시 중지 API
 *
 * POST /api/admin/clients/suspend
 * - active 상태 클라이언트를 suspended로 변경
 * - 관리자 인증 필요
 */

import { NextRequest, NextResponse } from 'next/server'
import { suspendClient, getClientById } from '@/lib/client-status'
import { sendTelegramMessage } from '@/lib/telegram'

const ADMIN_CHAT_ID = '-1003394139746'

export async function POST(request: NextRequest) {
  // 관리자 키 검증
  const adminKey =
    request.headers.get('x-admin-key') ||
    (await request.clone().json().catch(() => ({}))).adminKey

  const expectedAdminKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY

  if (expectedAdminKey && adminKey !== expectedAdminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { clientId, reason } = await request.json()

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: 'Suspension reason required' }, { status: 400 })
    }

    // 클라이언트 확인
    const client = await getClientById(clientId)

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (client.status === 'suspended') {
      return NextResponse.json({ error: 'Client is already suspended' }, { status: 400 })
    }

    // 일시 중지 처리
    await suspendClient(clientId, reason)

    // 텔레그램 알림
    const message = `
<b>⚠️ 클라이언트 일시 중지</b>

<b>클라이언트:</b> ${client.client_name}
<b>사유:</b> ${reason}

<b>상태:</b> suspended (서비스 비활성화)

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
`.trim()

    await sendTelegramMessage(ADMIN_CHAT_ID, message)

    return NextResponse.json({
      success: true,
      clientId,
      clientName: client.client_name,
      status: 'suspended',
      reason,
    })
  } catch (error) {
    console.error('Suspend client error:', error)
    return NextResponse.json(
      { error: 'Failed to suspend client', details: String(error) },
      { status: 500 }
    )
  }
}
