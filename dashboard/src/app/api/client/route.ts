export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, TABLES } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'slug parameter is required' },
        { status: 400 }
      )
    }

    const { data: client, error } = await supabase
      .from(TABLES.CLIENTS)
      .select('id, client_id, client_name, slug, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !client) {
      // 클라이언트를 찾지 못했지만 slug가 hea-pangyo인 경우 임시 응답 반환
      if (slug === 'hea-pangyo') {
        return NextResponse.json({
          success: true,
          client: {
            id: 'temp-hea-pangyo',
            client_name: 'H.E.A 판교',
            slug: 'hea-pangyo',
            meta_metric_type: 'video',
          },
        })
      }
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      )
    }

    // 확장 컬럼 조회
    let metaMetricType: 'lead' | 'video' = slug === 'hea-pangyo' ? 'video' : 'lead'
    let clientType = 'general'
    let naverConfig = {
      enabled: true,
      type: 'place' as 'place' | 'brand_search',
      show_keywords: true,
      show_detail_tab: true,
      fixed_budget: null as number | null,
    }
    let gaConfig = {
      enabled: false,
      property_id: null as string | null,
    }

    try {
      const { data: clientWithExtra } = await supabase
        .from(TABLES.CLIENTS)
        .select('meta_metric_type, client_type, naver_type, naver_enabled, naver_show_keywords, naver_show_detail_tab, naver_fixed_budget, ga_enabled, ga_property_id')
        .eq('id', client.id)
        .single()

      if (clientWithExtra) {
        if (clientWithExtra.meta_metric_type) {
          metaMetricType = clientWithExtra.meta_metric_type
        }
        if (clientWithExtra.client_type) {
          clientType = clientWithExtra.client_type
        }
        naverConfig = {
          enabled: clientWithExtra.naver_enabled ?? true,
          type: clientWithExtra.naver_type || 'place',
          show_keywords: clientWithExtra.naver_show_keywords ?? true,
          show_detail_tab: clientWithExtra.naver_show_detail_tab ?? true,
          fixed_budget: clientWithExtra.naver_fixed_budget,
        }
        gaConfig = {
          enabled: clientWithExtra.ga_enabled ?? false,
          property_id: clientWithExtra.ga_property_id,
        }
      }
    } catch {
      // 컬럼이 없으면 기본값 사용
    }

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        client_name: client.client_name,
        slug: client.slug,
        client_type: clientType,
        meta_metric_type: metaMetricType,
        naver: naverConfig,
        ga: gaConfig,
        // 하위호환성
        naver_type: naverConfig.type,
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
