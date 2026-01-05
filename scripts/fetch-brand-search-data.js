#!/usr/bin/env node
/**
 * 네이버 브랜드검색 광고 데이터 가져오기
 *
 * 사용법:
 *   node fetch-brand-search-data.js --start 2026-01-01 --end 2026-01-05
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// === 설정 ===
const NAVER_API_BASE = 'https://api.searchad.naver.com';
const CUSTOMER_ID = process.env.NAVER_CUSTOMER_ID;
const API_KEY = process.env.NAVER_API_KEY;
const SECRET_KEY = process.env.NAVER_SECRET_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 나라똔 클라이언트 ID
const CLIENT_ID = 'c2f60730-f8c1-4361-b9fc-3b44725c3955';

// === 네이버 API ===
function generateSignature(timestamp, method, uri) {
  const message = `${timestamp}.${method}.${uri}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(message);
  return hmac.digest('base64');
}

function getNaverHeaders(method, uri) {
  const timestamp = String(Date.now());
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Timestamp': timestamp,
    'X-API-KEY': API_KEY,
    'X-Customer': CUSTOMER_ID,
    'X-Signature': generateSignature(timestamp, method, uri),
  };
}

async function callNaverAPI(method, uri, body = null) {
  const headers = getNaverHeaders(method, uri);
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(NAVER_API_BASE + uri, options);
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// 캠페인 목록 조회
async function getCampaigns() {
  return await callNaverAPI('GET', '/ncc/campaigns');
}

// StatReport 생성 (브랜드검색용)
async function createStatReport(startDate, endDate, reportType = 'ADGROUP') {
  const requestBody = {
    reportTp: reportType,  // ADGROUP: 광고그룹별 집계
    statDt: startDate.replace(/-/g, ''),
    endDt: endDate.replace(/-/g, ''),
  };

  console.log(`  보고서 타입: ${reportType}`);
  const report = await callNaverAPI('POST', '/stat-reports', requestBody);

  if (!report.reportJobId) {
    console.log('  응답:', JSON.stringify(report, null, 2));
    throw new Error(`StatReport 생성 실패`);
  }

  return report.reportJobId;
}

async function waitForReport(reportJobId, maxWait = 60000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const status = await callNaverAPI('GET', `/stat-reports/${reportJobId}`);

    if (status.status === 'BUILT' && status.downloadUrl) {
      return status.downloadUrl;
    }

    if (status.status === 'NONE' || status.status === 'FAIL') {
      throw new Error(`보고서 생성 실패: ${status.status}`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  throw new Error('보고서 생성 타임아웃');
}

async function downloadReport(downloadUrl) {
  const headers = getNaverHeaders('GET', '/report-download');
  const response = await fetch(downloadUrl, { headers });
  return response.text();
}

function parseReportData(tsvData, debug = false) {
  const lines = tsvData.trim().split('\n');
  if (lines.length === 0) return [];

  // 디버그: 첫 3줄 컬럼 출력
  if (debug) {
    console.log('\n  === 데이터 샘플 ===');
    lines.slice(0, 3).forEach((line, i) => {
      const cols = line.split('\t');
      console.log(`  [${i}] ${cols.length}개 컬럼:`);
      cols.forEach((col, j) => console.log(`      [${j}]: ${col}`));
    });
    console.log('  ==================\n');
  }

  // 일별/디바이스별로 집계
  const dailyData = new Map();

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 12) continue;

    // 날짜 추출 (첫 번째 컬럼, YYYYMMDD 형식)
    const dateRaw = cols[0];
    if (!/^\d{8}$/.test(dateRaw)) continue;

    const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;

    // 디바이스 (PC=P, Mobile=M) - 컬럼 10
    const deviceCode = cols[10] || '';
    const device = deviceCode === 'P' ? 'pc' : deviceCode === 'M' ? 'mobile' : 'unknown';

    // 노출, 클릭 - 컬럼 11, 12
    const impressions = parseInt(cols[11]) || 0;
    const clicks = parseInt(cols[12]) || 0;

    // unknown 디바이스는 스킵
    if (device === 'unknown') continue;

    const key = `${date}_${device}`;
    const existing = dailyData.get(key) || { date, device, impressions: 0, clicks: 0 };
    dailyData.set(key, {
      date,
      device,
      impressions: existing.impressions + impressions,
      clicks: existing.clicks + clicks,
    });
  }

  return Array.from(dailyData.values());
}

// DB에 저장
async function saveToDatabase(records, startDate, endDate) {
  console.log(`\n📦 ${records.length}개 레코드 저장 중...`);

  // 해당 기간 기존 데이터 삭제
  console.log(`  기간 ${startDate} ~ ${endDate} 기존 데이터 삭제...`);
  const { error: deleteError } = await supabase
    .from('polarad_brand_search_data')
    .delete()
    .eq('client_id', CLIENT_ID)
    .gte('date', startDate)
    .lte('date', endDate);

  if (deleteError) {
    console.error('  삭제 오류:', deleteError.message);
  }

  // 새 데이터 삽입 (배치)
  let successCount = 0;
  for (const record of records) {
    const { error } = await supabase
      .from('polarad_brand_search_data')
      .upsert({
        client_id: CLIENT_ID,
        date: record.date,
        device: record.device,
        impressions: record.impressions,
        clicks: record.clicks,
      }, {
        onConflict: 'client_id,date,device',
      });

    if (error) {
      console.error(`  저장 오류 (${record.date} ${record.device}):`, error.message);
    } else {
      successCount++;
    }
  }

  console.log(`  ✅ ${successCount}개 레코드 저장 완료`);
}

// 날짜 범위 생성
function getDateRange(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// 단일 날짜 데이터 가져오기
async function fetchSingleDayData(date, debug = false) {
  try {
    const reportJobId = await createStatReport(date, date);
    const downloadUrl = await waitForReport(reportJobId);
    const tsvData = await downloadReport(downloadUrl);
    return parseReportData(tsvData, debug);
  } catch (error) {
    console.log(`  ⚠️ ${date} 데이터 가져오기 실패: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('🚀 네이버 브랜드검색 데이터 가져오기\n');

  // 환경변수 확인
  if (!CUSTOMER_ID || !API_KEY || !SECRET_KEY) {
    console.error('❌ 네이버 API 환경변수 누락');
    return;
  }

  console.log(`Customer ID: ${CUSTOMER_ID}`);

  // 날짜 파싱
  const args = process.argv.slice(2);
  let startDate = '2026-01-01';
  let endDate = '2026-01-05';

  if (args.includes('--start')) {
    startDate = args[args.indexOf('--start') + 1];
  }
  if (args.includes('--end')) {
    endDate = args[args.indexOf('--end') + 1];
  }

  console.log(`📅 기간: ${startDate} ~ ${endDate}\n`);

  try {
    // 1. 캠페인 목록 확인
    console.log('1️⃣ 캠페인 목록 조회...');
    const campaigns = await getCampaigns();
    console.log(`  ${campaigns.length}개 캠페인 발견\n`);

    // 2. 날짜별로 데이터 수집
    const dates = getDateRange(startDate, endDate);
    console.log(`2️⃣ ${dates.length}일간 데이터 수집 시작...\n`);

    const allRecords = [];

    let isFirstDay = true;
    for (const date of dates) {
      console.log(`📆 ${date} 처리 중...`);
      const records = await fetchSingleDayData(date, isFirstDay);
      isFirstDay = false;
      if (records.length > 0) {
        allRecords.push(...records);
        const total = records.reduce((acc, r) => ({
          impressions: acc.impressions + r.impressions,
          clicks: acc.clicks + r.clicks
        }), { impressions: 0, clicks: 0 });
        console.log(`  ✅ 노출 ${total.impressions.toLocaleString()}, 클릭 ${total.clicks}\n`);
      } else {
        console.log(`  ⏭️ 데이터 없음\n`);
      }

      // API 속도 제한 방지
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n📊 총 ${allRecords.length}개 레코드 수집\n`);

    // 일별 합계 출력
    const dailyTotals = new Map();
    allRecords.forEach(r => {
      const existing = dailyTotals.get(r.date) || { impressions: 0, clicks: 0 };
      dailyTotals.set(r.date, {
        impressions: existing.impressions + r.impressions,
        clicks: existing.clicks + r.clicks,
      });
    });

    console.log('=== 일별 합계 ===');
    let totalImp = 0, totalClicks = 0;
    Array.from(dailyTotals.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, data]) => {
        console.log(`${date}: 노출 ${data.impressions.toLocaleString()}, 클릭 ${data.clicks}`);
        totalImp += data.impressions;
        totalClicks += data.clicks;
      });
    console.log(`\n합계: 노출 ${totalImp.toLocaleString()}, 클릭 ${totalClicks.toLocaleString()}`);

    // 3. DB 저장
    if (allRecords.length > 0) {
      await saveToDatabase(allRecords, startDate, endDate);
    }

    console.log('\n✅ 완료!');

  } catch (error) {
    console.error('\n❌ 오류:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);
