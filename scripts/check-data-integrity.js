#!/usr/bin/env node
/**
 * 데이터 정합성 점검 스크립트
 *
 * 주의: Supabase 기본 limit은 1000건이므로 count 쿼리 사용
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HEA_UUID = '3ff2896e-6786-4936-9c57-311f69f43c63';
const HEA_CLIENT_ID = 'h-e-a-판교';

/**
 * 월별 데이터 개수 조회 (limit 문제 없음)
 */
async function getMonthlyCount(table, clientId, year, month, excludeTotal = false) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  let query = supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Naver 테이블만 _total_ 제외
  if (excludeTotal) {
    query = query.neq('keyword', '_total_');
  }

  const { count } = await query;
  return count || 0;
}

/**
 * 날짜 범위 조회 (min/max)
 */
async function getDateRange(table, clientId) {
  // 최초 날짜
  const { data: minData } = await supabase
    .from(table)
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: true })
    .limit(1);

  // 최신 날짜
  const { data: maxData } = await supabase
    .from(table)
    .select('date')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
    .limit(1);

  return {
    min: minData?.[0]?.date || null,
    max: maxData?.[0]?.date || null,
  };
}

/**
 * 특정 기간 unique 날짜 목록 조회
 */
async function getUniqueDates(table, clientId, startDate, endDate) {
  // 날짜별로 1건씩만 조회 (group by 효과)
  const allDates = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];

    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('date', dateStr)
      .neq('keyword', '_total_');

    if (count > 0) {
      allDates.push(dateStr);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return allDates;
}

