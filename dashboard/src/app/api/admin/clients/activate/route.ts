/**
 * 클라이언트 재활성화 API
 *
 * POST /api/admin/clients/activate
 * - suspended/expired 상태 클라이언트를 active로 변경
 * - 관리자 인증 필요
 */

import { NextRequest, NextResponse } from 'next/server'
import { activateClient, getClientById } from '@/lib/client-status'
import { sendTelegramMessage } from '@/lib/telegram'
import { isAdminRequest } from '@/lib/admin-auth'

const ADMIN_CHAT_ID = '-1003394139746'

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { clientId } = await request.json()

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
    }

    // 클라이언트 확인
    const client = await getClientById(clientId)

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (client.status === 'active') {
      return NextResponse.json({ error: 'Client is already active' }, { status: 400 })
    }

    // 재활성화 처리
    await activateClient(clientId)

    // 텔레그램 알림
    const message = `
<b>🔄 클라이언트 재활성화</b>

<b>클라이언트:</b> ${client.client_name}
<b>이전 상태:</b> ${client.status}

<b>상태:</b> active (서비스 활성화)

⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
`.trim()

    await sendTelegramMessage(ADMIN_CHAT_ID, message)

    return NextResponse.json({
      success: true,
      clientId,
      clientName: client.client_name,
      status: 'active',
    })
  } catch (error) {
    console.error('Activate client error:', error)
    return NextResponse.json(
      { error: 'Failed to activate client', details: String(error) },
      { status: 500 }
    )
  }
}
