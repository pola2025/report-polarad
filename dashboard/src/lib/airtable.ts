/**
 * Airtable 클라이언트 라이브러리
 *
 * 광고 데이터 및 리포트 데이터 조회용
 */

import type { Report, ReportComment, ReportInsert, ReportUpdate, ReportCommentInsert, ReportCommentUpdate } from '@/types/report';

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!;

// 리포트 테이블 설정
const REPORTS_BASE_ID = process.env.AIRTABLE_REPORTS_BASE_ID || 'appJlOqnadLsMJQYw';
const REPORTS_TABLE_ID = process.env.AIRTABLE_REPORTS_TABLE_ID || 'tbl4BAtILQRH7JQaG';
const COMMENTS_TABLE_ID = process.env.AIRTABLE_COMMENTS_TABLE_ID || 'tbl5u19uUCdPl4TCg';

// 클라이언트 테이블 설정
const CLIENTS_BASE_ID = 'appC3XKBcYgZBTETn';
const CLIENTS_TABLE_ID = 'tblwQBbsMyg00qi8F';

// 클라이언트 설정 타입
export interface ClientConfig {
  id: string;  // UUID
  client_id: string;  // 내부 ID (예: hea-pangyo)
  slug: string;
  client_name: string;
  client_type: 'restaurant' | 'consulting' | 'general';
  meta_metric_type: 'video' | 'lead';
  airtable_base_id: string;
  airtable_table_id: string;
  naver_enabled: boolean;
  naver_type: 'place' | 'brand_search';
  naver_show_keywords: boolean;
  naver_show_detail_tab: boolean;
  naver_fixed_budget: number | null;
  ga_enabled: boolean;
  ga_property_id: string | null;
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  is_active: boolean;
  status: string;
  service_start_date: string | null;
  service_end_date: string | null;
}

// 클라이언트 캐시 (성능 최적화)
let clientsCache: ClientConfig[] | null = null;
let clientsCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 모든 클라이언트 조회 (캐시 지원)
 */
