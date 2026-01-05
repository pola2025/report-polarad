#!/usr/bin/env node
/**
 * 네이버 플레이스 광고 - 일일 데이터 자동 동기화
 *
 * 흐름:
 *   1. 네이버 API → StatReport 생성 → 다운로드
 *   2. Airtable에 캐시 저장
 *   3. Supabase에 동기화
 *
 * 사용법:
 *   node naver-daily-sync.js              # 어제 데이터 동기화
 *   node naver-daily-sync.js --days 7     # 최근 7일
 *   node naver-daily-sync.js --date 2025-12-20  # 특정 날짜
 *
 * 스케줄러:
 *   - Windows: Task Scheduler에서 매일 오전 9시 실행
 *   - Linux: crontab -e → 0 9 * * * node /path/to/naver-daily-sync.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// === 설정 ===
const NAVER_API_BASE = 'https://api.searchad.naver.com';
const CUSTOMER_ID = process.env.NAVER_CUSTOMER_ID;
const API_KEY = process.env.NAVER_API_KEY;
const SECRET_KEY = process.env.NAVER_SECRET_KEY;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_NAVER_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_NAVER_AD_DAILY_TABLE;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKFILL_CHAT_ID = '-1003394139746';

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

async function createStatReport(dateStr) {
  const report = await callNaverAPI('POST', '/stat-reports', {
    reportTp: 'AD',
    statDt: dateStr.replace(/-/g, ''),
  });

  if (!report.reportJobId) {
    throw new Error(`StatReport 생성 실패: ${JSON.stringify(report)}`);
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

    await new Promise(r => setTimeout(r, 2000));
  }

  throw new Error('보고서 생성 타임아웃');
}

async function downloadReport(downloadUrl) {
  const headers = getNaverHeaders('GET', '/report-download');
  const response = await fetch(downloadUrl, { headers });
  return response.text();
}

function parseReportData(tsvData, dateStr) {
  const lines = tsvData.trim().split('\n');
  if (lines.length === 0) return [];

  // TSV 파싱 (탭 구분)
  // 컬럼: 날짜, 고객ID, 캠페인ID, 광고그룹ID, -, 광고ID, 비즈ID, 지역코드, 디바이스, 노출, 클릭, 비용, ?, ?
  let totalImp = 0;
  let totalClk = 0;
  let totalCost = 0;

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length >= 12) {
      totalImp += parseInt(cols[9]) || 0;
      totalClk += parseInt(cols[10]) || 0;
      totalCost += parseFloat(cols[11]) || 0;
    }
  }

  return {
    date: dateStr,
    impCnt: totalImp,
    clkCnt: totalClk,
    salesAmt: Math.round(totalCost),
    ctr: totalImp > 0 ? (totalClk / totalImp * 100) : 0,
    cpc: totalClk > 0 ? Math.round(totalCost / totalClk) : 0,
    ccnt: 0,
    syncedAt: new Date().toISOString(),
  };
}

// === Airtable ===
async function upsertToAirtable(record) {
  // 기존 레코드 검색
  const filterFormula = encodeURIComponent(`{date}='${record.date}'`);
  const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${filterFormula}`;

  const searchResponse = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
  });
  const searchData = await searchResponse.json();

  const headers = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };

  if (searchData.records && searchData.records.length > 0) {
    // 업데이트
    const recordId = searchData.records[0].id;
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;

    await fetch(updateUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: record }),
    });

    return 'updated';
  } else {
    // 생성
    const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

    await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields: record }),
    });

    return 'created';
  }
}

// === Supabase ===
async function syncToSupabase(record) {
  // 클라이언트 ID 조회
  const { data: client } = await supabase
    .from('polarad_clients')
    .select('id')
    .eq('is_active', true)
    .single();

  if (!client) {
    throw new Error('활성 클라이언트 없음');
  }

  // 네이버 데이터 저장 (일별 집계)
  const { error } = await supabase
    .from('polarad_naver_data')
    .upsert({
      client_id: client.id,
      date: record.date,
      keyword: '_total_',  // 일별 합계
      impressions: record.impCnt,
      clicks: record.clkCnt,
      total_cost: record.salesAmt,
      ctr: record.ctr,
      avg_cpc: record.cpc,
      avg_rank: 0,
    }, {
      onConflict: 'client_id,date,keyword',
    });

  if (error) {
    throw new Error(`Supabase 저장 실패: ${error.message}`);
  }
}

// === 텔레그램 ===
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: BACKFILL_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (e) {
    console.error('텔레그램 전송 실패:', e.message);
  }
}

// === 메인 ===
async function syncDate(dateStr) {
  console.log(`\n📅 ${dateStr} 데이터 동기화...`);

  // 1. StatReport 생성
  console.log('  1. StatReport 생성 중...');
  const reportJobId = await createStatReport(dateStr);
  console.log(`     보고서 ID: ${reportJobId}`);

  // 2. 완료 대기 및 다운로드
  console.log('  2. 보고서 대기 중...');
  const downloadUrl = await waitForReport(reportJobId);
  const tsvData = await downloadReport(downloadUrl);
  console.log(`     다운로드 완료 (${tsvData.length} bytes)`);

  // 3. 데이터 파싱
  const record = parseReportData(tsvData, dateStr);
  console.log(`     노출: ${record.impCnt.toLocaleString()}, 클릭: ${record.clkCnt}, 비용: ${record.salesAmt.toLocaleString()}원`);

  // 4. Airtable 저장
  console.log('  3. Airtable 저장 중...');
  const airtableResult = await upsertToAirtable(record);
  console.log(`     ${airtableResult}`);

  // 5. Supabase 동기화
  console.log('  4. Supabase 동기화 중...');
  await syncToSupabase(record);
  console.log('     완료');

  return record;
}

async function main() {
  console.log('🚀 네이버 플레이스 광고 일일 동기화\n');

  // 환경변수 확인
  const missing = [];
  if (!CUSTOMER_ID) missing.push('NAVER_CUSTOMER_ID');
  if (!API_KEY) missing.push('NAVER_API_KEY');
  if (!SECRET_KEY) missing.push('NAVER_SECRET_KEY');
  if (!AIRTABLE_API_KEY) missing.push('AIRTABLE_API_KEY');
  if (!AIRTABLE_BASE_ID) missing.push('AIRTABLE_NAVER_BASE_ID');

  if (missing.length > 0) {
    console.error('❌ 환경변수 누락:', missing.join(', '));
    return;
  }

  // 날짜 계산
  const args = process.argv.slice(2);
  const dates = [];

  if (args.includes('--date')) {
    const idx = args.indexOf('--date');
    dates.push(args[idx + 1]);
  } else {
    const days = args.includes('--days')
      ? parseInt(args[args.indexOf('--days') + 1]) || 1
      : 1;

    for (let i = 1; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
  }

  console.log(`📆 동기화 날짜: ${dates.join(', ')}`);

  const results = [];

  try {
    for (const dateStr of dates) {
      const record = await syncDate(dateStr);
      results.push(record);

      // API 호출 제한 방지
      if (dates.length > 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // 완료 알림
    const summary = results.map(r =>
      `${r.date}: 노출 ${r.impCnt.toLocaleString()}, 클릭 ${r.clkCnt}, 비용 ${r.salesAmt.toLocaleString()}원`
    ).join('\n');

    await sendTelegram(
      `✅ <b>네이버 광고 동기화 완료</b>\n\n${summary}`
    );

    console.log('\n✅ 동기화 완료!');

  } catch (error) {
    console.error('\n❌ 오류:', error.message);

    await sendTelegram(
      `❌ <b>네이버 광고 동기화 실패</b>\n\n오류: ${error.message}`
    );
  }
}

main().catch(console.error);
