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

    // meta_metric_type 조회 (컬럼이 없을 수 있으므로 별도 쿼리)
    // 임시: H.E.A 판교(hea-pangyo)는 video 타입으로 설정
    let metaMetricType: 'lead' | 'video' = slug === 'hea-pangyo' ? 'video' : 'lead'

    try {
      const { data: clientWithMetric } = await supabase
        .from(TABLES.CLIENTS)
        .select('meta_metric_type')
        .eq('id', client.id)
        .single()
      if (clientWithMetric?.meta_metric_type) {
        metaMetricType = clientWithMetric.meta_metric_type
      }
    } catch {
      // 컬럼이 없으면 임시 설정 사용
    }

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        client_name: client.client_name,
        slug: client.slug,
        meta_metric_type: metaMetricType,
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
