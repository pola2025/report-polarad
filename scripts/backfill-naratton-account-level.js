#!/usr/bin/env node
/**
 * 나라똔 Meta 데이터 백필 (Account Level)
 *
 * 나라똔은 campaign 레벨 데이터가 없어서 account 레벨로 집계
 * device breakdown만 사용
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_NARATTON_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_NARATTON_TABLE_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

// 나라똔 Ad Account ID
const NARATTON_AD_ACCOUNT_ID = '1875881526682240';

// 환율 (USD → KRW)
const USD_TO_KRW = 1490;

// Meta API 호출 (account level, device breakdown)
async function fetchMetaData(startDate, endDate) {
  const fields = [
    'date_start',
    'impressions',
    'clicks',
    'spend',
    'actions',
    'video_p100_watched_actions',
    'video_avg_time_watched_actions',
  ].join(',');

  const url = `https://graph.facebook.com/v21.0/act_${NARATTON_AD_ACCOUNT_ID}/insights?` +
    `fields=${fields}&` +
    `breakdowns=device_platform&` +
    `time_range={"since":"${startDate}","until":"${endDate}"}&` +
    `time_increment=1&` +
    `level=account&` +
    `limit=1000&` +
    `access_token=${META_ACCESS_TOKEN}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Meta API 오류: ${data.error.message}`);
  }

  return data.data || [];
}

// Airtable에서 기존 레코드 조회
async function findExistingRecord(date, device) {
  const formula = `AND({date}='${date}', {source}='meta', {device}='${device}')`;
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  });

  const data = await response.json();
  return data.records?.[0] || null;
}

// Airtable에 레코드 생성
async function createRecord(fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Airtable 생성 오류: ${data.error.message}`);
  }
  return data;
}

// Airtable 레코드 업데이트
async function updateRecord(recordId, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Airtable 업데이트 오류: ${data.error.message}`);
  }
  return data;
}

// 메인 함수
async function main() {
  const args = process.argv.slice(2);
  const startIndex = args.indexOf('--start');
  const endIndex = args.indexOf('--end');

  if (startIndex === -1 || endIndex === -1) {
    console.error('❌ 사용법: node backfill-naratton-account-level.js --start 2024-12-06 --end 2024-12-17');
    return;
  }

  const startDate = args[startIndex + 1];
  const endDate = args[endIndex + 1];

  console.log('🚀 나라똔 Meta 데이터 백필 (Account Level)');
  console.log(`📅 기간: ${startDate} ~ ${endDate}`);

  // Meta API 호출
  const rawData = await fetchMetaData(startDate, endDate);
  console.log(`\n📊 Meta API: ${rawData.length}개 레코드`);

  if (rawData.length === 0) {
    console.log('⚠️  데이터 없음');
    return;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rawData) {
    const date = row.date_start;
    const device = row.device_platform?.toLowerCase() || 'unknown';
    const spendUsd = parseFloat(row.spend) || 0;
    const spendKrw = Math.round(spendUsd * USD_TO_KRW);
    const impressions = parseInt(row.impressions) || 0;
    const clicks = parseInt(row.clicks) || 0;
    const leads = row.actions?.find(a => a.action_type === 'lead')?.value || 0;
    const videoViews = row.video_p100_watched_actions?.[0]?.value || 0;
    const avgWatchTime = row.video_avg_time_watched_actions?.[0]?.value || 0;

    const record = {
      date,
      device,
      impressions,
      clicks,
      leads: parseInt(leads),
      spend: spendKrw,
      source: 'meta',
      campaign_name: '',
      keywords: '',
      is_finalized: false,
      video_views: parseInt(videoViews) || 0,
      avg_watch_time: parseFloat(avgWatchTime) || 0,
    };

    // 기존 레코드 확인
    const existing = await findExistingRecord(date, device);

    if (existing) {
      // 월마감 데이터는 건드리지 않음
      if (existing.fields.is_finalized === true) {
        console.log(`   [스킵] ${date} ${device} - 월마감 데이터`);
        skipped++;
        continue;
      }
      // 업데이트
      await updateRecord(existing.id, record);
      console.log(`   [업데이트] ${date} ${device} - spend: ${spendKrw} KRW (${spendUsd} USD)`);
      updated++;
    } else {
      // 생성
      await createRecord(record);
      console.log(`   [생성] ${date} ${device} - spend: ${spendKrw} KRW (${spendUsd} USD)`);
      created++;
    }

    // Rate limit 방지
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 백필 완료');
  console.log('='.repeat(50));
  console.log(`✅ 생성: ${created}개`);
  console.log(`🔄 업데이트: ${updated}개`);
  console.log(`⏭️  스킵: ${skipped}개`);
}

main().catch(console.error);
