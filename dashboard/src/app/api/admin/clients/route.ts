/**
 * Admin API - 클라이언트 관리
 *
 * Airtable에서 클라이언트 목록 조회
 * Base: appC3XKBcYgZBTETn / Table: tblwQBbsMyg00qi8F
 */

import { NextRequest, NextResponse } from 'next/server'

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!
const AIRTABLE_CLIENTS_BASE_ID = 'appC3XKBcYgZBTETn'
const AIRTABLE_CLIENTS_TABLE_ID = 'tblwQBbsMyg00qi8F'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key') || request.nextUrl.searchParams.get('adminKey')
  const serverAdminKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY
  return adminKey === serverAdminKey
}

// Airtable에서 클라이언트 목록 조회
async function fetchClientsFromAirtable() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_CLIENTS_BASE_ID}/${AIRTABLE_CLIENTS_TABLE_ID}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
    },
    cache: 'no-store',
  })

  const data = await response.json()

  if (data.error) {
    console.error('Airtable error:', data.error)
    return []
  }

  // Airtable 레코드를 클라이언트 형식으로 변환
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.records.map((record: any) => ({
    id: record.fields.id || record.id,
    client_id: record.fields.client_id || record.fields.slug,
    client_name: record.fields.Name,
    slug: record.fields.slug,
    client_type: record.fields.client_type || 'other',
    is_active: record.fields.is_active || false,
    status: record.fields.status || 'pending',
    naver_type: record.fields.naver_type || 'none',
    naver_enabled: record.fields.naver_enabled || false,
    naver_fixed_budget: record.fields.naver_fixed_budget || null,
    telegram_enabled: record.fields.telegram_enabled || false,
    telegram_chat_id: record.fields.telegram_chat_id || null,
    meta_ad_account_id: record.fields.meta_ad_account_id || null,
    meta_user_id: null,
    meta_token_expires_at: null,
    service_start_date: record.fields.service_start_date || null,
    service_end_date: record.fields.service_end_date || null,
    created_at: record.createdTime,
    updated_at: record.createdTime,
  }))
}

// GET: 클라이언트 목록 조회
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Airtable에서 클라이언트 목록 조회
    const clients = await fetchClientsFromAirtable()

    // 상태 필터 파라미터
    const statusFilter = request.nextUrl.searchParams.get('status')

    let filteredClients = [...clients]

    // 상태 필터 적용
    if (statusFilter) {
      filteredClients = filteredClients.filter((c) => c.status === statusFilter)
    }

    // 클라이언트에 추가 정보 붙이기
    const clientsWithStats = filteredClients.map((client) => ({
      ...client,
      latestDataDate: null,
      dataCount: 0,
      daysUntilExpiry: null,
      isExpiringSoon: false,
    }))

    // 상태별 통계
    const stats = {
      pending: clientsWithStats.filter((c) => c.status === 'pending').length,
      active: clientsWithStats.filter((c) => c.status === 'active').length,
      suspended: clientsWithStats.filter((c) => c.status === 'suspended').length,
      expired: clientsWithStats.filter((c) => c.status === 'expired').length,
    }

    return NextResponse.json({
      success: true,
      clients: clientsWithStats,
      stats,
      total: clientsWithStats.length,
      activeCount: clientsWithStats.filter((c) => c.is_active).length,
    })
  } catch (error) {
    console.error('Failed to fetch clients:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clients' },
      { status: 500 }
    )
  }
}

// POST: 새 클라이언트 생성 (Airtable 관리 페이지에서 직접 추가)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(
    {
      success: false,
      error: '클라이언트 추가는 Airtable에서 직접 추가하세요: https://airtable.com/appC3XKBcYgZBTETn'
    },
    { status: 501 }
  )
}
