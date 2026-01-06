#!/usr/bin/env node
/**
 * Airtable 중복 데이터 정리 스크립트
 *
 * 기존 ad_id 기반 데이터를 삭제하고, campaign_name 기반 데이터만 유지
 * 또한 10월 이전 데이터 삭제 옵션 제공
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const AIRTABLE_CONFIG = {
  'H.E.A 판교': {
    baseId: process.env.AIRTABLE_HEA_BASE_ID,
    tableId: process.env.AIRTABLE_HEA_TABLE_ID,
  },
};

// 텔레그램 설정
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

// Airtable 레코드 조회 (페이지네이션)
async function fetchAllRecords(baseId, tableId, filterFormula = '') {
  const allRecords = [];
  let offset;

  do {
    let url = `https://api.airtable.com/v0/${baseId}/${tableId}?pageSize=100`;
    if (filterFormula) {
      url += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
    }
    if (offset) {
      url += `&offset=${offset}`;
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const data = await response.json();

    if (data.error) {
      console.error('Airtable 조회 오류:', data.error);
      break;
    }

    allRecords.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return allRecords;
}

// Airtable 레코드 삭제 (최대 10개씩)
async function deleteRecords(baseId, tableId, recordIds) {
  let deleted = 0;

  for (let i = 0; i < recordIds.length; i += 10) {
    const batch = recordIds.slice(i, i + 10);
    const params = batch.map(id => `records[]=${id}`).join('&');
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}?${params}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await response.json();
    if (data.error) {
      console.error('삭제 오류:', data.error);
    } else {
      deleted += data.records?.length || 0;
    }

    // Rate limit 방지
    await new Promise(r => setTimeout(r, 250));
  }

  return deleted;
}

async function main() {
  const args = process.argv.slice(2);
  const clientName = 'H.E.A 판교';
  const config = AIRTABLE_CONFIG[clientName];

  if (!config) {
    console.error('Airtable 설정 없음');
    return;
  }

  console.log('🔍 Airtable 데이터 분석 중...');

  // 모든 Meta 레코드 조회
  const allRecords = await fetchAllRecords(config.baseId, config.tableId, `{source}='meta'`);
  console.log(`📊 총 Meta 레코드: ${allRecords.length}개`);

  // 분류
  const withAdId = allRecords.filter(r => r.fields.ad_id && r.fields.ad_id.trim() !== '');
  const withoutAdId = allRecords.filter(r => !r.fields.ad_id || r.fields.ad_id.trim() === '');
  const beforeOctober = allRecords.filter(r => r.fields.date && r.fields.date < '2025-10-01');

  // 중복 체크 (date + campaign_name + device)
  const keyMap = new Map();
  const duplicates = [];
  for (const r of allRecords) {
    const key = `${r.fields.date}|${r.fields.campaign_name || ''}|${r.fields.device || ''}`;
    if (keyMap.has(key)) {
      duplicates.push(r.id);  // 두 번째 이후 레코드는 중복
    } else {
      keyMap.set(key, r.id);
    }
  }

  console.log(`\n📈 데이터 분류:`);
  console.log(`   - ad_id 있음 (기존): ${withAdId.length}개`);
  console.log(`   - ad_id 없음 (새로운): ${withoutAdId.length}개`);
  console.log(`   - 중복 레코드: ${duplicates.length}개`);
  console.log(`   - 10월 이전: ${beforeOctober.length}개`);

  // 삭제 대상 결정
  const toDelete = [];

  // 1. 중복 레코드 삭제
  if (args.includes('--delete-duplicates') || args.includes('--all')) {
    toDelete.push(...duplicates);
    console.log(`\n🗑️ 중복 레코드 삭제 예정: ${duplicates.length}개`);
  }

  // 2. ad_id가 있는 레코드 삭제 (기존 광고별 데이터)
  if (args.includes('--delete-ad-id') || args.includes('--all')) {
    const adIdRecords = withAdId.map(r => r.id).filter(id => !toDelete.includes(id));
    toDelete.push(...adIdRecords);
    console.log(`🗑️ ad_id 있는 레코드 삭제 예정: ${adIdRecords.length}개`);
  }

  // 3. 10월 이전 데이터 삭제
  if (args.includes('--delete-before-october') || args.includes('--all')) {
    const beforeOctIds = beforeOctober.map(r => r.id).filter(id => !toDelete.includes(id));
    toDelete.push(...beforeOctIds);
    console.log(`🗑️ 10월 이전 레코드 삭제 예정: ${beforeOctIds.length}개`);
  }

  if (toDelete.length === 0) {
    console.log('\n⚠️ 삭제할 레코드가 없습니다.');
    console.log('\n사용법:');
    console.log('  node cleanup-duplicates.js --delete-duplicates      # 중복 레코드 삭제');
    console.log('  node cleanup-duplicates.js --delete-ad-id           # ad_id 있는 레코드 삭제');
    console.log('  node cleanup-duplicates.js --delete-before-october  # 10월 이전 삭제');
    console.log('  node cleanup-duplicates.js --all                    # 모두 삭제');
    console.log('  --force 옵션 추가 시 실제 삭제 실행');
    return;
  }

  // 확인
  if (!args.includes('--force')) {
    console.log(`\n⚠️ 총 ${toDelete.length}개 레코드가 삭제됩니다.`);
    console.log('   실행하려면 --force 옵션을 추가하세요.');
    return;
  }

  // 삭제 실행
  console.log(`\n🗑️ ${toDelete.length}개 레코드 삭제 중...`);
  await sendTelegram(`🗑️ <b>Airtable 정리 시작</b>\n\n클라이언트: ${clientName}\n삭제 예정: ${toDelete.length}개`);

  const deleted = await deleteRecords(config.baseId, config.tableId, toDelete);

  console.log(`✅ 삭제 완료: ${deleted}개`);
  await sendTelegram(`✅ <b>Airtable 정리 완료</b>\n\n삭제됨: ${deleted}개`);
}

main().catch(console.error);
