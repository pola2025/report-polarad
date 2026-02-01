/**
 * Admin API - 상호명 검색 키워드 통계
 * 클라이언트 조회: Airtable
 * 데이터 저장: Airtable (키워드 통계 테이블 - 추후 생성)
 *
 * 관리자가 월별로 키워드 검색량을 수동 입력
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!
const AIRTABLE_CLIENTS_BASE_ID = 'appC3XKBcYgZBTETn'
const AIRTABLE_CLIENTS_TABLE_ID = 'tblwQBbsMyg00qi8F'

// 키워드 통계 테이블 설정
const AIRTABLE_KEYWORD_STATS_BASE_ID = 'appC3XKBcYgZBTETn' // 클라이언트와 같은 Base 사용
const AIRTABLE_KEYWORD_STATS_TABLE_ID = 'tblF5ybDTlumOY8oY'

// Airtable에서 클라이언트 목록 조회
async function getClientsFromAirtable() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_CLIENTS_BASE_ID}/${AIRTABLE_CLIENTS_TABLE_ID}`

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  })

  const data = await response.json()
  if (data.error) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.records.map((r: any) => ({
    id: r.fields.id || r.id,
    client_name: r.fields.Name,
    slug: r.fields.slug,
  }))
}

// Airtable에서 특정 클라이언트 조회
async function getClientFromAirtable(clientIdOrSlug: string) {
  const clients = await getClientsFromAirtable()
  return clients.find((c: { id: string; slug: string }) => c.id === clientIdOrSlug || c.slug === clientIdOrSlug)
}

// GET: 키워드 통계 조회
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Airtable 키워드 통계 테이블 미생성 상태
  if (!AIRTABLE_KEYWORD_STATS_TABLE_ID) {
    return NextResponse.json({
      success: true,
      data: [],
      count: 0,
      monthlySummary: [],
      message: 'Airtable 키워드 통계 테이블이 아직 생성되지 않았습니다.',
    })
  }

  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const yearMonth = searchParams.get('yearMonth')
    const keyword = searchParams.get('keyword')

    // Airtable에서 키워드 통계 조회
    let formula = ''
    const conditions = []
    if (clientId) conditions.push(`{client_id}='${clientId}'`)
    if (yearMonth) conditions.push(`{year_month}='${yearMonth}'`)
    if (keyword) conditions.push(`FIND('${keyword}', {keyword})`)

    if (conditions.length > 0) {
      formula = conditions.length === 1 ? conditions[0] : `AND(${conditions.join(', ')})`
    }

    let url = `https://api.airtable.com/v0/${AIRTABLE_KEYWORD_STATS_BASE_ID}/${AIRTABLE_KEYWORD_STATS_TABLE_ID}?sort[0][field]=year_month&sort[0][direction]=desc`
    if (formula) {
      url += `&filterByFormula=${encodeURIComponent(formula)}`
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
      cache: 'no-store',
    })

    const result = await response.json()
    if (result.error) {
      console.error('Airtable error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.records.map((r: any) => ({
      id: r.id,
      client_id: r.fields.client_id,
      year_month: r.fields.year_month,
      keyword: r.fields.keyword,
      pc_searches: r.fields.pc_searches || 0,
      mobile_searches: r.fields.mobile_searches || 0,
      total_searches: (r.fields.pc_searches || 0) + (r.fields.mobile_searches || 0),
      notes: r.fields.notes,
    }))

    // 클라이언트 정보 추가
    const clients = await getClientsFromAirtable()
    const dataWithClients = data.map((row: { client_id: string }) => {
      const client = clients.find((c: { id: string }) => c.id === row.client_id)
      return { ...row, client: client ? { client_name: client.client_name, slug: client.slug } : null }
    })

    // 월별 요약 계산
    const monthlySummary = dataWithClients.reduce((acc: Record<string, { year_month: string; total_pc: number; total_mobile: number; total_searches: number; keyword_count: number }>, row: { year_month: string; pc_searches: number; mobile_searches: number; total_searches: number }) => {
      const month = row.year_month
      if (!acc[month]) {
        acc[month] = { year_month: month, total_pc: 0, total_mobile: 0, total_searches: 0, keyword_count: 0 }
      }
      acc[month].total_pc += row.pc_searches || 0
      acc[month].total_mobile += row.mobile_searches || 0
      acc[month].total_searches += row.total_searches || 0
      acc[month].keyword_count += 1
      return acc
    }, {})

    const sortedMonthlySummary = (Object.values(monthlySummary) as Array<{ year_month: string; total_pc: number; total_mobile: number; total_searches: number; keyword_count: number }>).sort((a, b) => b.year_month.localeCompare(a.year_month))

    return NextResponse.json({
      success: true,
      data: dataWithClients,
      count: dataWithClients.length,
      monthlySummary: sortedMonthlySummary,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 키워드 통계 입력 (단일 또는 일괄)
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Airtable 키워드 통계 테이블 미생성 상태
  if (!AIRTABLE_KEYWORD_STATS_TABLE_ID) {
    return NextResponse.json({
      success: false,
      error: 'Airtable 키워드 통계 테이블이 아직 생성되지 않았습니다. 테이블 생성 후 이용 가능합니다.',
    }, { status: 503 })
  }

  try {
    const body = await request.json()

    // 일괄 입력 (배열)
    if (Array.isArray(body.records)) {
      const records = body.records.map((r: {
        clientId: string
        yearMonth: string
        keyword: string
        pcSearches: number
        mobileSearches: number
        notes?: string
      }) => ({
        client_id: r.clientId,
        year_month: r.yearMonth,
        keyword: r.keyword,
        pc_searches: r.pcSearches || 0,
        mobile_searches: r.mobileSearches || 0,
        notes: r.notes || null,
      }))

      // 유효성 검증
      for (const record of records) {
        if (!record.client_id || !record.year_month || !record.keyword) {
          return NextResponse.json({
            error: '필수 필드가 누락되었습니다 (clientId, yearMonth, keyword)',
            invalidRecord: record,
          }, { status: 400 })
        }
      }

      // Airtable에서 클라이언트 존재 확인
      const clientIds = Array.from(new Set(records.map((r: { client_id: string }) => r.client_id)))
      const clients = await getClientsFromAirtable()
      const validClientIds = new Set(clients.map((c: { id: string }) => c.id))
      const invalidClients = clientIds.filter(id => !validClientIds.has(id))

      if (invalidClients.length > 0) {
        return NextResponse.json({
          error: '존재하지 않는 클라이언트가 포함되어 있습니다.',
          invalidClientIds: invalidClients,
        }, { status: 404 })
      }

      // Airtable에 레코드 생성 (10개씩 배치)
      const airtableRecords = records.map((r: { client_id: string; year_month: string; keyword: string; pc_searches: number; mobile_searches: number; notes: string | null }) => ({
        fields: {
          client_id: r.client_id,
          year_month: r.year_month,
          keyword: r.keyword,
          pc_searches: r.pc_searches,
          mobile_searches: r.mobile_searches,
          notes: r.notes,
        }
      }))

      let inserted = 0
      for (let i = 0; i < airtableRecords.length; i += 10) {
        const batch = airtableRecords.slice(i, i + 10)
        const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_KEYWORD_STATS_BASE_ID}/${AIRTABLE_KEYWORD_STATS_TABLE_ID}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: batch }),
        })

        const result = await response.json()
        if (result.error) {
          console.error('Airtable insert error:', result.error)
          return NextResponse.json({ error: result.error.message }, { status: 500 })
        }
        inserted += result.records?.length || 0
      }

      return NextResponse.json({
        success: true,
        message: `${inserted}건의 키워드 통계가 저장되었습니다.`,
        count: inserted,
      })
    }

    // 단일 입력
    const { clientId, yearMonth, keyword, pcSearches, mobileSearches, notes } = body

    if (!clientId || !yearMonth || !keyword) {
      return NextResponse.json({
        error: '필수 필드가 누락되었습니다 (clientId, yearMonth, keyword)',
      }, { status: 400 })
    }

    // yearMonth 형식 검증 (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json({
        error: 'yearMonth 형식이 잘못되었습니다 (YYYY-MM)',
      }, { status: 400 })
    }

    // Airtable에서 클라이언트 존재 확인
    const client = await getClientFromAirtable(clientId)
    if (!client) {
      return NextResponse.json({ error: '존재하지 않는 클라이언트입니다.' }, { status: 404 })
    }

    // Airtable에 레코드 생성
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_KEYWORD_STATS_BASE_ID}/${AIRTABLE_KEYWORD_STATS_TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{
          fields: {
            client_id: clientId,
            year_month: yearMonth,
            keyword,
            pc_searches: pcSearches || 0,
            mobile_searches: mobileSearches || 0,
            notes: notes || null,
          }
        }]
      }),
    })

    const result = await response.json()
    if (result.error) {
      console.error('Airtable insert error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '키워드 통계가 저장되었습니다.',
      data: result.records[0],
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 키워드 통계 삭제
export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Airtable 키워드 통계 테이블 미생성 상태
  if (!AIRTABLE_KEYWORD_STATS_TABLE_ID) {
    return NextResponse.json({
      success: false,
      error: 'Airtable 키워드 통계 테이블이 아직 생성되지 않았습니다.',
    }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    // Airtable에서 레코드 삭제
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_KEYWORD_STATS_BASE_ID}/${AIRTABLE_KEYWORD_STATS_TABLE_ID}/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    })

    const result = await response.json()
    if (result.error) {
      console.error('Airtable delete error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '키워드 통계가 삭제되었습니다.',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
