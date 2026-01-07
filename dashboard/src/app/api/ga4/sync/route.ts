/**
 * GA4 동기화 API
 * GA4 데이터를 Airtable에 동기화
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  getGA4Credentials,
  fetchGA4DailyData,
  fetchGA4Sources,
} from '@/lib/ga4'

// Airtable 설정
const AIRTABLE_CONFIG = {
  apiKey: process.env.AIRTABLE_API_KEY || '',
  baseId: process.env.AIRTABLE_NARATTON_BASE_ID || 'appN2KzUoORRrb8X9',
  ga4DailyTableId: 'tblGA4Daily', // GA4 일별 데이터 테이블 (별도 생성 필요)
  ga4SourcesTableId: 'tblGA4Sources', // GA4 소스/매체 테이블 (별도 생성 필요)
}

// GA4 지원 클라이언트
const GA4_CLIENTS: Record<string, { propertyId: string; name: string }> = {
  naratton: {
    propertyId: process.env.GA4_NARATTON_PROPERTY_ID || '497585078',
    name: '나라똔',
  },
}

// Airtable에 레코드 생성/업데이트
async function upsertAirtableRecords(
  tableId: string,
  records: Record<string, unknown>[],
  keyField: string
): Promise<{ created: number; updated: number; errors: string[] }> {
  const results = { created: 0, updated: 0, errors: [] as string[] }

  if (!AIRTABLE_CONFIG.apiKey) {
    results.errors.push('Airtable API 키가 설정되지 않았습니다.')
    return results
  }

  // 기존 레코드 조회 (키 필드 기준)
  const existingRecords = new Map<string, string>()

  try {
    let offset = ''
    do {
      const listUrl = new URL(
        `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${tableId}`
      )
      if (offset) listUrl.searchParams.set('offset', offset)

      const listRes = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}` },
      })

      if (!listRes.ok) {
        // 테이블이 없으면 생성 모드로 전환
        if (listRes.status === 404) {
          console.log(`테이블 ${tableId}가 없습니다. 새로 생성합니다.`)
          break
        }
        throw new Error(`Airtable 조회 실패: ${listRes.status}`)
      }

      const listData = await listRes.json()
      for (const record of listData.records || []) {
        const key = record.fields[keyField]
        if (key) existingRecords.set(String(key), record.id)
      }
      offset = listData.offset || ''
    } while (offset)
  } catch (error) {
    console.error('기존 레코드 조회 오류:', error)
  }

  // 레코드 생성/업데이트
  const batchSize = 10
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)

    const toCreate: { fields: Record<string, unknown> }[] = []
    const toUpdate: { id: string; fields: Record<string, unknown> }[] = []

    for (const record of batch) {
      const key = String(record[keyField])
      const existingId = existingRecords.get(key)

      if (existingId) {
        toUpdate.push({ id: existingId, fields: record })
      } else {
        toCreate.push({ fields: record })
      }
    }

    // 생성
    if (toCreate.length > 0) {
      try {
        const createRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${tableId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ records: toCreate }),
          }
        )

        if (createRes.ok) {
          const createData = await createRes.json()
          results.created += createData.records?.length || 0
        } else {
          const errorText = await createRes.text()
          results.errors.push(`생성 오류: ${errorText}`)
        }
      } catch (error) {
        results.errors.push(`생성 오류: ${error}`)
      }
    }

    // 업데이트
    if (toUpdate.length > 0) {
      try {
        const updateRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${tableId}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ records: toUpdate }),
          }
        )

        if (updateRes.ok) {
          const updateData = await updateRes.json()
          results.updated += updateData.records?.length || 0
        } else {
          const errorText = await updateRes.text()
          results.errors.push(`업데이트 오류: ${errorText}`)
        }
      } catch (error) {
        results.errors.push(`업데이트 오류: ${error}`)
      }
    }

    // Rate limit 방지
    if (i + batchSize < records.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  return results
}

// POST: GA4 데이터 동기화
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientSlug, startDate, endDate, syncDaily = true, syncSources = true } = body

    // 클라이언트 확인
    if (!clientSlug || !GA4_CLIENTS[clientSlug]) {
      return NextResponse.json(
        {
          success: false,
          error: `GA4가 지원되지 않는 클라이언트입니다. 지원 클라이언트: ${Object.keys(GA4_CLIENTS).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // GA4 자격 증명 확인
    const credentials = getGA4Credentials()
    if (!credentials) {
      return NextResponse.json(
        {
          success: false,
          error: 'GA4 서비스 계정이 설정되지 않았습니다.',
        },
        { status: 500 }
      )
    }

    // 기간 설정
    const now = new Date()
    const defaultEndDate = now.toISOString().split('T')[0]
    const defaultStartDate = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0]

    const effectiveStartDate = startDate || defaultStartDate
    const effectiveEndDate = endDate || defaultEndDate

    const { propertyId, name } = GA4_CLIENTS[clientSlug]
    const syncResults: {
      daily?: { created: number; updated: number; errors: string[] }
      sources?: { created: number; updated: number; errors: string[] }
    } = {}

    // 일별 데이터 동기화
    if (syncDaily) {
      const dailyData = await fetchGA4DailyData(
        propertyId,
        credentials,
        effectiveStartDate,
        effectiveEndDate
      )

      const dailyRecords = dailyData.map((d) => ({
        date: d.date,
        sessions: d.sessions,
        users: d.users,
        new_users: d.newUsers,
        pageviews: d.pageviews,
        bounce_rate: d.bounceRate,
        avg_session_duration: d.avgSessionDuration,
        conversions: d.conversions,
        conversion_rate: d.conversionRate,
        client: name,
        synced_at: new Date().toISOString(),
      }))

      syncResults.daily = await upsertAirtableRecords(
        AIRTABLE_CONFIG.ga4DailyTableId,
        dailyRecords,
        'date'
      )
    }

    // 소스/매체 데이터 동기화
    if (syncSources) {
      const sourcesData = await fetchGA4Sources(
        propertyId,
        credentials,
        effectiveStartDate,
        effectiveEndDate
      )

      const sourcesRecords = sourcesData.map((s) => ({
        period_key: `${effectiveStartDate}_${effectiveEndDate}_${s.sourceMedium}`,
        period_start: effectiveStartDate,
        period_end: effectiveEndDate,
        source: s.source,
        medium: s.medium,
        source_medium: s.sourceMedium,
        sessions: s.sessions,
        users: s.users,
        new_users: s.newUsers,
        conversions: s.conversions,
        bounce_rate: s.bounceRate,
        client: name,
        synced_at: new Date().toISOString(),
      }))

      syncResults.sources = await upsertAirtableRecords(
        AIRTABLE_CONFIG.ga4SourcesTableId,
        sourcesRecords,
        'period_key'
      )
    }

    return NextResponse.json({
      success: true,
      client: name,
      period: { start: effectiveStartDate, end: effectiveEndDate },
      results: syncResults,
    })
  } catch (error) {
    console.error('GA4 sync error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'GA4 동기화 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

// GET: 동기화 상태 확인
export async function GET() {
  const credentials = getGA4Credentials()

  return NextResponse.json({
    configured: !!credentials,
    clients: Object.entries(GA4_CLIENTS).map(([slug, config]) => ({
      slug,
      name: config.name,
      propertyId: config.propertyId,
    })),
    airtable: {
      configured: !!AIRTABLE_CONFIG.apiKey,
      baseId: AIRTABLE_CONFIG.baseId,
      tables: {
        daily: AIRTABLE_CONFIG.ga4DailyTableId,
        sources: AIRTABLE_CONFIG.ga4SourcesTableId,
      },
    },
  })
}
