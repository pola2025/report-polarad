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
  campaign_name?: string;
  keywords?: string;
  is_finalized: boolean;
}

/**
 * Airtable에서 광고 데이터 조회
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

  // 필터 조건
  let formula = `AND({date}>='${startDate}', {date}<='${endDate}')`;
  if (source) {
    formula = `AND({date}>='${startDate}', {date}<='${endDate}', {source}='${source}')`;
  }

  const url = `https://api.airtable.com/v0/${config.baseId}/${config.tableId}?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=date&sort[0][direction]=asc`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      },
      cache: 'no-store',
    });

    const data = await response.json();

    if (data.error) {
      console.error('Airtable error:', data.error);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.records || []).map((record: any) => ({
      date: record.fields.date,
      device: record.fields.device || 'other',
      impressions: record.fields.impressions || 0,
      clicks: record.fields.clicks || 0,
      leads: record.fields.leads || 0,
      spend: record.fields.spend || 0,
      source: record.fields.source || 'meta',
      campaign_name: record.fields.campaign_name || '',
      keywords: record.fields.keywords || '',
      is_finalized: record.fields.is_finalized || false,
    }));
  } catch (error) {
    console.error('Airtable fetch error:', error);
    return [];
  }
}

/**
 * 클라이언트 UUID로 slug 조회
 */
export function getClientSlugById(clientId: string): string | null {
  const CLIENT_MAPPING: Record<string, string> = {
    '3ff2896e-6786-4936-9c57-311f69f43c63': 'hea-pangyo',
    'c2f60730-f8c1-4361-b9fc-3b44725c3955': '나라똔',
  };
  return CLIENT_MAPPING[clientId] || null;
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