export async function getAllClients(forceRefresh = false): Promise<ClientConfig[]> {
  const now = Date.now();

  // 캐시가 유효하면 캐시 반환
  if (!forceRefresh && clientsCache && (now - clientsCacheTime) < CACHE_TTL) {
    return clientsCache;
  }

  const url = `https://api.airtable.com/v0/${CLIENTS_BASE_ID}/${CLIENTS_TABLE_ID}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  });

  const data = await response.json();
  if (data.error) {
    console.error('getAllClients error:', data.error);
    return clientsCache || [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clients = data.records.map((r: any) => mapAirtableToClientConfig(r));

  // 캐시 업데이트
  clientsCache = clients;
  clientsCacheTime = now;

  return clients;
}

/**
 * 특정 클라이언트 설정 조회 (slug 또는 UUID로)
 */
export async function getClientConfig(slugOrId: string): Promise<ClientConfig | null> {
  const clients = await getAllClients();

  return clients.find(c =>
    c.slug === slugOrId ||
    c.id === slugOrId ||
    c.client_id === slugOrId ||
    c.client_name === slugOrId
  ) || null;
}

/**
 * 활성화된 클라이언트만 조회
 */
export async function getActiveClients(): Promise<ClientConfig[]> {
  const clients = await getAllClients();
  return clients.filter(c => c.is_active && c.status === 'active');
}

/**
 * Airtable 레코드를 ClientConfig로 매핑
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAirtableToClientConfig(record: any): ClientConfig {
  const f = record.fields;
  return {
    id: f.id || record.id,
    client_id: f.client_id || f.slug,
    slug: f.slug,
    client_name: f.Name,
    client_type: f.client_type || 'general',
    meta_metric_type: f.meta_metric_type || 'lead',
    airtable_base_id: f.airtable_base_id || '',
    airtable_table_id: f.airtable_table_id || '',
    naver_enabled: f.naver_enabled || false,
    naver_type: f.naver_type || 'place',
    naver_show_keywords: f.naver_show_keywords ?? true,
    naver_show_detail_tab: f.naver_show_detail_tab ?? true,
    naver_fixed_budget: f.naver_fixed_budget || null,
    ga_enabled: f.ga_enabled || false,
    ga_property_id: f.ga_property_id || null,
    telegram_enabled: f.telegram_enabled || false,
    telegram_chat_id: f.telegram_chat_id || null,
    is_active: f.is_active ?? true,
    status: f.status || 'active',
    service_start_date: f.service_start_date || null,
    service_end_date: f.service_end_date || null,
  };
}

// 하위 호환성을 위한 AIRTABLE_CONFIG (deprecated - getClientConfig 사용 권장)
export const AIRTABLE_CONFIG: Record<string, { baseId: string; tableId: string }> = {
  'hea-pangyo': {
    baseId: process.env.AIRTABLE_HEA_BASE_ID!,
    tableId: process.env.AIRTABLE_HEA_TABLE_ID!,
  },
  'naratton': {
    baseId: process.env.AIRTABLE_NARATTON_BASE_ID!,
    tableId: process.env.AIRTABLE_NARATTON_TABLE_ID!,
  },
  '나라똔': {
    baseId: process.env.AIRTABLE_NARATTON_BASE_ID!,
    tableId: process.env.AIRTABLE_NARATTON_TABLE_ID!,
  },
};

// Airtable 레코드 타입
export interface AirtableAdRecord {
  date: string;
  device: 'pc' | 'mobile' | 'all' | 'other';
  impressions: number;
  clicks: number;
  leads?: number;  // 잠재고객 리드 (Meta API - 빨간색)
  homepage_leads?: number;  // 트래픽 리드 (나라똔 홈페이지 - 녹색)
  spend: number;
  source: 'meta' | 'naver_place' | 'naver_brand_search';
  ad_id?: string;  // Meta 광고 고유 ID (중복 체크용)
  campaign_name?: string;  // 광고명 (캠페인명) 형식으로 저장
  video_views?: number;  // 영상 재생 수
  video_thruplay?: number;  // 영상 완전 시청 수
  avg_watch_time?: number;  // 평균 시청 시간 (초)
  keywords?: string;
  avg_rank?: number;  // 네이버 평균 노출 순위
  avg_cpc?: number;   // 네이버 평균 CPC
  is_finalized: boolean;
}

/**
 * Airtable에서 광고 데이터 조회 (페이지네이션 지원)
 */
export async function fetchAirtableData(
  clientSlug: string,
  startDate: string,
  endDate: string,
  source?: string
): Promise<AirtableAdRecord[]> {
  // DB에서 클라이언트 설정 조회 (새로운 방식)
  const clientConfig = await getClientConfig(clientSlug);

  let baseId: string;
  let tableId: string;

  if (clientConfig && clientConfig.airtable_base_id && clientConfig.airtable_table_id) {
    // DB에서 조회한 설정 사용
    baseId = clientConfig.airtable_base_id;
    tableId = clientConfig.airtable_table_id;
  } else {
    // 하위 호환성: 기존 AIRTABLE_CONFIG 사용
    const legacyConfig = AIRTABLE_CONFIG[clientSlug];
    if (!legacyConfig) {
      console.error(`Airtable config not found for client: ${clientSlug}`);
      return [];
    }
    baseId = legacyConfig.baseId;
    tableId = legacyConfig.tableId;
  }

  // 필터 조건 (endDate 다음날로 < 비교 - Airtable <= 연산자 버그 우회)
  const endDateObj = new Date(endDate);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const nextDay = endDateObj.toISOString().split('T')[0];

  let formula = `AND({date}>='${startDate}', {date}<'${nextDay}')`;
  if (source) {
    formula = `AND({date}>='${startDate}', {date}<'${nextDay}', {source}='${source}')`;
  }

  const allRecords: AirtableAdRecord[] = [];
  let offset: string | undefined;

  try {
    // 페이지네이션 루프 (Airtable은 한 번에 최대 100개 반환)
    do {
      let url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=date&sort[0][direction]=asc`;
      if (offset) {
        url += `&offset=${offset}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        },
        cache: 'no-store',
      });

      const data = await response.json();

      if (data.error) {
        console.error('Airtable error:', data.error);
        return allRecords;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = (data.records || []).map((record: any) => ({
        date: record.fields.date,
        device: record.fields.device || 'other',
        impressions: record.fields.impressions || 0,
        clicks: record.fields.clicks || 0,
        leads: record.fields.leads || 0,
        homepage_leads: record.fields.homepage_leads || 0,
        spend: record.fields.spend || 0,
        source: record.fields.source || 'meta',
        ad_id: record.fields.ad_id || '',
        campaign_name: record.fields.campaign_name || '',
        video_views: record.fields.video_views || 0,
        video_thruplay: record.fields.video_thruplay || 0,
        avg_watch_time: record.fields.avg_watch_time || 0,
        keywords: record.fields.keywords || '',
        avg_rank: record.fields.avg_rank || 0,
        avg_cpc: record.fields.avg_cpc || 0,
        is_finalized: record.fields.is_finalized || false,
      }));

      allRecords.push(...records);
      offset = data.offset; // 다음 페이지가 있으면 offset 값이 존재
    } while (offset);

    return allRecords;
  } catch (error) {
    console.error('Airtable fetch error:', error);
    return allRecords;
  }
}

/**
 * 클라이언트 UUID 또는 slug로 slug 조회
 * - UUID 입력 시: slug 반환
 * - slug 입력 시: 그대로 반환 (AIRTABLE_CONFIG에 있는 경우)
 */
export function getClientSlugById(clientId: string): string | null {
  // UUID, 한글 이름, slug → slug 매핑
  const CLIENT_ID_TO_SLUG: Record<string, string> = {
    // UUID
    '3ff2896e-6786-4936-9c57-311f69f43c63': 'hea-pangyo',
    'c2f60730-f8c1-4361-b9fc-3b44725c3955': 'naratton',
    // 한글 클라이언트 ID (Airtable Reports에서 사용)
    'h-e-a-판교': 'hea-pangyo',
    'H.E.A 판교': 'hea-pangyo',
    '나라똔': 'naratton',
  };

  // 1. 매핑 테이블에서 찾기
  if (CLIENT_ID_TO_SLUG[clientId]) {
    return CLIENT_ID_TO_SLUG[clientId];
  }

  // 2. slug로 직접 사용 가능한지 확인
  if (AIRTABLE_CONFIG[clientId]) {
    return clientId;
  }

  return null;
}

/**
 * 클라이언트 slug로 UUID 조회 (Supabase 키워드 통계 등에서 사용)
 */
export function getClientIdBySlug(slug: string): string | null {
  const SLUG_TO_UUID: Record<string, string> = {
    'hea-pangyo': '3ff2896e-6786-4936-9c57-311f69f43c63',
    'naratton': 'c2f60730-f8c1-4361-b9fc-3b44725c3955',
    '나라똔': 'c2f60730-f8c1-4361-b9fc-3b44725c3955',
  };
  return SLUG_TO_UUID[slug] || null;
}

/**
 * 소스별 데이터 집계
 */
export function aggregateBySource(records: AirtableAdRecord[]) {
  const meta = records.filter(r => r.source === 'meta');
  const naverPlace = records.filter(r => r.source === 'naver_place');
  const naverBrandSearch = records.filter(r => r.source === 'naver_brand_search');

  const aggregate = (items: AirtableAdRecord[]) => ({
    impressions: items.reduce((sum, r) => sum + r.impressions, 0),
    clicks: items.reduce((sum, r) => sum + r.clicks, 0),
    leads: items.reduce((sum, r) => sum + (r.leads || 0), 0),
    spend: items.reduce((sum, r) => sum + r.spend, 0),
  });

  return {
    meta: aggregate(meta),
    naver_place: aggregate(naverPlace),
    naver_brand_search: aggregate(naverBrandSearch),
    naver_total: aggregate([...naverPlace, ...naverBrandSearch]),
  };
}

/**
 * 일별 트렌드 데이터 생성
 */
export function createDailyTrend(
  records: AirtableAdRecord[],
  startDate: string,
  endDate: string
) {
  // 날짜별 맵 생성
  const dailyMap = new Map<string, {
    meta_impressions: number;
    meta_clicks: number;
    meta_leads: number;
    meta_spend: number;
    naver_impressions: number;
    naver_clicks: number;
    naver_spend: number;
  }>();

  records.forEach(record => {
    const existing = dailyMap.get(record.date) || {
      meta_impressions: 0,
      meta_clicks: 0,
      meta_leads: 0,
      meta_spend: 0,
      naver_impressions: 0,
      naver_clicks: 0,
      naver_spend: 0,
    };

    if (record.source === 'meta') {
      existing.meta_impressions += record.impressions;
      existing.meta_clicks += record.clicks;
      existing.meta_leads += record.leads || 0;
      existing.meta_spend += record.spend;
    } else {
      existing.naver_impressions += record.impressions;
      existing.naver_clicks += record.clicks;
      existing.naver_spend += record.spend;
    }

    dailyMap.set(record.date, existing);
  });

  // 날짜 범위에 맞게 배열 생성
  const trend: Array<{
    date: string;
    meta_impressions: number;
    meta_clicks: number;
    meta_leads: number;
    meta_spend: number;
    naver_impressions: number;
    naver_clicks: number;
    naver_spend: number;
    total_impressions: number;
    total_clicks: number;
    total_spend: number;
  }> = [];

  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const data = dailyMap.get(dateStr) || {
      meta_impressions: 0,
      meta_clicks: 0,
      meta_leads: 0,
      meta_spend: 0,
      naver_impressions: 0,
      naver_clicks: 0,
      naver_spend: 0,
    };

    trend.push({
      date: dateStr,
      ...data,
      total_impressions: data.meta_impressions + data.naver_impressions,
      total_clicks: data.meta_clicks + data.naver_clicks,
      total_spend: data.meta_spend + data.naver_spend,
    });

    current.setDate(current.getDate() + 1);
  }

  return trend;
}

// ============================================================
// 리포트 관련 함수
// ============================================================

/**
 * 클라이언트 정보 조회 (UUID 또는 slug로)
 */
export async function getAirtableClient(clientIdOrSlug: string) {
  const url = `https://api.airtable.com/v0/${CLIENTS_BASE_ID}/${CLIENTS_TABLE_ID}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  });

  const data = await response.json();
  if (data.error) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = data.records.find((r: any) =>
    r.fields.id === clientIdOrSlug ||
    r.fields.slug === clientIdOrSlug ||
    r.fields.Name === clientIdOrSlug  // 한글 이름으로도 조회 가능
  );

  if (!record) return null;

  return {
    id: record.fields.id || record.id,
    client_name: record.fields.Name,
    slug: record.fields.slug,
  };
}

/**
 * 리포트 조회 (ID로)
 */
export async function getReport(reportId: string): Promise<Report | null> {
  const formula = `{id}='${reportId}'`;
  const url = `https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  });

  const data = await response.json();
  if (data.error || !data.records?.length) return null;

  const record = data.records[0];
  return mapAirtableToReport(record);
}

/**
 * 리포트 목록 조회
 */
export async function getReports(options?: {
  clientId?: string;
  clientSlug?: string;
  reportType?: 'monthly' | 'weekly';
  status?: 'draft' | 'published' | 'archived';
  year?: number;
  month?: number;
}): Promise<Report[]> {
  const conditions: string[] = [];

  if (options?.clientId) {
    conditions.push(`{client_id}='${options.clientId}'`);
  }
  if (options?.clientSlug) {
    conditions.push(`{client_slug}='${options.clientSlug}'`);
  }
  if (options?.reportType) {
    conditions.push(`{report_type}='${options.reportType}'`);
  }
  if (options?.status) {
    conditions.push(`{status}='${options.status}'`);
  }
  if (options?.year) {
    conditions.push(`{year}=${options.year}`);
  }
  if (options?.month) {
    conditions.push(`{month}=${options.month}`);
  }

  const formula = conditions.length > 0 ? `AND(${conditions.join(', ')})` : '';
  let url = `https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}?sort[0][field]=created_at&sort[0][direction]=desc`;

  if (formula) {
    url += `&filterByFormula=${encodeURIComponent(formula)}`;
  }

  const allRecords: Report[] = [];
  let offset: string | undefined;

  do {
    const fetchUrl = offset ? `${url}&offset=${offset}` : url;
    const response = await fetch(fetchUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
      cache: 'no-store',
    });

    const data = await response.json();
    if (data.error) break;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records = (data.records || []).map((r: any) => mapAirtableToReport(r));
    allRecords.push(...records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

/**
 * 리포트 생성
 */
export async function createReport(report: ReportInsert): Promise<Report | null> {
  const id = report.id || crypto.randomUUID();

  const fields = {
    id,
    client_id: report.client_id,
    client_slug: getClientSlugById(report.client_id) || '',
    report_type: report.report_type,
    period_start: report.period_start,
    period_end: report.period_end,
    year: report.year,
    month: report.month || null,
    week: report.week || null,
    status: report.status || 'draft',
    published_at: report.published_at || null,
    summary_data: report.summary_data ? JSON.stringify(report.summary_data) : null,
    ai_insights: report.ai_insights ? JSON.stringify(report.ai_insights) : null,
    ai_generated_at: report.ai_generated_at || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: report.created_by || null,
  };

  const response = await fetch(`https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  const data = await response.json();
  if (data.error || !data.records?.length) {
    console.error('Create report error:', data.error);
    return null;
  }

  return mapAirtableToReport(data.records[0]);
}

