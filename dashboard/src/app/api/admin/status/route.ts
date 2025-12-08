/**
 * Admin API - 시스템 상태 조회
 * 테이블: polarad_clients, polarad_meta_data (BAS-Meta와 분리)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 클라이언트 현황
    const { data: clients, error: clientsError } = await getSupabaseAdmin()
      .from(TABLES.CLIENTS)
      .select('id, client_name, is_active, auth_status, service_end_date, token_expires_at, telegram_enabled')

    if (clientsError) {
      throw new Error(`클라이언트 조회 실패: ${clientsError.message}`)
    }

    const activeClients = clients?.filter((c) => c.is_active) || []
    const inactiveClients = clients?.filter((c) => !c.is_active) || []
    const telegramEnabledClients = clients?.filter((c) => c.telegram_enabled) || []

    // 서비스 만료 예정 (7일 이내)
    const today = new Date()
    const sevenDaysLater = new Date(today)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

    const expiringClients = clients?.filter((c) => {
      if (!c.service_end_date) return false
      const endDate = new Date(c.service_end_date)
      return endDate >= today && endDate <= sevenDaysLater
    }) || []

    // 토큰 만료 예정 (7일 이내)
    const tokenExpiringClients = clients?.filter((c) => {
      if (!c.token_expires_at) return false
      const expiresAt = new Date(c.token_expires_at)
      return expiresAt >= today && expiresAt <= sevenDaysLater
    }) || []

    // 인증 필요 클라이언트
    const authRequiredClients = clients?.filter((c) => c.auth_status === 'auth_required') || []

    // 최근 7일 데이터 통계
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    const { count: recentDataCount } = await getSupabaseAdmin()
      .from(TABLES.META_DATA)
      .select('*', { count: 'exact', head: true })
      .gte('date', sevenDaysAgoStr)

    // 클라이언트별 최신 데이터 현황
    const clientDataStatus = await Promise.all(
      (activeClients || []).map(async (client) => {
        const { data: latestData } = await getSupabaseAdmin()
          .from(TABLES.META_DATA)
          .select('date')
          .eq('client_id', client.id)
          .order('date', { ascending: false })
          .limit(1)

        const latestDate = latestData?.[0]?.date || null
        let daysSinceLastData = null

        if (latestDate) {
          const latest = new Date(latestDate)
          daysSinceLastData = Math.floor((today.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24))
        }

        return {
          id: client.id,
          name: client.client_name,
          latestDate,
          daysSinceLastData,
          status: daysSinceLastData === null
            ? 'no_data'
            : daysSinceLastData <= 2
            ? 'ok'
            : daysSinceLastData <= 7
            ? 'warning'
            : 'critical',
        }
      })
    )

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalClients: clients?.length || 0,
        activeClients: activeClients.length,
        inactiveClients: inactiveClients.length,
        telegramEnabled: telegramEnabledClients.length,
      },
      alerts: {
        expiringServices: expiringClients.map((c) => ({
          id: c.id,
          name: c.client_name,
          expiresAt: c.service_end_date,
        })),
        expiringTokens: tokenExpiringClients.map((c) => ({
          id: c.id,
          name: c.client_name,
          expiresAt: c.token_expires_at,
        })),
        authRequired: authRequiredClients.map((c) => ({
          id: c.id,
          name: c.client_name,
        })),
      },
      dataStatus: {
        recentDataCount: recentDataCount || 0,
        clientStatus: clientDataStatus,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('Status API error:', error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
