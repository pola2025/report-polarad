#!/usr/bin/env node
/**
 * Airtable 백필 데이터 정합성 검증 스크립트
 *
 * 검증 항목:
 * 1. 중복 레코드 탐지
 * 2. 환율 적용 검증 (spend 값 범위)
 * 3. 필수 필드 검증
 * 4. 날짜 범위 검증
 *
 * 사용법:
 *   node verify-backfill.js --client "H.E.A 판교" --start 2026-01-01 --end 2026-01-28
 *   node verify-backfill.js --client "나라똔" --days 30
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;

const AIRTABLE_CONFIG = {
  'H.E.A 판교': {
    baseId: process.env.AIRTABLE_HEA_BASE_ID || 'appJlOqnadLsMJQYw',
    tableId: process.env.AIRTABLE_HEA_TABLE_ID || 'tbl8ftclEFG5ypohX',
  },
  '나라똔': {
    baseId: process.env.AIRTABLE_NARATTON_BASE_ID || 'appN2KzUoORRrb8X9',
    tableId: process.env.AIRTABLE_NARATTON_TABLE_ID || 'tblmC9Ft2ioXKXsrL',
  },
};

// 텔레그램 알림
const BACKFILL_CHAT_ID = '-1003394139746';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

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
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error('텔레그램 알림 실패:', e.message);
  }
}

// Airtable에서 데이터 조회
async function fetchAirtableData(baseId, tableId, startDate, endDate) {
  const allRecords = [];
  let offset = '';

  do {
    const formula = encodeURIComponent(`AND({date}>='${startDate}', {date}<='${endDate}', {source}='meta')`);
    let url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${formula}&pageSize=100`;
    if (offset) url += `&offset=${offset}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const data = await response.json();

    if (data.error) {
      throw new Error(`Airtable 오류: ${data.error.message}`);
    }

    allRecords.push(...(data.records || []));
    offset = data.offset || '';
  } while (offset);

  return allRecords;
}

// Upsert 키 생성
function generateKey(record) {
  const f = record.fields;
  const adId = f.ad_id || '';
  const campaignName = f.campaign_name || '';

  if (adId) {
    return `${f.date}|meta|${f.device}|${adId}`;
  }
  return `${f.date}|meta|${f.device}|${campaignName}`;
}

// 정합성 검증
function verifyData(records) {
  const issues = {
    duplicates: [],
    currencySuspect: [],
    missingFields: [],
    summary: {
      total: records.length,
      byDate: {},
      totalSpend: 0,
      totalImpressions: 0,
    }
  };

  const seenKeys = new Map();

  for (const record of records) {
    const f = record.fields;

    // 날짜별 집계
    if (!issues.summary.byDate[f.date]) {
      issues.summary.byDate[f.date] = { count: 0, spend: 0, impressions: 0 };
    }
    issues.summary.byDate[f.date].count++;
    issues.summary.byDate[f.date].spend += f.spend || 0;
    issues.summary.byDate[f.date].impressions += f.impressions || 0;
    issues.summary.totalSpend += f.spend || 0;
    issues.summary.totalImpressions += f.impressions || 0;

    // 1. 중복 검증
    const key = generateKey(record);
    if (seenKeys.has(key)) {
      issues.duplicates.push({
        key,
        recordIds: [seenKeys.get(key), record.id],
        date: f.date,
        device: f.device,
      });
    }
    seenKeys.set(key, record.id);

    // 2. 환율 적용 검증
    // impressions >= 100 이고 spend > 0 이고 spend < 100 이면 의심
    if ((f.impressions || 0) >= 100 && f.spend > 0 && f.spend < 100) {
      issues.currencySuspect.push({
        recordId: record.id,
        date: f.date,
        spend: f.spend,
        impressions: f.impressions,
        device: f.device,
      });
    }

    // 3. 필수 필드 검증
    if (!f.date) {
      issues.missingFields.push({ recordId: record.id, field: 'date' });
    }
    if (!f.source) {
      issues.missingFields.push({ recordId: record.id, field: 'source' });
    }
  }

  return issues;
}

// 결과 출력
function printResults(clientName, issues, startDate, endDate) {
  console.log('\n' + '='.repeat(60));
  console.log(`📊 ${clientName} 정합성 검증 결과`);
  console.log(`📅 기간: ${startDate} ~ ${endDate}`);
  console.log('='.repeat(60));

  console.log(`\n📈 요약:`);
  console.log(`   총 레코드: ${issues.summary.total}개`);
  console.log(`   총 지출: ₩${issues.summary.totalSpend.toLocaleString()}`);
  console.log(`   총 노출: ${issues.summary.totalImpressions.toLocaleString()}`);

  // 날짜별 요약 (최근 5일)
  const dates = Object.keys(issues.summary.byDate).sort().slice(-5);
  if (dates.length > 0) {
    console.log(`\n📅 최근 날짜별:`);
    dates.forEach(d => {
      const data = issues.summary.byDate[d];
      console.log(`   ${d}: ${data.count}건, ₩${data.spend.toLocaleString()}`);
    });
  }

  // 문제 목록
  let hasIssues = false;

  if (issues.duplicates.length > 0) {
    hasIssues = true;
    console.log(`\n❌ 중복 레코드: ${issues.duplicates.length}건`);
    issues.duplicates.slice(0, 5).forEach(d => {
      console.log(`   - ${d.date} ${d.device}: ${d.key}`);
    });
    if (issues.duplicates.length > 5) {
      console.log(`   ... 외 ${issues.duplicates.length - 5}건`);
    }
  }

  if (issues.currencySuspect.length > 0) {
    hasIssues = true;
    console.log(`\n⚠️  환율 미적용 의심: ${issues.currencySuspect.length}건`);
    issues.currencySuspect.slice(0, 5).forEach(c => {
      console.log(`   - ${c.date} ${c.device}: spend=$${c.spend}, impressions=${c.impressions}`);
    });
    if (issues.currencySuspect.length > 5) {
      console.log(`   ... 외 ${issues.currencySuspect.length - 5}건`);
    }
  }

  if (issues.missingFields.length > 0) {
    hasIssues = true;
    console.log(`\n❌ 필수 필드 누락: ${issues.missingFields.length}건`);
    issues.missingFields.slice(0, 5).forEach(m => {
      console.log(`   - ${m.recordId}: ${m.field}`);
    });
  }

  if (!hasIssues) {
    console.log(`\n✅ 모든 검증 통과!`);
  }

  console.log('\n' + '='.repeat(60));

  return hasIssues;
}

// 메인 함수
async function main() {
  const args = process.argv.slice(2);

  // 도움말
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Airtable 백필 데이터 정합성 검증 스크립트

사용법:
  node verify-backfill.js --client "H.E.A 판교" --start 2026-01-01 --end 2026-01-28
  node verify-backfill.js --client "나라똔" --days 30
  node verify-backfill.js --all --days 7   # 모든 클라이언트

옵션:
  --client <name>   클라이언트 지정
  --all             모든 클라이언트 검증
  --start <date>    시작일 (YYYY-MM-DD)
  --end <date>      종료일 (YYYY-MM-DD)
  --days <n>        오늘부터 n일 전까지
    `);
    return;
  }

  // 날짜 계산
  let startDate, endDate;
  const daysIndex = args.indexOf('--days');
  const startIndex = args.indexOf('--start');
  const endIndex = args.indexOf('--end');

  if (daysIndex !== -1) {
    const days = parseInt(args[daysIndex + 1]) || 30;
    endDate = new Date().toISOString().split('T')[0];
    const start = new Date();
    start.setDate(start.getDate() - days);
    startDate = start.toISOString().split('T')[0];
  } else {
    startDate = startIndex !== -1 ? args[startIndex + 1] : null;
    endDate = endIndex !== -1 ? args[endIndex + 1] : new Date().toISOString().split('T')[0];
  }

  if (!startDate) {
    console.error('❌ 시작일을 지정하세요 (--start 또는 --days)');
    return;
  }

  // 클라이언트 결정
  const clientIndex = args.indexOf('--client');
  const isAll = args.includes('--all');

  let clients = [];
  if (isAll) {
    clients = Object.keys(AIRTABLE_CONFIG);
  } else if (clientIndex !== -1) {
    const clientName = args[clientIndex + 1];
    if (AIRTABLE_CONFIG[clientName]) {
      clients = [clientName];
    } else {
      console.error(`❌ 클라이언트를 찾을 수 없음: ${clientName}`);
      console.error(`가능한 클라이언트: ${Object.keys(AIRTABLE_CONFIG).join(', ')}`);
      return;
    }
  } else {
    console.error('❌ --client 또는 --all 옵션 필수!');
    return;
  }

  console.log('🔍 Airtable 백필 데이터 정합성 검증 시작');
  console.log(`📅 기간: ${startDate} ~ ${endDate}`);
  console.log(`👥 대상: ${clients.join(', ')}`);

  let overallHasIssues = false;
  const results = {};

  for (const clientName of clients) {
    const config = AIRTABLE_CONFIG[clientName];

    try {
      console.log(`\n📡 ${clientName} 데이터 조회 중...`);
      const records = await fetchAirtableData(config.baseId, config.tableId, startDate, endDate);

      if (records.length === 0) {
        console.log(`⚠️  ${clientName}: 데이터 없음`);
        results[clientName] = { status: 'empty', count: 0 };
        continue;
      }

      const issues = verifyData(records);
      const hasIssues = printResults(clientName, issues, startDate, endDate);

      results[clientName] = {
        status: hasIssues ? 'issues' : 'ok',
        count: records.length,
        duplicates: issues.duplicates.length,
        currencySuspect: issues.currencySuspect.length,
        missingFields: issues.missingFields.length,
      };

      if (hasIssues) overallHasIssues = true;

    } catch (error) {
      console.error(`❌ ${clientName} 검증 실패: ${error.message}`);
      results[clientName] = { status: 'error', error: error.message };
      overallHasIssues = true;
    }
  }

  // 텔레그램 알림
  const statusEmoji = overallHasIssues ? '⚠️' : '✅';
  const statusText = overallHasIssues ? '정합성 문제 발견' : '모든 검증 통과';

  let message = `${statusEmoji} <b>백필 정합성 검증 ${statusText}</b>\n\n`;
  message += `📅 기간: ${startDate} ~ ${endDate}\n\n`;

  for (const [name, result] of Object.entries(results)) {
    if (result.status === 'ok') {
      message += `✅ ${name}: ${result.count}건 정상\n`;
    } else if (result.status === 'empty') {
      message += `⏭️ ${name}: 데이터 없음\n`;
    } else if (result.status === 'issues') {
      message += `⚠️ ${name}: ${result.count}건\n`;
      if (result.duplicates > 0) message += `   - 중복: ${result.duplicates}건\n`;
      if (result.currencySuspect > 0) message += `   - 환율 의심: ${result.currencySuspect}건\n`;
    } else {
      message += `❌ ${name}: ${result.error}\n`;
    }
  }

  await sendTelegram(message);

  // 종료 코드
  process.exit(overallHasIssues ? 1 : 0);
}

main().catch(console.error);