/**
 * 리포트 업데이트
 */
export async function updateReport(reportId: string, update: ReportUpdate): Promise<Report | null> {
  // 먼저 Airtable 레코드 ID 조회
  const formula = `{id}='${reportId}'`;
  const searchUrl = `https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;

  const searchResponse = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  });

  const searchData = await searchResponse.json();
  if (searchData.error || !searchData.records?.length) return null;

  const airtableRecordId = searchData.records[0].id;

  // 업데이트할 필드 구성
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (update.status !== undefined) fields.status = update.status;
  if (update.published_at !== undefined) fields.published_at = update.published_at;
  if (update.summary_data !== undefined) fields.summary_data = update.summary_data ? JSON.stringify(update.summary_data) : null;
  if (update.ai_insights !== undefined) fields.ai_insights = update.ai_insights ? JSON.stringify(update.ai_insights) : null;
  if (update.ai_generated_at !== undefined) fields.ai_generated_at = update.ai_generated_at;
  if (update.period_start !== undefined) fields.period_start = update.period_start;
  if (update.period_end !== undefined) fields.period_end = update.period_end;
  if (update.year !== undefined) fields.year = update.year;
  if (update.month !== undefined) fields.month = update.month;
  if (update.week !== undefined) fields.week = update.week;

  const response = await fetch(`https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}/${airtableRecordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await response.json();
  if (data.error) {
    console.error('Update report error:', data.error);
    return null;
  }

  return mapAirtableToReport(data);
}