async function main() {
  console.log('📊 데이터 정합성 점검 시작\n');
  console.log('='.repeat(60));

  // 1. 주간 리포트 목록 확인
  console.log('\n📋 1. 주간 리포트 목록');
  console.log('-'.repeat(40));

  const { data: weeklyReports, error: reportError } = await supabase
    .from('polarad_reports')
    .select('id, period_start, period_end, year, month, week, status, ai_generated_at')
    .eq('report_type', 'weekly')
    .order('period_start', { ascending: false });

  if (reportError) {
    console.error('❌ 리포트 조회 실패:', reportError.message);
  } else {
    console.log(`총 ${weeklyReports.length}개 주간 리포트`);
    weeklyReports.forEach(r => {
      const aiStatus = r.ai_generated_at ? '✅ AI' : '❌ No AI';
      console.log(`  ${r.year}-${String(r.month).padStart(2,'0')} ${r.week}주차 | ${r.period_start} ~ ${r.period_end} | ${aiStatus}`);
    });
  }

  // 2. 월간 리포트 목록 확인
  console.log('\n📋 2. 월간 리포트 목록');
  console.log('-'.repeat(40));

  const { data: monthlyReports } = await supabase
    .from('polarad_reports')
    .select('id, period_start, period_end, year, month, status, ai_generated_at')
    .eq('report_type', 'monthly')
    .order('period_start', { ascending: false });

  if (monthlyReports) {
    console.log(`총 ${monthlyReports.length}개 월간 리포트`);
    monthlyReports.forEach(r => {
      const aiStatus = r.ai_generated_at ? '✅ AI' : '❌ No AI';
      console.log(`  ${r.year}-${String(r.month).padStart(2,'0')} | ${r.period_start} ~ ${r.period_end} | ${aiStatus}`);
    });
  }

  // 3. Meta 데이터 현황 (count 사용)
  console.log('\n📋 3. Meta 데이터 현황');
  console.log('-'.repeat(40));

  const metaRange = await getDateRange('polarad_meta_data', HEA_UUID);
  const { count: metaTotal } = await supabase
    .from('polarad_meta_data')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', HEA_UUID);

  console.log(`  전체: ${metaTotal?.toLocaleString() || 0}건`);
  console.log(`  기간: ${metaRange.min} ~ ${metaRange.max}`);

  // 월별 분포
  const meta2025_10 = await getMonthlyCount('polarad_meta_data', HEA_UUID, 2025, 10);
  const meta2025_11 = await getMonthlyCount('polarad_meta_data', HEA_UUID, 2025, 11);
  const meta2025_12 = await getMonthlyCount('polarad_meta_data', HEA_UUID, 2025, 12);
  const meta2026_01 = await getMonthlyCount('polarad_meta_data', HEA_UUID, 2026, 1);

  console.log(`  2025-10: ${meta2025_10}건`);
  console.log(`  2025-11: ${meta2025_11}건`);
  console.log(`  2025-12: ${meta2025_12}건`);
  console.log(`  2026-01: ${meta2026_01}건`);

  // 4. Naver 데이터 현황 (count 사용)
  console.log('\n📋 4. Naver 데이터 현황');
  console.log('-'.repeat(40));

  const naverRange = await getDateRange('polarad_naver_data', HEA_UUID);
  const { count: naverTotal } = await supabase
    .from('polarad_naver_data')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', HEA_UUID)
    .neq('keyword', '_total_');

  console.log(`  전체: ${naverTotal?.toLocaleString() || 0}건 (_total_ 제외)`);
  console.log(`  기간: ${naverRange.min} ~ ${naverRange.max}`);

  // 월별 분포 (Naver는 _total_ 제외)
  const naver2025_10 = await getMonthlyCount('polarad_naver_data', HEA_UUID, 2025, 10, true);
  const naver2025_11 = await getMonthlyCount('polarad_naver_data', HEA_UUID, 2025, 11, true);
  const naver2025_12 = await getMonthlyCount('polarad_naver_data', HEA_UUID, 2025, 12, true);
  const naver2026_01 = await getMonthlyCount('polarad_naver_data', HEA_UUID, 2026, 1, true);

  console.log(`  2025-10: ${naver2025_10}건`);
  console.log(`  2025-11: ${naver2025_11}건`);
  console.log(`  2025-12: ${naver2025_12}건`);
  console.log(`  2026-01: ${naver2026_01}건`);

  // 5. 12월 주간별 데이터 상세
  console.log('\n📋 5. 12월 주간별 데이터 상세');
  console.log('-'.repeat(40));

  const decWeeks = [
    { week: 1, start: '2025-12-01', end: '2025-12-07' },
    { week: 2, start: '2025-12-08', end: '2025-12-14' },
    { week: 3, start: '2025-12-15', end: '2025-12-21' },
    { week: 4, start: '2025-12-22', end: '2025-12-28' },
    { week: 5, start: '2025-12-29', end: '2025-12-31' },
  ];

  for (const w of decWeeks) {
    // Meta 데이터
    const { count: metaCount } = await supabase
      .from('polarad_meta_data')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', HEA_UUID)
      .gte('date', w.start)
      .lte('date', w.end);

    // Naver 데이터
    const { count: naverCount } = await supabase
      .from('polarad_naver_data')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', HEA_UUID)
      .gte('date', w.start)
      .lte('date', w.end)
      .neq('keyword', '_total_');

    // 리포트 존재 여부
    const report = weeklyReports?.find(r => r.year === 2025 && r.month === 12 && r.week === w.week);
    const reportStatus = report
      ? (report.ai_generated_at ? '✅ 리포트+AI' : '⚠️ 리포트만')
      : '❌ 리포트없음';

    console.log(`  ${w.week}주차 (${w.start}~${w.end}): Meta ${metaCount || 0}건, Naver ${naverCount || 0}건 | ${reportStatus}`);
  }

  // 6. 12월 Naver 날짜별 데이터 확인
  console.log('\n📋 6. 12월 Naver 날짜별 데이터 유무');
  console.log('-'.repeat(40));

  const decDates = await getUniqueDates('polarad_naver_data', HEA_UUID, '2025-12-01', '2025-12-31');
  console.log(`  데이터 있는 날짜: ${decDates.length}일`);

  // 누락 날짜 확인
  const allDecDates = [];
  for (let d = 1; d <= 31; d++) {
    allDecDates.push(`2025-12-${String(d).padStart(2, '0')}`);
  }
  const missingDates = allDecDates.filter(d => !decDates.includes(d));

  if (missingDates.length > 0) {
    console.log(`  누락 날짜: ${missingDates.join(', ')}`);
  } else {
    console.log(`  ✅ 12월 전체 날짜 데이터 있음`);
  }

  // 7. 1월 데이터 확인
  console.log('\n📋 7. 2026년 1월 데이터 확인');
  console.log('-'.repeat(40));

  const today = new Date().toISOString().split('T')[0];
  console.log(`  오늘: ${today}`);
  console.log(`  Meta 1월: ${meta2026_01}건`);
  console.log(`  Naver 1월: ${naver2026_01}건 (수동업로드 대기)`);

  console.log('\n' + '='.repeat(60));
  console.log('📊 데이터 정합성 점검 완료\n');
}

main().catch(console.error);
