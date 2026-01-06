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
    airtable_record_id: record.id, // Airtable 레코드 ID (수정 시 필요)
    client_id: record.fields.client_id || record.fields.slug,
    client_name: record.fields.Name,
    slug: record.fields.slug,
    client_type: record.fields.client_type || 'other',
    meta_metric_type: record.fields.meta_metric_type || 'lead',
    airtable_base_id: record.fields.airtable_base_id || null,
    airtable_table_id: record.fields.airtable_table_id || null,
    is_active: record.fields.is_active || false,
    status: record.fields.status || 'pending',
    naver_type: record.fields.naver_type || 'none',
    naver_enabled: record.fields.naver_enabled || false,
    naver_fixed_budget: record.fields.naver_fixed_budget || null,
    naver_show_keywords: record.fields.naver_show_keywords ?? true,
    naver_show_detail_tab: record.fields.naver_show_detail_tab ?? true,
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

// POST: 새 클라이언트 생성 → Airtable에 저장
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      client_name,
      slug,
      client_type,
      meta_metric_type,
      airtable_base_id,
      airtable_table_id,
      naver_type,
      naver_enabled,
      naver_fixed_budget,
      naver_show_keywords,
      naver_show_detail_tab,
      telegram_enabled,
      telegram_chat_id,
      service_start_date
    } = body

    if (!client_name || !slug) {
      return NextResponse.json({ success: false, error: 'client_name과 slug는 필수입니다' }, { status: 400 })
    }

    // UUID 생성
    const id = crypto.randomUUID()

    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_CLIENTS_BASE_ID}/${AIRTABLE_CLIENTS_TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{
          fields: {
            Name: client_name,
            id,
            client_id: slug,
            slug,
            client_type: client_type || 'other',
            meta_metric_type: meta_metric_type || 'lead',
            airtable_base_id: airtable_base_id || null,
            airtable_table_id: airtable_table_id || null,
            is_active: true,
            status: 'active',
            naver_type: naver_type || 'none',
            naver_enabled: naver_enabled || false,
            naver_fixed_budget: naver_fixed_budget || null,
            naver_show_keywords: naver_show_keywords ?? true,
            naver_show_detail_tab: naver_show_detail_tab ?? true,
            telegram_enabled: telegram_enabled || false,
            telegram_chat_id: telegram_chat_id || null,
            service_start_date: service_start_date || new Date().toISOString().split('T')[0],
          }
        }]
      })
    })

    const data = await response.json()

    if (data.error) {
      console.error('Airtable create error:', data.error)
      return NextResponse.json({ success: false, error: data.error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      client: {
        id,
        client_name,
        slug,
        airtable_record_id: data.records[0].id
      }
    })
  } catch (error) {
    console.error('Failed to create client:', error)
    return NextResponse.json({ success: false, error: 'Failed to create client' }, { status: 500 })
  }
}

// PUT: 클라이언트 수정 → Airtable 업데이트
export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { airtable_record_id, ...updateFields } = body

    if (!airtable_record_id) {
      return NextResponse.json({ success: false, error: 'airtable_record_id는 필수입니다' }, { status: 400 })
    }

    // 필드 매핑 (프론트엔드 → Airtable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: Record<string, any> = {}
    if (updateFields.client_name) fields.Name = updateFields.client_name
    if (updateFields.slug) {
      fields.slug = updateFields.slug
      fields.client_id = updateFields.slug
    }
    if (updateFields.client_type) fields.client_type = updateFields.client_type
    if (updateFields.meta_metric_type) fields.meta_metric_type = updateFields.meta_metric_type
    if (updateFields.airtable_base_id !== undefined) fields.airtable_base_id = updateFields.airtable_base_id
    if (updateFields.airtable_table_id !== undefined) fields.airtable_table_id = updateFields.airtable_table_id
    if (updateFields.is_active !== undefined) fields.is_active = updateFields.is_active
    if (updateFields.status) fields.status = updateFields.status
    if (updateFields.naver_type) fields.naver_type = updateFields.naver_type
    if (updateFields.naver_enabled !== undefined) fields.naver_enabled = updateFields.naver_enabled
    if (updateFields.naver_fixed_budget !== undefined) fields.naver_fixed_budget = updateFields.naver_fixed_budget
    if (updateFields.naver_show_keywords !== undefined) fields.naver_show_keywords = updateFields.naver_show_keywords
    if (updateFields.naver_show_detail_tab !== undefined) fields.naver_show_detail_tab = updateFields.naver_show_detail_tab
    if (updateFields.telegram_enabled !== undefined) fields.telegram_enabled = updateFields.telegram_enabled
    if (updateFields.telegram_chat_id !== undefined) fields.telegram_chat_id = updateFields.telegram_chat_id
    if (updateFields.service_start_date) fields.service_start_date = updateFields.service_start_date
    if (updateFields.service_end_date) fields.service_end_date = updateFields.service_end_date

    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_CLIENTS_BASE_ID}/${AIRTABLE_CLIENTS_TABLE_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{
          id: airtable_record_id,
          fields
        }]
      })
    })

    const data = await response.json()

    if (data.error) {
      console.error('Airtable update error:', data.error)
      return NextResponse.json({ success: false, error: data.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: data.records[0] })
  } catch (error) {
    console.error('Failed to update client:', error)
    return NextResponse.json({ success: false, error: 'Failed to update client' }, { status: 500 })
  }
}
