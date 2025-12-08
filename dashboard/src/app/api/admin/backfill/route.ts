/**
 * Admin API - 백필 실행
 * 테이블: polarad_clients, polarad_meta_data (BAS-Meta와 분리)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY)
}

// 날짜 포맷 (YYYY-MM-DD)
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// actions 배열에서 특정 action_type 값 추출
function getActionValue(actions: Array<{ action_type: string; value: string }>, actionType: string): number {
  if (!actions || !Array.isArray(actions)) return 0
  const action = actions.find((a) => a.action_type === actionType)
  return action ? parseInt(action.value) || 0 : 0
}

// Meta API 호출
async function fetchMetaInsights(
  adAccountId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<Array<Record<string, unknown>>> {
  // act_ 접두사가 없으면 추가
  const formattedAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  const baseUrl = `https://graph.facebook.com/v22.0/${formattedAccountId}/insights`

  const params = new URLSearchParams({
    access_token: accessToken,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    fields: 'ad_id,ad_name,campaign_id,campaign_name,impressions,spend,inline_link_clicks,reach,actions,account_currency',
    breakdowns: 'publisher_platform,device_platform',
    level: 'ad',
    limit: '500',
    time_increment: '1',
  })

  let allData: Array<Record<string, unknown>> = []
  let nextUrl: string | null = `${baseUrl}?${params}`

  while (nextUrl) {
    const response: Response = await fetch(nextUrl)

    if (!response.ok) {
      const errorData = await response.json()
      const errorMessage = errorData.error?.message || response.statusText
      throw new Error(`Meta API Error: ${errorMessage}`)
    }

    const resJson = await response.json()

    if (resJson.data && resJson.data.length > 0) {
      allData = allData.concat(resJson.data)
    }

    nextUrl = resJson.paging?.next || null

    if (nextUrl) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return allData
}

// polarad_meta_data에 저장
async function saveRawData(
  clientId: string,
  insights: Array<Record<string, unknown>>
): Promise<number> {
  if (!insights || insights.length === 0) return 0

  const records = insights.map((item) => ({
    client_id: clientId,
    date: item.date_start as string,
    ad_id: item.ad_id as string,
    ad_name: (item.ad_name as string) || 'Unknown',
    campaign_id: item.campaign_id as string,
    campaign_name: (item.campaign_name as string) || 'Unknown',
    platform: (item.publisher_platform as string) || 'unknown',
    device: (item.device_platform as string) || 'unknown',
    currency: (item.account_currency as string) || 'KRW',
    impressions: parseInt(item.impressions as string) || 0,
    clicks: parseInt(item.inline_link_clicks as string) || 0,
    leads: getActionValue(item.actions as Array<{ action_type: string; value: string }>, 'lead'),
    spend: parseFloat(item.spend as string) || 0,
  }))

  let savedCount = 0
  const batchSize = 50

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await getSupabaseAdmin()
      .from(TABLES.META_DATA)
      .upsert(batch as any, { onConflict: 'client_id,date,ad_id,platform,device' })

    if (!error) {
      savedCount += batch.length
    }
  }

  return savedCount
}

// POST: 백필 실행
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { clientId, days = 30, startDate: customStart, endDate: customEnd } = body

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    // 날짜 범위 결정
    let startDate: string
    let endDate: string

    if (customStart && customEnd) {
      startDate = customStart
      endDate = customEnd
    } else {
      const end = new Date()
      end.setDate(end.getDate() - 1)
      const start = new Date(end)
      start.setDate(start.getDate() - (days - 1))

      startDate = formatDate(start)
      endDate = formatDate(end)
    }

    // 클라이언트 정보 확인
    const { data: clientData, error: clientError } = await getSupabaseAdmin()
      .from(TABLES.CLIENTS)
      .select('id, client_name, meta_ad_account_id, meta_access_token')
      .eq('id', clientId)
      .single()

    if (clientError || !clientData) {
      return NextResponse.json({ error: '클라이언트를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!clientData.meta_ad_account_id || !clientData.meta_access_token) {
      return NextResponse.json({
        error: 'Meta 광고계정 ID 또는 Access Token이 설정되지 않았습니다.'
      }, { status: 400 })
    }

    // Meta API 호출
    const insights = await fetchMetaInsights(
      clientData.meta_ad_account_id,
      clientData.meta_access_token,
      startDate,
      endDate
    )

    // 저장
    const savedCount = await saveRawData(clientId, insights)

    return NextResponse.json({
      success: true,
      client: clientData.client_name,
      period: { startDate, endDate },
      totalRecords: insights.length,
      savedRecords: savedCount,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('Backfill API error:', error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// GET: 백필 가능 여부 확인
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  try {
    const { data: clientData, error } = await getSupabaseAdmin()
      .from(TABLES.CLIENTS)
      .select('id, client_name, meta_ad_account_id, meta_access_token')
      .eq('id', clientId)
      .single()

    if (error || !clientData) {
      return NextResponse.json({
        canBackfill: false,
        error: '클라이언트를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    const hasAccountId = !!clientData.meta_ad_account_id
    const hasToken = !!clientData.meta_access_token

    // 최신 데이터 날짜
    const { data: latestData } = await getSupabaseAdmin()
      .from(TABLES.META_DATA)
      .select('date')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(1)

    const latestDate = latestData?.[0]?.date || null

    return NextResponse.json({
      canBackfill: hasAccountId && hasToken,
      client: {
        id: clientData.id,
        name: clientData.client_name,
        hasAccountId,
        hasToken,
        latestDataDate: latestDate,
      },
      missingRequirements: [
        ...(!hasAccountId ? ['Meta 광고계정 ID'] : []),
        ...(!hasToken ? ['Access Token'] : []),
      ],
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
