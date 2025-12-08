/**
 * Polarad Meta - Cloudflare Worker
 *
 * 매일 새벽 3시(KST) Meta API 데이터 자동 수집
 *
 * Cron Schedule: 0 18 * * * (UTC) = 03:00 KST
 */

import type { Env, DailyAggregate, WeeklySummary } from './types'
import { collectMetaData } from './lib/meta-api'
import { saveMetaDataToSupabase, fetchDailyData, getActiveClients, getSupabaseClient } from './lib/supabase'
import { sendCollectionCompleteNotification, sendErrorNotification } from './lib/telegram'
import { getDailyCollectionRange, formatDate } from './lib/dates'

export default {
  // Cron Trigger: 매일 새벽 3시 KST (UTC 18:00)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('⏰ Cron 트리거 실행:', new Date().toISOString())

    try {
      await collectAllClientsData(env)
    } catch (error) {
      console.error('❌ 스케줄 작업 실패:', error)
    }
  },

  // HTTP Fetch Handler
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 수동 데이터 수집 트리거
    if (path === '/trigger-collect') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
      }

      ctx.waitUntil(collectAllClientsData(env))

      return new Response(JSON.stringify({ message: '데이터 수집이 시작되었습니다.' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 특정 클라이언트 데이터 수집
    if (path === '/collect-client') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
      }

      try {
        const body = await request.json() as { clientId?: string; startDate?: string; endDate?: string }
        const { clientId, startDate, endDate } = body

        if (!clientId) {
          return new Response(JSON.stringify({ error: 'clientId is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        ctx.waitUntil(collectClientData(env, clientId, startDate, endDate))

        return new Response(JSON.stringify({ message: '클라이언트 데이터 수집이 시작되었습니다.' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response('Not found', { status: 404 })
  },
}

/**
 * 모든 활성 클라이언트 데이터 수집
 */
async function collectAllClientsData(env: Env): Promise<void> {
  console.log('🚀 전체 클라이언트 데이터 수집 시작')

  try {
    const clients = await getActiveClients(env)

    if (clients.length === 0) {
      console.log('⚠️ 활성 클라이언트가 없습니다')
      return
    }

    console.log(`📋 수집 대상 클라이언트: ${clients.length}개`)

    for (const client of clients) {
      try {
        await collectClientData(env, client.id)
        // 클라이언트 간 대기 (Rate Limit 방지)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ ${client.client_name} 수집 실패:`, errorMessage)
        await sendErrorNotification(env, client.client_name, errorMessage)
      }
    }

    console.log('✅ 전체 클라이언트 데이터 수집 완료')
  } catch (error) {
    console.error('❌ 데이터 수집 실패:', error)
    throw error
  }
}

/**
 * 특정 클라이언트 데이터 수집
 */
async function collectClientData(
  env: Env,
  clientId: string,
  startDate?: string,
  endDate?: string
): Promise<void> {
  const supabase = getSupabaseClient(env)

  // 클라이언트 정보 조회
  const { data: client, error: clientError } = await supabase
    .from('polarad_clients')
    .select('id, client_name, meta_ad_account_id')
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    throw new Error(`클라이언트를 찾을 수 없습니다: ${clientId}`)
  }

  if (!client.meta_ad_account_id) {
    throw new Error(`Meta 광고계정 ID가 설정되지 않았습니다: ${client.client_name}`)
  }

  console.log(`📊 ${client.client_name} 데이터 수집 시작`)

  // 날짜 범위 결정
  const dateRange = startDate && endDate
    ? { start: startDate, end: endDate }
    : getDailyCollectionRange()

  // 임시로 환경 변수에서 토큰 사용 (추후 클라이언트별 토큰으로 변경)
  const tempEnv: Env = {
    ...env,
    META_AD_ACCOUNT_ID: client.meta_ad_account_id,
  }

  // Meta API에서 데이터 수집
  const data = await collectMetaData(tempEnv, client.id, dateRange.start, dateRange.end)

  if (data.length === 0) {
    console.log(`⚠️ ${client.client_name}: 해당 기간 데이터 없음`)
    return
  }

  // Supabase에 저장
  const result = await saveMetaDataToSupabase(env, data)

  console.log(`✅ ${client.client_name}: ${result.success}건 저장 완료`)

  // 텔레그램 알림
  await sendCollectionCompleteNotification(
    env,
    client.client_name,
    dateRange.start,
    dateRange.end,
    result.success
  )
}
