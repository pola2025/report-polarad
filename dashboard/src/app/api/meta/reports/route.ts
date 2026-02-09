/**
 * BAS 리포트 이력 API
 * telegram_reports 테이블에서 저장된 리포트를 조회
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, TABLES } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug')
    const type = searchParams.get('type') || 'all'
    const limit = parseInt(searchParams.get('limit') || '30', 10)

    if (!clientSlug) {
      return NextResponse.json({ error: 'clientSlug is required' }, { status: 400 })
    }

    const supabase = createServerClient()

    // 클라이언트 ID 조회 (slug → id)
    const { data: client } = await supabase
      .from(TABLES.CLIENTS)
      .select('id, client_name')
      .eq('slug', clientSlug)
      .single()

    if (!client) {
      // polarad_clients에 없으면 기존 clients 테이블에서 조회
      const { data: legacyClient } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('slug', clientSlug)
        .single()

      if (!legacyClient) {
        return NextResponse.json({ reports: [] })
      }

      // 기존 telegram_reports 테이블에서 조회
      let query = supabase
        .from('telegram_reports')
        .select('*')
        .eq('client_id', legacyClient.id)
        .order('week_start', { ascending: false })
        .limit(limit)

      if (type !== 'all') {
        query = query.eq('report_type', type)
      }

      const { data: reports, error } = await query

      if (error) {
        console.error('Report fetch error:', error)
        return NextResponse.json({ reports: [] })
      }

      return NextResponse.json({ reports: reports || [] })
    }

    // polarad_reports 테이블에서 조회
    let query = supabase
      .from(TABLES.REPORTS)
      .select('*')
      .eq('client_id', client.id)
      .order('week_start', { ascending: false })
      .limit(limit)

    if (type !== 'all') {
      query = query.eq('report_type', type)
    }

    const { data: reports, error } = await query

    if (error) {
      console.error('Report fetch error:', error)
      // polarad_reports 실패 시 telegram_reports에서 시도
      let fallbackQuery = supabase
        .from('telegram_reports')
        .select('*')
        .eq('client_id', client.id)
        .order('week_start', { ascending: false })
        .limit(limit)

      if (type !== 'all') {
        fallbackQuery = fallbackQuery.eq('report_type', type)
      }

      const { data: fallbackReports } = await fallbackQuery

      return NextResponse.json({ reports: fallbackReports || [] })
    }

    return NextResponse.json({ reports: reports || [] })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
