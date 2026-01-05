/**
 * 브랜드검색 CSV 파서 테스트
 *
 * 실행: npx ts-node scripts/test-brand-search-parser.ts
 */

import {
  parseDateString,
  extractDevice,
  parseNumber,
  calculateCTR,
  parseBrandSearchCSV,
  aggregateToDailyData,
  aggregateToMonthlyData,
} from '../src/lib/brand-search-parser';

// 테스트 헬퍼
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ FAIL: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`❌ FAIL: ${message}\n   Expected: ${expected}\n   Actual: ${actual}`);
  }
  console.log(`✅ PASS: ${message}`);
}

// 테스트 케이스
console.log('\n=== parseDateString 테스트 ===\n');

assertEqual(parseDateString('2025.12.03.'), '2025-12-03', '날짜 형식 변환 (마침표 포함)');
assertEqual(parseDateString('2025.1.3.'), '2025-01-03', '날짜 형식 변환 (한 자리 월/일)');
assertEqual(parseDateString('2025-12-03'), '2025-12-03', '날짜 형식 변환 (이미 변환된 형식)');

console.log('\n=== extractDevice 테스트 ===\n');

assertEqual(extractDevice('브랜드검색광고_PC'), 'pc', 'PC 디바이스 추출');
assertEqual(extractDevice('브랜드검색광고_모바일'), 'mobile', '모바일 디바이스 추출');
assertEqual(extractDevice('Brand_PC'), 'pc', 'PC 디바이스 추출 (영문)');
assertEqual(extractDevice('Brand_Mobile'), 'mobile', '모바일 디바이스 추출 (영문)');

console.log('\n=== parseNumber 테스트 ===\n');

assertEqual(parseNumber('100'), 100, '숫자 파싱 (정수)');
assertEqual(parseNumber('1,234'), 1234, '숫자 파싱 (콤마 포함)');
assertEqual(parseNumber('0'), 0, '숫자 파싱 (0)');
assertEqual(parseNumber(''), 0, '숫자 파싱 (빈 문자열)');
assertEqual(parseNumber('abc'), 0, '숫자 파싱 (비숫자)');

console.log('\n=== calculateCTR 테스트 ===\n');

assertEqual(calculateCTR(100, 1000), 10, 'CTR 계산 (10%)');
assertEqual(calculateCTR(0, 1000), 0, 'CTR 계산 (0 클릭)');
assertEqual(calculateCTR(100, 0), 0, 'CTR 계산 (0 노출)');
assertEqual(calculateCTR(57, 80), 71.25, 'CTR 계산 (소수점)');

console.log('\n=== parseBrandSearchCSV 테스트 ===\n');

const testCSV = `캠페인,일별,광고그룹,노출수,클릭수
브랜드검색광고,2025.12.03.,브랜드검색광고_PC,49,31
브랜드검색광고,2025.12.03.,브랜드검색광고_모바일,80,57
브랜드검색광고,2025.12.04.,브랜드검색광고_PC,52,28
브랜드검색광고,2025.12.04.,브랜드검색광고_모바일,75,50`;

const testClientId = 'test-client-uuid';
const parsedData = parseBrandSearchCSV(testCSV, testClientId);

assertEqual(parsedData.length, 4, 'CSV 파싱 결과 개수');
assertEqual(parsedData[0].date, '2025-12-03', '첫 번째 행 날짜');
assertEqual(parsedData[0].device, 'pc', '첫 번째 행 디바이스');
assertEqual(parsedData[0].impressions, 49, '첫 번째 행 노출수');
assertEqual(parsedData[0].clicks, 31, '첫 번째 행 클릭수');
assertEqual(parsedData[1].device, 'mobile', '두 번째 행 디바이스');

console.log('\n=== aggregateToDailyData 테스트 ===\n');

const dailyData = aggregateToDailyData(parsedData);

assertEqual(dailyData.length, 2, '일별 집계 결과 개수');
// 최신순 정렬이므로 12-04가 먼저
assertEqual(dailyData[0].date, '2025-12-04', '최신 날짜');
assertEqual(dailyData[0].pc_impressions, 52, '12/04 PC 노출');
assertEqual(dailyData[0].mobile_impressions, 75, '12/04 모바일 노출');
assertEqual(dailyData[0].total_impressions, 127, '12/04 총 노출');
assertEqual(dailyData[0].pc_clicks, 28, '12/04 PC 클릭');
assertEqual(dailyData[0].mobile_clicks, 50, '12/04 모바일 클릭');
assertEqual(dailyData[0].total_clicks, 78, '12/04 총 클릭');

console.log('\n=== aggregateToMonthlyData 테스트 ===\n');

const monthlyData = aggregateToMonthlyData(dailyData);

assertEqual(monthlyData.length, 1, '월별 집계 결과 개수');
assertEqual(monthlyData[0].month, '2025-12', '월');
assertEqual(monthlyData[0].month_label, '2025년 12월', '월 라벨');
assertEqual(monthlyData[0].total_impressions, 256, '12월 총 노출 (49+80+52+75)');
assertEqual(monthlyData[0].total_clicks, 166, '12월 총 클릭 (31+57+28+50)');
assertEqual(monthlyData[0].days.length, 2, '12월 일별 데이터 개수');

console.log('\n=== 빈 CSV 테스트 ===\n');

const emptyParsed = parseBrandSearchCSV('', testClientId);
assertEqual(emptyParsed.length, 0, '빈 CSV 파싱');

const headerOnlyCSV = `캠페인,일별,광고그룹,노출수,클릭수`;
const headerOnlyParsed = parseBrandSearchCSV(headerOnlyCSV, testClientId);
assertEqual(headerOnlyParsed.length, 0, '헤더만 있는 CSV 파싱');

console.log('\n=== 모든 테스트 통과! ===\n');
