/**
 * BAS 리포트 이력 API
 * telegram_reports 테이블에서 저장된 리포트를 조회
 */

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { TABLES } from '@/lib/supabase'

function createNoCacheClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}

export async function GET(request: NextRequest) {
  noStore()

  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug')
    const type = searchParams.get('type') || 'all'
    const limit = parseInt(searchParams.get('limit') || '30', 10)

    if (!clientSlug) {
      return NextResponse.json({ error: 'clientSlug is required' }, { status: 400 })
    }

    const supabase = createNoCacheClient()

    // 클라이언트 ID 조회 (slug → id)
    const { data: client } = await supabase
      .from(TABLES.CLIENTS)
      .select('id, client_name')
      .eq('slug', clientSlug)
      .single()

    // polarad_clients에 없으면 기존 clients 테이블에서 조회
    let clientId: string | null = client?.id || null

    if (!clientId) {
      const { data: legacyClient } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', clientSlug)
        .single()
      clientId = legacyClient?.id || null
    }

    if (!clientId) {
      return NextResponse.json({ reports: [] })
    }

    // telegram_reports에서 직접 조회 (BAS 리포트 저장소)
    let query = supabase
      .from('telegram_reports')
      .select('*')
      .eq('client_id', clientId)
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

    return NextResponse.json(
      { reports: reports || [] },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'CDN-Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
