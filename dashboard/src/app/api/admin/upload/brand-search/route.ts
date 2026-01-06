export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { parseBrandSearchCSV } from '@/lib/brand-search-parser';
import { AIRTABLE_CONFIG } from '@/lib/airtable';
import type { BrandSearchUploadResponse } from '@/types/brand-search';

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_CLIENTS_BASE_ID = 'appC3XKBcYgZBTETn';
const AIRTABLE_CLIENTS_TABLE_ID = 'tblwQBbsMyg00qi8F';

// Airtable에서 클라이언트 조회 (UUID 또는 slug로)
async function getClientFromAirtable(clientIdOrSlug: string) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_CLIENTS_BASE_ID}/${AIRTABLE_CLIENTS_TABLE_ID}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  });

  const data = await response.json();
  if (data.error) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = data.records.find((r: any) =>
    r.fields.id === clientIdOrSlug || r.fields.slug === clientIdOrSlug
  );

  if (!record) return null;

  return {
    id: record.fields.id || record.id,
    client_name: record.fields.Name,
    slug: record.fields.slug,
    naver_type: record.fields.naver_type,
  };
}

/**
 * 브랜드검색 CSV 업로드 API
 *
 * POST /api/admin/upload/brand-search
 * Body: { clientId, csvText } or FormData with file
 */
export async function POST(request: NextRequest) {
  try {
    // Admin 인증 확인
    const adminKey = request.headers.get('x-admin-key');
    const envAdminKey = process.env.NEXT_PUBLIC_ADMIN_KEY;

    if (!adminKey || adminKey !== envAdminKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as BrandSearchUploadResponse,
        { status: 401 }
      );
    }

    // Request body 파싱
    let clientId: string;
    let csvText: string;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // FormData로 파일 업로드
      const formData = await request.formData();
      clientId = formData.get('clientId') as string;
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file uploaded', inserted: 0, updated: 0, total: 0, errors: [] } as BrandSearchUploadResponse,
          { status: 400 }
        );
      }

      csvText = await file.text();
    } else {
      // JSON body
      const body = await request.json();
      clientId = body.clientId;
      csvText = body.csvText;
    }

    // 파라미터 검증
    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'clientId is required', inserted: 0, updated: 0, total: 0, errors: [] } as BrandSearchUploadResponse,
        { status: 400 }
      );
    }

    if (!csvText) {
      return NextResponse.json(
        { success: false, error: 'CSV content is required', inserted: 0, updated: 0, total: 0, errors: [] } as BrandSearchUploadResponse,
        { status: 400 }
      );
    }

    // Airtable에서 클라이언트 조회
    const client = await getClientFromAirtable(clientId);
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found', inserted: 0, updated: 0, total: 0, errors: [] } as BrandSearchUploadResponse,
        { status: 404 }
      );
    }

    // 클라이언트별 Airtable 설정 확인
    const airtableConfig = AIRTABLE_CONFIG[client.slug];
    if (!airtableConfig) {
      return NextResponse.json(
        { success: false, error: `Airtable config not found for ${client.slug}`, inserted: 0, updated: 0, total: 0, errors: [] } as BrandSearchUploadResponse,
        { status: 400 }
      );
    }

    // CSV 파싱
    const parsedData = parseBrandSearchCSV(csvText, clientId);

    if (parsedData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid data found in CSV', inserted: 0, updated: 0, total: 0, errors: [] } as BrandSearchUploadResponse,
        { status: 400 }
      );
    }

    // Airtable에 저장
    const errors: string[] = [];

    // 날짜 범위 계산
    const dates = parsedData.map(r => r.date).sort();
    const dateRange = { start: dates[0], end: dates[dates.length - 1] };

    // 일별+디바이스별 집계 (Airtable 스키마에 맞게)
    const aggregated = parsedData.reduce((acc, r) => {
      const key = `${r.date}_${r.device}`;
      if (!acc[key]) {
        acc[key] = { date: r.date, device: r.device, impressions: 0, clicks: 0 };
      }
      acc[key].impressions += r.impressions;
      acc[key].clicks += r.clicks;
      return acc;
    }, {} as Record<string, { date: string; device: string; impressions: number; clicks: number }>);

    // Airtable 레코드 준비
    const airtableRecords = Object.values(aggregated).map(data => ({
      fields: {
        date: data.date,
        device: data.device,
        impressions: data.impressions,
        clicks: data.clicks,
        spend: 0, // 브랜드검색은 비용 없음
        source: 'naver_brand_search',
        is_finalized: true,
      }
    }));

    // 1. 해당 날짜 범위의 기존 naver_brand_search 데이터 삭제
    const endDateObj = new Date(dateRange.end);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const nextDay = endDateObj.toISOString().split('T')[0];

    const deleteFormula = `AND({date}>='${dateRange.start}', {date}<'${nextDay}', {source}='naver_brand_search')`;
    const existingUrl = `https://api.airtable.com/v0/${airtableConfig.baseId}/${airtableConfig.tableId}?filterByFormula=${encodeURIComponent(deleteFormula)}`;

    const existingResponse = await fetch(existingUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
      cache: 'no-store',
    });
    const existingData = await existingResponse.json();

    let deleted = 0;
    if (existingData.records?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recordIds = existingData.records.map((r: any) => r.id);
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10);
        const deleteParams = batch.map((id: string) => `records[]=${id}`).join('&');
        await fetch(`https://api.airtable.com/v0/${airtableConfig.baseId}/${airtableConfig.tableId}?${deleteParams}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
        });
        deleted += batch.length;
      }
    }

    // 2. 새 레코드 삽입 (10개씩 배치)
    let inserted = 0;
    for (let i = 0; i < airtableRecords.length; i += 10) {
      const batch = airtableRecords.slice(i, i + 10);
      const insertResponse = await fetch(`https://api.airtable.com/v0/${airtableConfig.baseId}/${airtableConfig.tableId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: batch }),
      });

      const insertResult = await insertResponse.json();
      if (insertResult.error) {
        errors.push(`Airtable insert error: ${insertResult.error.message}`);
      } else {
        inserted += insertResult.records?.length || 0;
      }
    }

    const response: BrandSearchUploadResponse = {
      success: errors.length === 0,
      inserted,
      updated: deleted, // 삭제 후 삽입이므로 updated는 삭제된 수
      total: parsedData.length,
      errors,
    };

    console.log(`Brand search upload: ${client.client_name} - ${inserted} inserted, ${deleted} replaced`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Brand search upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        inserted: 0,
        updated: 0,
        total: 0,
        errors: [],
      } as BrandSearchUploadResponse,
      { status: 500 }
    );
  }
}
