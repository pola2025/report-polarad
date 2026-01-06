export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getClientConfig, getAllClients } from '@/lib/airtable'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const listAll = searchParams.get('list') === 'true'

    // 전체 클라이언트 목록 조회
    if (listAll) {
      const clients = await getAllClients()
      return NextResponse.json({
        success: true,
        clients: clients.map(c => ({
          id: c.id,
          client_name: c.client_name,
          slug: c.slug,
          client_type: c.client_type,
          is_active: c.is_active,
          status: c.status,
        })),
      })
    }

    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'slug parameter is required' },
        { status: 400 }
      )
    }

    // DB에서 클라이언트 설정 조회
    const config = await getClientConfig(slug)

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      client: {
        id: config.id,
        client_name: config.client_name,
        slug: config.slug,
        client_type: config.client_type,
        meta_metric_type: config.meta_metric_type,
        naver: {
          enabled: config.naver_enabled,
          type: config.naver_type,
          show_keywords: config.naver_show_keywords,
          show_detail_tab: config.naver_show_detail_tab,
          fixed_budget: config.naver_fixed_budget,
        },
        ga: {
          enabled: config.ga_enabled,
          property_id: config.ga_property_id,
        },
        // 하위호환성
        naver_type: config.naver_type,
        // 추가 정보
        telegram_enabled: config.telegram_enabled,
        service_start_date: config.service_start_date,
        service_end_date: config.service_end_date,
        is_active: config.is_active,
        status: config.status,
      },
    })
  } catch (error) {
    console.error('Client API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