/**
 * 리포트 삭제
 */
export async function deleteReport(reportId: string): Promise<boolean> {
  // 먼저 Airtable 레코드 ID 조회
  const formula = `{id}='${reportId}'`;
  const searchUrl = `https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;

  const searchResponse = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  });

  const searchData = await searchResponse.json();
  if (searchData.error || !searchData.records?.length) return false;

  const airtableRecordId = searchData.records[0].id;

  const response = await fetch(`https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}/${airtableRecordId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  });

  const data = await response.json();
  return !data.error && data.deleted;
}

// ============================================================
// 코멘트 관련 함수
// ============================================================

/**
 * 리포트 코멘트 조회
 */
export async function getReportComment(reportId: string): Promise<ReportComment | null> {
  const formula = `{report_id}='${reportId}'`;
  const url = `https://api.airtable.com/v0/${REPORTS_BASE_ID}/${COMMENTS_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  });

  const data = await response.json();
  if (data.error || !data.records?.length) return null;

  const record = data.records[0];
  return mapAirtableToComment(record);
}

/**
 * 코멘트 생성
 */
export async function createReportComment(comment: ReportCommentInsert): Promise<ReportComment | null> {
  const id = comment.id || crypto.randomUUID();

  const fields = {
    id,
    report_id: comment.report_id,
    content: comment.content,
    content_html: comment.content_html || null,
    author_name: comment.author_name || 'Admin',
    author_role: comment.author_role || null,
    is_visible: comment.is_visible ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(`https://api.airtable.com/v0/${REPORTS_BASE_ID}/${COMMENTS_TABLE_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  const data = await response.json();
  if (data.error || !data.records?.length) {
    console.error('Create comment error:', data.error);
    return null;
  }

  return mapAirtableToComment(data.records[0]);
}

