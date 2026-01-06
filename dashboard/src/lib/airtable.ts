/**
 * Airtable 클라이언트 라이브러리
 *
 * 광고 데이터 캐시 조회용
 */

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!;

// 클라이언트별 Airtable 설정
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
  leads?: number;  // 나라똔만 (H.E.A 판교는 식당이라 없음)
  spend: number;
  source: 'meta' | 'naver_place' | 'naver_brand_search';
  ad_id?: string;  // Meta 광고 고유 ID (중복 체크용)
  campaign_name?: string;  // 광고명 (캠페인명) 형식으로 저장
  keywords?: string;
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
  const config = AIRTABLE_CONFIG[clientSlug];

  if (!config) {
    console.error(`Airtable config not found for client: ${clientSlug}`);
    return [];
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
      let url = `https://api.airtable.com/v0/${config.baseId}/${config.tableId}?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=date&sort[0][direction]=asc`;
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
        spend: record.fields.spend || 0,
        source: record.fields.source || 'meta',
        ad_id: record.fields.ad_id || '',
        campaign_name: record.fields.campaign_name || '',
        keywords: record.fields.keywords || '',
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
  const UUID_TO_SLUG: Record<string, string> = {
    '3ff2896e-6786-4936-9c57-311f69f43c63': 'hea-pangyo',
    'c2f60730-f8c1-4361-b9fc-3b44725c3955': 'naratton',
  };

  // 1. UUID로 매핑 시도
  if (UUID_TO_SLUG[clientId]) {
    return UUID_TO_SLUG[clientId];
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
