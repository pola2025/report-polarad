#!/usr/bin/env node
/**
 * Polarad Meta - Supabase → Airtable 마이그레이션
 *
 * 사용법:
 *   node migrate-to-airtable.js --client "H.E.A 판교"
 *   node migrate-to-airtable.js --all
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const AIRTABLE_CONFIG = {
  'H.E.A 판교': {
    clientId: '3ff2896e-6786-4936-9c57-311f69f43c63',
    baseId: process.env.AIRTABLE_HEA_BASE_ID,
    tableId: process.env.AIRTABLE_HEA_TABLE_ID,
  },
  '나라똔': {
    clientId: 'c2f60730-f8c1-4361-b9fc-3b44725c3955',
    baseId: process.env.AIRTABLE_NARATTON_BASE_ID,
    tableId: process.env.AIRTABLE_NARATTON_TABLE_ID,
  },
};

// Airtable에서 기존 레코드 조회
async function findExistingRecord(baseId, tableId, date, source, device) {
  const formula = `AND({date}='${date}', {source}='${source}', {device}='${device}')`;
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  });

  const data = await response.json();
  return data.records?.[0] || null;
}

// Airtable 레코드 생성
async function createRecord(baseId, tableId, fields) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  return response.json();
}

// Airtable 레코드 업데이트
async function updateRecord(baseId, tableId, recordId, fields) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  return response.json();
}

// Supabase에서 Meta 데이터 조회 및 집계
async function fetchAndAggregateMetaData(clientId) {
  console.log('  Supabase에서 데이터 조회 중...');

  const { data, error } = await supabase
    .from('polarad_meta_data')
    .select('date, device, impressions, clicks, spend')
    .eq('client_id', clientId)
    .order('date', { ascending: true });

  if (error) {
    throw new Error(`Supabase 조회 실패: ${error.message}`);
  }

  console.log(`  원본 레코드: ${data.length}개`);

  // 일별 + 디바이스별 집계
  const aggregated = {};

  data.forEach(row => {
    // device 정규화 (desktop → pc, mobile_app → mobile 등)
    let device = (row.device || 'unknown').toLowerCase();
    if (device === 'desktop' || device === 'pc') device = 'pc';
    else if (device.includes('mobile') || device === 'android' || device === 'ios') device = 'mobile';
    else device = 'other';

    const key = `${row.date}_${device}`;

    if (!aggregated[key]) {
      aggregated[key] = {
        date: row.date,
        device: device,
        impressions: 0,
        clicks: 0,
        spend: 0,
        source: 'meta',
        campaign_name: '',
        keywords: '',
        is_finalized: false,
      };
    }

    aggregated[key].impressions += row.impressions || 0;
    aggregated[key].clicks += row.clicks || 0;
    aggregated[key].spend += Math.round(row.spend || 0);
  });

  const records = Object.values(aggregated);
  console.log(`  집계 후 레코드: ${records.length}개`);

  return records;
}

// Airtable에 upsert
async function upsertToAirtable(baseId, tableId, records) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const { date, source, device } = record;

    // 진행률 표시
    if ((i + 1) % 50 === 0 || i === records.length - 1) {
      console.log(`  진행: ${i + 1}/${records.length}`);
    }

    try {
      const existing = await findExistingRecord(baseId, tableId, date, source, device);

      if (existing) {
        // 이미 월마감 데이터면 스킵
        if (existing.fields.is_finalized === true) {
          skipped++;
          continue;
        }
        await updateRecord(baseId, tableId, existing.id, record);
        updated++;
      } else {
        await createRecord(baseId, tableId, record);
        created++;
      }

      // Rate limit 방지
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`  오류 (${date} ${device}): ${e.message}`);
    }
  }

  return { created, updated, skipped };
}

// 클라이언트 마이그레이션
async function migrateClient(clientName) {
  const config = AIRTABLE_CONFIG[clientName];
  if (!config) {
    console.error(`❌ 설정 없음: ${clientName}`);
    return;
  }

  console.log(`\n📦 ${clientName} 마이그레이션 시작`);

  try {
    // Supabase에서 데이터 조회 및 집계
    const records = await fetchAndAggregateMetaData(config.clientId);

    if (records.length === 0) {
      console.log('  ⚠️ 마이그레이션할 데이터 없음');
      return;
    }

    // Airtable에 upsert
    console.log('  Airtable에 저장 중...');
    const result = await upsertToAirtable(config.baseId, config.tableId, records);

    console.log(`  ✅ 완료: 생성 ${result.created}, 업데이트 ${result.updated}, 스킵 ${result.skipped}`);
  } catch (e) {
    console.error(`  ❌ 오류: ${e.message}`);
  }
}

// 메인 함수
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Supabase → Airtable 마이그레이션

사용법:
  node migrate-to-airtable.js --client "H.E.A 판교"
  node migrate-to-airtable.js --all
    `);
    return;
  }

  console.log('🚀 Supabase → Airtable 마이그레이션');

  const clientIndex = args.indexOf('--client');

  if (args.includes('--all')) {
    for (const clientName of Object.keys(AIRTABLE_CONFIG)) {
      await migrateClient(clientName);
    }
  } else if (clientIndex !== -1) {
    const clientName = args[clientIndex + 1];
    await migrateClient(clientName);
  } else {
    console.log('❌ --client 또는 --all 옵션을 지정하세요');
  }

  console.log('\n✅ 마이그레이션 완료');
}

main().catch(console.error);
