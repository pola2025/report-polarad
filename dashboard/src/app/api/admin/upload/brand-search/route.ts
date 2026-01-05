export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, TABLES } from '@/lib/supabase';
import { parseBrandSearchCSV } from '@/lib/brand-search-parser';
import type { BrandSearchUploadResponse } from '@/types/brand-search';

/**
 * 브랜드검색 CSV 업로드 API
 *
 * POST /api/admin/upload/brand-search
 * Body: { clientId, csvText } or FormData with file
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();

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

    // 클라이언트 존재 확인
    const { data: client, error: clientError } = await supabase
      .from(TABLES.CLIENTS)
      .select('id, client_name, naver_type')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: 'Client not found', inserted: 0, updated: 0, total: 0, errors: [] } as BrandSearchUploadResponse,
        { status: 404 }
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

    // UPSERT (날짜+디바이스 기준)
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of parsedData) {
      // 기존 데이터 확인
      const { data: existing } = await supabase
        .from('polarad_brand_search_data')
        .select('id')
        .eq('client_id', clientId)
        .eq('date', row.date)
        .eq('device', row.device)
        .single();

      if (existing) {
        // 업데이트
        const { error: updateError } = await supabase
          .from('polarad_brand_search_data')
          .update({
            impressions: row.impressions,
            clicks: row.clicks,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          errors.push(`Update error for ${row.date} ${row.device}: ${updateError.message}`);
        } else {
          updated++;
        }
      } else {
        // 삽입
        const { error: insertError } = await supabase
          .from('polarad_brand_search_data')
          .insert({
            client_id: clientId,
            date: row.date,
            device: row.device,
            impressions: row.impressions,
            clicks: row.clicks,
          });

        if (insertError) {
          errors.push(`Insert error for ${row.date} ${row.device}: ${insertError.message}`);
        } else {
          inserted++;
        }
      }
    }

    const response: BrandSearchUploadResponse = {
      success: errors.length === 0,
      inserted,
      updated,
      total: parsedData.length,
      errors,
    };

    console.log(`Brand search upload: ${client.client_name} - ${inserted} inserted, ${updated} updated`);

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
