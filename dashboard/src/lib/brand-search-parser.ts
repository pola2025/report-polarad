/**
 * 브랜드검색 CSV 파서
 *
 * 네이버 광고 내보내기 CSV 형식 파싱
 * 입력: "캠페인,일별,광고그룹,노출수,클릭수"
 * 출력: BrandSearchInsertData[]
 */

import type { BrandSearchInsertData, BrandSearchDailyData, BrandSearchMonthlyData } from '@/types/brand-search';

/**
 * 날짜 형식 변환
 * '2025.12.03.' → '2025-12-03'
 */
export function parseDateString(dateStr: string): string {
  // '2025.12.03.' 형식 처리
  const cleaned = dateStr.replace(/\./g, '-').replace(/-$/, '');
  // '2025-12-03' 형식으로 변환
  const match = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * 광고그룹에서 디바이스 추출
 * '브랜드검색광고_PC' → 'pc'
 * '브랜드검색광고_모바일' → 'mobile'
 */
export function extractDevice(adGroup: string): 'pc' | 'mobile' {
  const upper = adGroup.toUpperCase();
  if (upper.includes('PC')) return 'pc';
  if (upper.includes('모바일') || upper.includes('MOBILE')) return 'mobile';
  throw new Error(`Unknown device type in ad group: ${adGroup}`);
}

/**
 * 숫자 파싱 (콤마 제거)
 */
export function parseNumber(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * CTR 계산
 */
export function calculateCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return Math.round((clicks / impressions) * 10000) / 100; // 소수점 2자리
}

/**
 * CSV 텍스트 파싱
 */
export function parseBrandSearchCSV(csvText: string, clientId: string): BrandSearchInsertData[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return []; // 헤더만 있거나 빈 파일
  }

  const results: BrandSearchInsertData[] = [];
  const errors: string[] = [];

  // 헤더 확인 (첫 줄 스킵)
  const header = lines[0].toLowerCase();
  if (!header.includes('캠페인') && !header.includes('campaign')) {
    // 헤더가 없으면 첫 줄도 데이터로 처리
    lines.unshift(''); // 빈 헤더 추가
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSV 파싱 (간단한 콤마 분리)
    const cols = line.split(',').map(col => col.trim());
    if (cols.length < 5) {
      errors.push(`Line ${i + 1}: Invalid column count`);
      continue;
    }

    try {
      const [, dateStr, adGroup, impressionsStr, clicksStr] = cols;

      const date = parseDateString(dateStr);
      const device = extractDevice(adGroup);
      const impressions = parseNumber(impressionsStr);
      const clicks = parseNumber(clicksStr);

      results.push({
        client_id: clientId,
        date,
        device,
        impressions,
        clicks,
      });
    } catch (err) {
      errors.push(`Line ${i + 1}: ${err instanceof Error ? err.message : 'Parse error'}`);
    }
  }

  if (errors.length > 0) {
    console.warn('CSV parsing warnings:', errors);
  }

  return results;
}

/**
 * 일별 데이터를 PC/모바일 합산하여 DailyData로 변환
 */
export function aggregateToDailyData(rows: { date: string; device: 'pc' | 'mobile'; impressions: number; clicks: number }[]): BrandSearchDailyData[] {
  const byDate = new Map<string, BrandSearchDailyData>();

  for (const row of rows) {
    let daily = byDate.get(row.date);
    if (!daily) {
      daily = {
        date: row.date,
        pc_impressions: 0,
        pc_clicks: 0,
        mobile_impressions: 0,
        mobile_clicks: 0,
        total_impressions: 0,
        total_clicks: 0,
        ctr: 0,
      };
      byDate.set(row.date, daily);
    }

    if (row.device === 'pc') {
      daily.pc_impressions += row.impressions;
      daily.pc_clicks += row.clicks;
    } else {
      daily.mobile_impressions += row.impressions;
      daily.mobile_clicks += row.clicks;
    }
  }

  // 합계 및 CTR 계산
  const dailyValues = Array.from(byDate.values());
  for (const daily of dailyValues) {
    daily.total_impressions = daily.pc_impressions + daily.mobile_impressions;
    daily.total_clicks = daily.pc_clicks + daily.mobile_clicks;
    daily.ctr = calculateCTR(daily.total_clicks, daily.total_impressions);
  }

  // 날짜순 정렬 (오름차순 - 차트용)
  return dailyValues.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 일별 데이터를 월별로 집계
 */
export function aggregateToMonthlyData(dailyData: BrandSearchDailyData[]): BrandSearchMonthlyData[] {
  const byMonth = new Map<string, BrandSearchMonthlyData>();

  for (const daily of dailyData) {
    const month = daily.date.substring(0, 7); // 'YYYY-MM'

    let monthly = byMonth.get(month);
    if (!monthly) {
      const [year, m] = month.split('-');
      monthly = {
        month,
        month_label: `${year}년 ${parseInt(m)}월`,
        pc_impressions: 0,
        pc_clicks: 0,
        mobile_impressions: 0,
        mobile_clicks: 0,
        total_impressions: 0,
        total_clicks: 0,
        total_ctr: 0,
        days: [],
      };
      byMonth.set(month, monthly);
    }

    monthly.pc_impressions += daily.pc_impressions;
    monthly.pc_clicks += daily.pc_clicks;
    monthly.mobile_impressions += daily.mobile_impressions;
    monthly.mobile_clicks += daily.mobile_clicks;
    monthly.days.push(daily);
  }

  // 합계 및 CTR 계산
  const monthlyValues = Array.from(byMonth.values());
  for (const monthly of monthlyValues) {
    monthly.total_impressions = monthly.pc_impressions + monthly.mobile_impressions;
    monthly.total_clicks = monthly.pc_clicks + monthly.mobile_clicks;
    monthly.total_ctr = calculateCTR(monthly.total_clicks, monthly.total_impressions);
    // 일별 데이터 최신순 정렬
    monthly.days.sort((a: BrandSearchDailyData, b: BrandSearchDailyData) => b.date.localeCompare(a.date));
  }

  // 월 최신순 정렬
  return monthlyValues.sort((a: BrandSearchMonthlyData, b: BrandSearchMonthlyData) => b.month.localeCompare(a.month));
}
