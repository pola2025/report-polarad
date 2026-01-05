/**
 * Admin API - 클라이언트 관리
 *
 * Supabase 의존성 제거 - 하드코딩된 클라이언트 목록 사용
 * 클라이언트 추가/수정은 코드 수정 필요
 */

import { NextRequest, NextResponse } from 'next/server'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key') || request.nextUrl.searchParams.get('adminKey')
  const serverAdminKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY
  return adminKey === serverAdminKey
}

// 하드코딩된 클라이언트 목록
const CLIENTS = [
  {
    id: '3ff2896e-6786-4936-9c57-311f69f43c63',
    client_id: 'hea-pangyo',
    client_name: 'H.E.A 판교',
    slug: 'hea-pangyo',
    client_type: 'restaurant',
    is_active: true,
    status: 'active',
    naver_type: 'place',
    naver_enabled: true,
    naver_fixed_budget: null,
    telegram_enabled: true,
    telegram_chat_id: null,
    meta_ad_account_id: null,
    meta_user_id: null,
    meta_token_expires_at: null,
    service_start_date: '2024-11-01',
    service_end_date: null,
    created_at: '2024-11-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
  {
    id: 'c2f60730-f8c1-4361-b9fc-3b44725c3955',
    client_id: 'naratton',
    client_name: '나라똔',
    slug: 'naratton',
    client_type: 'consulting',
    is_active: true,
    status: 'active',
    naver_type: 'brand_search',
    naver_enabled: true,
    naver_fixed_budget: 1320000,
    telegram_enabled: true,
    telegram_chat_id: null,
    meta_ad_account_id: null,
    meta_user_id: null,
    meta_token_expires_at: null,
    service_start_date: '2024-12-01',
    service_end_date: null,
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
]

// GET: 클라이언트 목록 조회
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 상태 필터 파라미터
  const statusFilter = request.nextUrl.searchParams.get('status')

  let filteredClients = [...CLIENTS]

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
}

// POST: 새 클라이언트 생성 (비활성화 - 코드 수정 필요)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(
    {
      success: false,
      error: '클라이언트 추가는 코드 수정이 필요합니다. 개발자에게 문의하세요.'
    },
    { status: 501 }
  )
}