/**
 * 코멘트 업데이트
 */
export async function updateReportComment(commentId: string, update: ReportCommentUpdate): Promise<ReportComment | null> {
  // 먼저 Airtable 레코드 ID 조회
  const formula = `{id}='${commentId}'`;
  const searchUrl = `https://api.airtable.com/v0/${REPORTS_BASE_ID}/${COMMENTS_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;

  const searchResponse = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  });

  const searchData = await searchResponse.json();
  if (searchData.error || !searchData.records?.length) return null;

  const airtableRecordId = searchData.records[0].id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (update.content !== undefined) fields.content = update.content;
  if (update.content_html !== undefined) fields.content_html = update.content_html;
  if (update.author_name !== undefined) fields.author_name = update.author_name;
  if (update.author_role !== undefined) fields.author_role = update.author_role;
  if (update.is_visible !== undefined) fields.is_visible = update.is_visible;

  const response = await fetch(`https://api.airtable.com/v0/${REPORTS_BASE_ID}/${COMMENTS_TABLE_ID}/${airtableRecordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await response.json();
  if (data.error) {
    console.error('Update comment error:', data.error);
    return null;
  }

  return mapAirtableToComment(data);
}

// ============================================================
// 매핑 헬퍼 함수
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAirtableToReport(record: any): Report {
  const f = record.fields;
  return {
    id: f.id,
    client_id: f.client_id,
    report_type: f.report_type,
    period_start: f.period_start,
    period_end: f.period_end,
    year: f.year,
    month: f.month || null,
    week: f.week || null,
    status: f.status || 'draft',
    published_at: f.published_at || null,
    summary_data: f.summary_data ? JSON.parse(f.summary_data) : null,
    ai_insights: f.ai_insights ? JSON.parse(f.ai_insights) : null,
    ai_generated_at: f.ai_generated_at || null,
    created_at: f.created_at,
    updated_at: f.updated_at,
    created_by: f.created_by || null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAirtableToComment(record: any): ReportComment {
  const f = record.fields;
  return {
    id: f.id,
    report_id: f.report_id,
    content: f.content,
    content_html: f.content_html || null,
    author_name: f.author_name || 'Unknown',
    author_role: f.author_role || null,
    is_visible: f.is_visible || false,
    created_at: f.created_at,
    updated_at: f.updated_at,
  };
}

// ============================================================
// 나라똔 리드 데이터 조회
// ============================================================

const NARATTON_LEADS_TABLE_ID = process.env.AIRTABLE_NARATTON_LEADS_TABLE_ID || 'tblmOcJ5eRYJdrAzT';
const NARATTON_BASE_ID = process.env.AIRTABLE_NARATTON_BASE_ID || 'appN2KzUoORRrb8X9';

export interface NarattonLead {
  id: string;
  신청일: string;
  이름: string;
  연락처: string;
  이메일: string;
  회사명: string;
  상담유형: string;
  상담분야: string;
  지역: string;
  연매출: string;
  직원수: string;
  메시지: string;
  mongodb_id: string;
  동기화일시: string;
}

/**
 * 나라똔 리드 데이터 조회 (기간별)
 */
export async function fetchNarattonLeads(
  startDate: string,
  endDate: string
): Promise<NarattonLead[]> {
  const allRecords: NarattonLead[] = [];
  let offset = '';

  // endDate + 1일 (inclusive)
  const endDateObj = new Date(endDate);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDatePlusOne = endDateObj.toISOString().split('T')[0];

  do {
    const formula = encodeURIComponent(
      `AND({신청일}>='${startDate}', {신청일}<'${endDatePlusOne}')`
    );
    let url = `https://api.airtable.com/v0/${NARATTON_BASE_ID}/${NARATTON_LEADS_TABLE_ID}?filterByFormula=${formula}&sort[0][field]=신청일&sort[0][direction]=desc`;
    if (offset) url += `&offset=${offset}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
      cache: 'no-store',
    });

    const data = await response.json();
    if (data.error) break;

    for (const record of data.records || []) {
      const f = record.fields;
      allRecords.push({
        id: record.id,
        신청일: f.신청일 || '',
        이름: f.이름 || '',
        연락처: f.연락처 || '',
        이메일: f.이메일 || '',
        회사명: f.회사명 || '',
        상담유형: f.상담유형 || '',
        상담분야: f.상담분야 || '',
        지역: f.지역 || '',
        연매출: f.연매출 || '',
        직원수: f.직원수 || '',
        메시지: f.메시지 || '',
        mongodb_id: f.mongodb_id || '',
        동기화일시: f.동기화일시 || '',
      });
    }

    offset = data.offset || '';
  } while (offset);

  return allRecords;
}

/**
 * 나라똔 리드 수 집계 (기간별)
 */
export async function countNarattonLeads(
  startDate: string,
  endDate: string
): Promise<number> {
  const leads = await fetchNarattonLeads(startDate, endDate);
  return leads.length;
}
