export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { AIRTABLE_CONFIG, getClientIdBySlug } from '@/lib/airtable'

// 클라이언트별 설정 (Supabase 의존성 제거)
const CLIENT_CONFIG: Record<string, {
  client_name: string
  client_type: string
  meta_metric_type: 'lead' | 'video'
  naver: {
    enabled: boolean
    type: 'place' | 'brand_search'
    show_keywords: boolean
    show_detail_tab: boolean
    fixed_budget: number | null
  }
  ga: {
    enabled: boolean
    property_id: string | null
  }
}> = {
  'hea-pangyo': {
    client_name: 'H.E.A 판교',
    client_type: 'restaurant',
    meta_metric_type: 'video',
    naver: {
      enabled: true,
      type: 'place',
      show_keywords: true,
      show_detail_tab: true,
      fixed_budget: null,
    },
    ga: {
      enabled: false,
      property_id: null,
    },
  },
  'naratton': {
    client_name: '나라똔',
    client_type: 'general',
    meta_metric_type: 'lead',
    naver: {
      enabled: true,
      type: 'brand_search',
      show_keywords: true,
      show_detail_tab: true,
      fixed_budget: 1320000,
    },
    ga: {
      enabled: false,
      property_id: null,
    },
  },
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'slug parameter is required' },
        { status: 400 }
      )
    }

    // AIRTABLE_CONFIG에 있는 클라이언트인지 확인
    if (!AIRTABLE_CONFIG[slug]) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      )
    }

    // CLIENT_CONFIG에서 설정 가져오기
    const config = CLIENT_CONFIG[slug]
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Client config not found' },
        { status: 404 }
      )
    }

    // UUID 조회
    const clientId = getClientIdBySlug(slug)

    return NextResponse.json({
      success: true,
      client: {
        id: clientId || slug,
        client_name: config.client_name,
        slug: slug,
        client_type: config.client_type,
        meta_metric_type: config.meta_metric_type,
        naver: config.naver,
        ga: config.ga,
        // 하위호환성
        naver_type: config.naver.type,
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
