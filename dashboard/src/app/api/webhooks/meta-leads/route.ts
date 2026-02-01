/**
 * Meta Leadgen Webhook Endpoint
 *
 * GET  - Meta 인증 챌린지 핸들러
 * POST - 리드 이벤트 수신 + HMAC-SHA256 서명 검증
 *
 * Meta는 실패 시 재시도하므로, 내부 에러가 나도 200 반환
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processLeadEvent } from '@/lib/meta-webhook'

// ===========================
// GET: 인증 챌린지
// ===========================
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[meta-webhook] Verification challenge accepted')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[meta-webhook] Verification failed:', { mode, token })
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// ===========================
// POST: 리드 이벤트 수신
// ===========================
export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET

  // 서명 검증
  if (appSecret) {
    const signature = request.headers.get('x-hub-signature-256')
    if (!signature) {
      console.warn('[meta-webhook] Missing x-hub-signature-256 header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    const body = await request.text()
    const expectedSig = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(body)
      .digest('hex')

    const sigBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSig)

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.warn('[meta-webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // body를 이미 text로 읽었으므로 JSON으로 파싱
    const payload = JSON.parse(body)
    return handlePayload(payload)
  }

  // APP_SECRET 미설정 시 서명 검증 스킵 (개발용)
  const payload = await request.json()
  return handlePayload(payload)
}

// ===========================
// Payload 처리
// ===========================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePayload(payload: any) {
  // Meta Webhook payload 구조:
  // { object: 'page', entry: [{ id, time, changes: [{ field, value: { ... } }] }] }
  if (payload.object !== 'page') {
    console.log('[meta-webhook] Ignoring non-page object:', payload.object)
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const results: Array<{ leadgenId: string; success: boolean; action?: string; error?: string }> = []

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === 'leadgen') {
        const leadgenId = change.value?.leadgen_id
        if (!leadgenId) continue

        console.log(`[meta-webhook] Processing leadgen_id: ${leadgenId}`)

        try {
          const result = await processLeadEvent(String(leadgenId))
          results.push({
            leadgenId,
            success: result.success,
            action: result.action,
            error: result.error,
          })
        } catch (err) {
          console.error(`[meta-webhook] Error processing leadgen_id ${leadgenId}:`, err)
          results.push({
            leadgenId,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }
    }
  }

  // 항상 200 반환 (Meta 재시도 방지)
  return NextResponse.json({ status: 'ok', results }, { status: 200 })
}
