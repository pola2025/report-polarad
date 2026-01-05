export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, TABLES } from '@/lib/supabase';
import { fetchAirtableData, getClientSlugById } from '@/lib/airtable';
import {
  aggregateToDailyData,
  aggregateToMonthlyData,
} from '@/lib/brand-search-parser';
import type { BrandSearchAPIResponse } from '@/types/brand-search';

/**
 * 브랜드검색 데이터 조회 API (Airtable 캐시 사용)
 *
 * GET /api/naver/brand-search?clientId=xxx&startDate=2025-12-01&endDate=2025-12-31
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 파라미터 검증
    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'clientId is required' } as BrandSearchAPIResponse,
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' } as BrandSearchAPIResponse,
        { status: 400 }
      );
    }

    // 클라이언트 정보 조회 (고정 예산 포함)
    const { data: client, error: clientError } = await supabase
      .from(TABLES.CLIENTS)
      .select('id, slug, naver_fixed_budget')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' } as BrandSearchAPIResponse,
        { status: 404 }
      );
    }

    // Airtable에서 네이버 데이터 조회 (naver_place + naver_brand_search)
    const clientSlug = client.slug || getClientSlugById(clientId);
    if (!clientSlug) {
      return NextResponse.json(
        { success: false, error: 'Airtable config not found' } as BrandSearchAPIResponse,
        { status: 404 }
      );
    }

    // 네이버 플레이스 + 브랜드검색 데이터 조회
    const [placeData, brandSearchData] = await Promise.all([
      fetchAirtableData(clientSlug, startDate, endDate, 'naver_place'),
      fetchAirtableData(clientSlug, startDate, endDate, 'naver_brand_search'),
    ]);

    // 두 소스 합치기
    const rawData = [...placeData, ...brandSearchData];

    // 데이터 변환
    const formattedData = rawData.map(row => ({
      date: row.date,
      device: row.device as 'pc' | 'mobile',
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
    }));

    // 일별 집계
    const daily = aggregateToDailyData(formattedData);

    // 월별 집계
    const monthly = aggregateToMonthlyData(daily);

    // 요약 계산
    const summary = {
      total_impressions: daily.reduce((sum, d) => sum + d.total_impressions, 0),
      total_clicks: daily.reduce((sum, d) => sum + d.total_clicks, 0),
      total_ctr: 0,
      pc_impressions: daily.reduce((sum, d) => sum + d.pc_impressions, 0),
      pc_clicks: daily.reduce((sum, d) => sum + d.pc_clicks, 0),
      mobile_impressions: daily.reduce((sum, d) => sum + d.mobile_impressions, 0),
      mobile_clicks: daily.reduce((sum, d) => sum + d.mobile_clicks, 0),
    };
    summary.total_ctr = summary.total_impressions > 0
      ? Math.round((summary.total_clicks / summary.total_impressions) * 10000) / 100
      : 0;

    // 고정 예산 (기본값: PC 66만, 모바일 66만)
    const totalBudget = client.naver_fixed_budget || 1320000;
    const fixed_budget = {
      pc: Math.floor(totalBudget / 2),
      mobile: Math.floor(totalBudget / 2),
      total: totalBudget,
    };

    const response: BrandSearchAPIResponse = {
      success: true,
      data: {
        daily,
        monthly,
        summary,
        fixed_budget,
      },
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Brand search API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as BrandSearchAPIResponse,
      { status: 500 }
    );
  }
}
