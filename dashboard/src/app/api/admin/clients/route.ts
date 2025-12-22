/**
 * Admin API - 클라이언트 관리
 * 테이블: polarad_clients (BAS-Meta와 분리)
 *
 * OAuth 인증 시스템 통합 (2024-12)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'
import { getDaysUntilExpiry, isTokenExpiringSoon } from '@/lib/meta-oauth'
import { ClientStatus } from '@/lib/client-status'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key') || request.nextUrl.searchParams.get('adminKey')
  const serverAdminKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY
  return adminKey === serverAdminKey
}

// 서비스 종료일 계산 (시작일 + 3개월 - 1일)
function calculateEndDate(startDate: string): string {
  const start = new Date(startDate)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 3)
  end.setDate(end.getDate() - 1)
  return end.toISOString().split('T')[0]
}

// GET: 클라이언트 목록 조회
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 상태 필터 파라미터
  const statusFilter = request.nextUrl.searchParams.get('status') as ClientStatus | null

  try {
    let query = getSupabaseAdmin()
      .from(TABLES.CLIENTS)
      .select(`
        id,
        client_id,
        client_name,
        slug,
        meta_ad_account_id,
        meta_user_id,
        meta_token_expires_at,
        telegram_chat_id,
        is_active,
        status,
        approved_at,
        approved_by,
        contract_start_date,
        contract_end_date,
        suspended_at,
        suspension_reason,
        service_start_date,
        service_end_date,
        telegram_enabled,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    // 상태 필터 적용
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data: clients, error } = await query

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 각 클라이언트의 데이터 현황 및 토큰 정보 조회
    const clientsWithStats = await Promise.all(
      (clients || []).map(async (client) => {
        // 최신 데이터 날짜
        const { data: latestData } = await getSupabaseAdmin()
          .from(TABLES.META_DATA)
          .select('date')
          .eq('client_id', client.id)
          .order('date', { ascending: false })
          .limit(1)

        // 데이터 건수
        const { count } = await getSupabaseAdmin()
          .from(TABLES.META_DATA)
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)

        return {
          ...client,
          latestDataDate: latestData?.[0]?.date || null,
          dataCount: count || 0,
          // 토큰 관련 정보 추가
          daysUntilExpiry: getDaysUntilExpiry(client.meta_token_expires_at),
          isExpiringSoon: isTokenExpiringSoon(client.meta_token_expires_at),
        }
      })
    )

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
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 새 클라이언트 생성
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name,
      account,
      token,
      telegram,
      service_start_date,
      service_end_date,
      telegram_enabled = true,
      unlimited_service = false,
    } = body

    // 필수 필드 검증
    if (!name) {
      return NextResponse.json({ error: '클라이언트명은 필수입니다.' }, { status: 400 })
    }

    // 중복 확인 (이름)
    const { data: existingByName } = await getSupabaseAdmin()
      .from(TABLES.CLIENTS)
      .select('id')
      .ilike('client_name', name)
      .limit(1)

    if (existingByName && existingByName.length > 0) {
      return NextResponse.json(
        { success: false, error: `이미 등록된 클라이언트명입니다: ${name}` },
        { status: 409 }
      )
    }

    // client_id 및 slug 생성
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50)

    // 서비스 기간 계산
    const startDate = service_start_date || new Date().toISOString().split('T')[0]
    let endDate: string | null = null
    if (unlimited_service) {
      endDate = null
    } else if (service_end_date) {
      endDate = service_end_date
    } else {
      endDate = calculateEndDate(startDate)
    }

    // 클라이언트 생성
    const { data: newClient, error: clientError } = await getSupabaseAdmin()
      .from(TABLES.CLIENTS)
      .insert({
        client_id: slug,
        client_name: name,
        slug,
        meta_ad_account_id: account || null,
        meta_access_token: token || null,
        telegram_chat_id: telegram || null,
        is_active: true,
        status: token ? 'active' : 'pending',
        service_start_date: startDate,
        service_end_date: endDate,
        contract_start_date: startDate,
        contract_end_date: endDate,
        telegram_enabled,
      })
      .select()
      .single()

    if (clientError) {
      console.error('Error creating client:', clientError)
      if (clientError.code === '23505') {
        return NextResponse.json(
          { success: false, error: '이미 존재하는 클라이언트입니다.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ success: false, error: clientError.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        client: {
          id: newClient.id,
          name: newClient.client_name,
          slug: newClient.slug,
          account: newClient.meta_ad_account_id,
          isActive: newClient.is_active,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
