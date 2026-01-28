#!/usr/bin/env node
/**
 * Self-Healing Auto-Fix Script
 *
 * 자동으로 다음 문제를 수정:
 * 1. 중복 레코드 제거
 * 2. 환율 미적용 수정 (USD → KRW)
 *
 * 사용법:
 *   node auto-fix.js --client "H.E.A 판교" --days 30
 *   node auto-fix.js --all --days 30
 *   node auto-fix.js --all --days 30 --dry-run  # 실제 수정 안함, 미리보기만
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../dashboard/.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const USD_TO_KRW = 1490;

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
      }),
    });
  } catch (e) {
    console.error('텔레그램 알림 실패:', e.message);
  }
}

// Airtable에서 데이터 조회 (페이지네이션)
async function fetchAllRecords(baseId, tableId, startDate, endDate) {
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

// 레코드 삭제
async function deleteRecords(baseId, tableId, recordIds) {
  // Airtable는 한 번에 10개씩만 삭제 가능
  const chunks = [];
  for (let i = 0; i < recordIds.length; i += 10) {
    chunks.push(recordIds.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const params = chunk.map(id => `records[]=${id}`).join('&');
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}?${params}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await response.json();
    if (data.error) {
      console.error('삭제 오류:', data.error);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }
}

// 레코드 업데이트
async function updateRecords(baseId, tableId, updates) {
  // Airtable는 한 번에 10개씩만 업데이트 가능
  const chunks = [];
  for (let i = 0; i < updates.length; i += 10) {
    chunks.push(updates.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: chunk }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('업데이트 오류:', data.error);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }
}

// 중복 찾기 및 제거
async function fixDuplicates(clientName, config, startDate, endDate, dryRun) {
  console.log(`\n🔍 ${clientName} 중복 검사 중...`);

  const records = await fetchAllRecords(config.baseId, config.tableId, startDate, endDate);
  console.log(`   총 레코드: ${records.length}개`);

  const keyMap = new Map();

  records.forEach(r => {
    const key = generateKey(r);
    if (!keyMap.has(key)) {
      keyMap.set(key, []);
    }
    keyMap.get(key).push(r);
  });

  // 중복인 경우 최신 1개 제외 삭제
  const toDelete = [];
  keyMap.forEach((recs, key) => {
    if (recs.length > 1) {
      // 레코드 ID 기준 정렬 (최신이 더 뒤), 첫 번째 제외 나머지 삭제
      const sorted = recs.sort((a, b) => {
        // created_at 또는 레코드 생성 시간으로 정렬
        const aTime = a.createdTime || '';
        const bTime = b.createdTime || '';
        return bTime.localeCompare(aTime);
      });
      toDelete.push(...sorted.slice(1).map(r => r.id));
    }
  });

  console.log(`   중복 발견: ${toDelete.length}개`);

  if (toDelete.length > 0) {
    if (dryRun) {
      console.log(`   [DRY-RUN] 삭제 예정: ${toDelete.length}개`);
    } else {
      console.log(`   삭제 중...`);
      await deleteRecords(config.baseId, config.tableId, toDelete);
      console.log(`   ✅ ${toDelete.length}개 삭제 완료`);
    }
  }

  return { duplicatesFound: keyMap.size - records.length + toDelete.length, deleted: dryRun ? 0 : toDelete.length };
}

// 환율 미적용 찾기 및 수정
async function fixCurrency(clientName, config, startDate, endDate, dryRun) {
  console.log(`\n💱 ${clientName} 환율 검사 중...`);

  const records = await fetchAllRecords(config.baseId, config.tableId, startDate, endDate);

  const toUpdate = [];

  records.forEach(r => {
    const { spend, impressions } = r.fields;
    // 조건: impressions >= 100 이고 spend > 0 이고 spend < 1000 이면 환율 미적용
    if ((impressions || 0) >= 100 && spend > 0 && spend < 1000) {
      toUpdate.push({
        id: r.id,
        fields: { spend: Math.round(spend * USD_TO_KRW) }
      });
    }
  });

  console.log(`   환율 미적용 발견: ${toUpdate.length}개`);

  if (toUpdate.length > 0) {
    if (dryRun) {
      console.log(`   [DRY-RUN] 수정 예정: ${toUpdate.length}개`);
      toUpdate.slice(0, 5).forEach(u => {
        const original = records.find(r => r.id === u.id);
        console.log(`     - ${original.fields.date} ${original.fields.device}: $${original.fields.spend} → ₩${u.fields.spend}`);
      });
    } else {
      console.log(`   수정 중...`);
      await updateRecords(config.baseId, config.tableId, toUpdate);
      console.log(`   ✅ ${toUpdate.length}개 수정 완료`);
    }
  }

  return { issuesFound: toUpdate.length, fixed: dryRun ? 0 : toUpdate.length };
}

// 메인 함수
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Self-Healing Auto-Fix Script

사용법:
  node auto-fix.js --client "H.E.A 판교" --days 30
  node auto-fix.js --all --days 30
  node auto-fix.js --all --days 30 --dry-run

옵션:
  --client <name>   클라이언트 지정
  --all             모든 클라이언트
  --days <n>        오늘부터 n일 전까지
  --start <date>    시작일
  --end <date>      종료일
  --dry-run         실제 수정 안함, 미리보기만
    `);
    return;
  }

  const dryRun = args.includes('--dry-run');

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
      return;
    }
  } else {
    console.error('❌ --client 또는 --all 옵션 필수!');
    return;
  }

  console.log('🔧 Self-Healing Auto-Fix 시작');
  console.log(`📅 기간: ${startDate} ~ ${endDate}`);
  console.log(`👥 대상: ${clients.join(', ')}`);
  if (dryRun) console.log('🏃 DRY-RUN 모드 (실제 수정 안함)');

  const results = {};

  for (const clientName of clients) {
    const config = AIRTABLE_CONFIG[clientName];
    results[clientName] = { duplicates: {}, currency: {} };

    try {
      // 1. 중복 제거
      results[clientName].duplicates = await fixDuplicates(clientName, config, startDate, endDate, dryRun);

      // 2. 환율 수정
      results[clientName].currency = await fixCurrency(clientName, config, startDate, endDate, dryRun);

    } catch (error) {
      console.error(`❌ ${clientName} 오류: ${error.message}`);
      results[clientName].error = error.message;
    }
  }

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('📊 Auto-Fix 결과 요약');
  console.log('='.repeat(60));

  let totalDuplicatesDeleted = 0;
  let totalCurrencyFixed = 0;

  for (const [name, result] of Object.entries(results)) {
    if (result.error) {
      console.log(`❌ ${name}: ${result.error}`);
    } else {
      console.log(`✅ ${name}:`);
      console.log(`   - 중복 삭제: ${result.duplicates.deleted}개`);
      console.log(`   - 환율 수정: ${result.currency.fixed}개`);
      totalDuplicatesDeleted += result.duplicates.deleted || 0;
      totalCurrencyFixed += result.currency.fixed || 0;
    }
  }

  console.log('='.repeat(60));

  // 텔레그램 알림
  if (!dryRun && (totalDuplicatesDeleted > 0 || totalCurrencyFixed > 0)) {
    await sendTelegram(
      `🔧 <b>Auto-Fix 완료</b>\n\n` +
      `📅 기간: ${startDate} ~ ${endDate}\n\n` +
      `자동 수정 내역:\n` +
      `  - 중복 삭제: ${totalDuplicatesDeleted}건\n` +
      `  - 환율 수정: ${totalCurrencyFixed}건`
    );
  }
}

main().catch(console.error);
