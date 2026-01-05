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

  console.log(`  API 호출: ${method} ${uri}`);
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
async function createStatReport(startDate, endDate) {
  const report = await callNaverAPI('POST', '/stat-reports', {
    reportTp: 'AD_DETAIL',  // 광고 상세 보고서
    statDt: startDate.replace(/-/g, ''),
    endDt: endDate.replace(/-/g, ''),
  });

  if (!report.reportJobId) {
    console.log('응답:', JSON.stringify(report, null, 2));
    throw new Error(`StatReport 생성 실패`);
  }

  return report.reportJobId;
}

async function waitForReport(reportJobId, maxWait = 120000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const status = await callNaverAPI('GET', `/stat-reports/${reportJobId}`);
    console.log(`  상태: ${status.status}`);

    if (status.status === 'BUILT' && status.downloadUrl) {
      return status.downloadUrl;
    }

    if (status.status === 'NONE' || status.status === 'FAIL') {
      throw new Error(`보고서 생성 실패: ${status.status}`);
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  throw new Error('보고서 생성 타임아웃');
}

async function downloadReport(downloadUrl) {
  const headers = getNaverHeaders('GET', '/report-download');
  const response = await fetch(downloadUrl, { headers });
  return response.text();
}

function parseReportData(tsvData) {
  const lines = tsvData.trim().split('\n');
  if (lines.length === 0) return [];

  console.log(`  총 ${lines.length}개 라인`);

  // 첫 5줄 출력 (디버깅용)
  console.log('\n  === 데이터 샘플 (첫 5줄) ===');
  lines.slice(0, 5).forEach((line, i) => {
    console.log(`  ${i}: ${line.substring(0, 200)}`);
  });
  console.log('  ===========================\n');

  // 일별/디바이스별로 집계
  const dailyData = new Map();

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 12) continue;

    // 날짜 추출 (첫 번째 컬럼, YYYYMMDD 형식)
    const dateRaw = cols[0];
    if (!/^\d{8}$/.test(dateRaw)) continue;

    const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;

    // 디바이스 (PC=P, Mobile=M)
    const deviceCode = cols[8] || '';
    const device = deviceCode === 'P' ? 'pc' : deviceCode === 'M' ? 'mobile' : 'unknown';

    // 노출, 클릭
    const impressions = parseInt(cols[9]) || 0;
    const clicks = parseInt(cols[10]) || 0;

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
async function saveToDatabase(records) {
  console.log(`\n📦 ${records.length}개 레코드 저장 중...`);

  // 기존 1월 데이터 삭제
  console.log('  기존 1월 데이터 삭제...');
  const { error: deleteError } = await supabase
    .from('polarad_brand_search_data')
    .delete()
    .eq('client_id', CLIENT_ID)
    .gte('date', '2026-01-01')
    .lte('date', '2026-01-31');

  if (deleteError) {
    console.error('  삭제 오류:', deleteError.message);
  }

  // 새 데이터 삽입
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
      console.log(`  ✅ ${record.date} ${record.device}: 노출 ${record.impressions}, 클릭 ${record.clicks}`);
    }
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
    console.log(`  ${campaigns.length}개 캠페인 발견`);

    // 브랜드검색 캠페인 찾기
    const brandCampaigns = campaigns.filter(c =>
      c.campaignTp === 'BRAND' ||
      c.name?.includes('브랜드') ||
      c.name?.includes('brand')
    );
    console.log(`  브랜드검색 캠페인: ${brandCampaigns.length}개`);
    brandCampaigns.forEach(c => console.log(`    - ${c.name} (${c.nccCampaignId})`));

    // 2. StatReport 생성
    console.log('\n2️⃣ StatReport 생성...');
    const reportJobId = await createStatReport(startDate, endDate);
    console.log(`  보고서 ID: ${reportJobId}`);

    // 3. 완료 대기
    console.log('\n3️⃣ 보고서 완료 대기...');
    const downloadUrl = await waitForReport(reportJobId);
    console.log('  다운로드 URL 획득');

    // 4. 다운로드
    console.log('\n4️⃣ 데이터 다운로드...');
    const tsvData = await downloadReport(downloadUrl);
    console.log(`  ${tsvData.length} bytes 수신`);

    // 5. 파싱
    console.log('\n5️⃣ 데이터 파싱...');
    const records = parseReportData(tsvData);
    console.log(`  ${records.length}개 레코드 파싱`);

    // 일별 합계 출력
    const dailyTotals = new Map();
    records.forEach(r => {
      const existing = dailyTotals.get(r.date) || { impressions: 0, clicks: 0 };
      dailyTotals.set(r.date, {
        impressions: existing.impressions + r.impressions,
        clicks: existing.clicks + r.clicks,
      });
    });

    console.log('\n  === 일별 합계 ===');
    Array.from(dailyTotals.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, data]) => {
        console.log(`  ${date}: 노출 ${data.impressions.toLocaleString()}, 클릭 ${data.clicks}`);
      });

    // 6. DB 저장
    if (records.length > 0) {
      await saveToDatabase(records);
    }

    console.log('\n✅ 완료!');

  } catch (error) {
    console.error('\n❌ 오류:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);
