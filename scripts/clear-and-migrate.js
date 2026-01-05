#!/usr/bin/env node
/**
 * Airtable 데이터 정리 후 Supabase에서 재마이그레이션
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;

const CLIENTS = {
  'hea-pangyo': {
    name: 'H.E.A 판교',
    clientId: '3ff2896e-6786-4936-9c57-311f69f43c63',
    baseId: process.env.AIRTABLE_HEA_BASE_ID,
    tableId: process.env.AIRTABLE_HEA_TABLE_ID,
  },
  'naratton': {
    name: '나라똔',
    clientId: 'c2f60730-f8c1-4361-b9fc-3b44725c3955',
    baseId: process.env.AIRTABLE_NARATTON_BASE_ID,
    tableId: process.env.AIRTABLE_NARATTON_TABLE_ID,
  },
};

// Airtable 모든 레코드 삭제
async function clearAirtable(baseId, tableId) {
  let deleted = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}?maxRecords=100`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });
    const data = await res.json();

    if (!data.records || data.records.length === 0) {
      hasMore = false;
      continue;
    }

    // 10개씩 삭제 (Airtable 제한)
    for (let i = 0; i < data.records.length; i += 10) {
      const batch = data.records.slice(i, i + 10);
      const ids = batch.map(r => `records[]=${r.id}`).join('&');
      const deleteUrl = `https://api.airtable.com/v0/${baseId}/${tableId}?${ids}`;

      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      });

      deleted += batch.length;
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`    삭제됨: ${deleted}개`);
  }

  return deleted;
}

// Airtable에 레코드 생성 (10개씩 배치)
async function createRecords(baseId, tableId, records, excludeLeads = false) {
  let created = 0;

  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;

    // H.E.A 판교는 leads 필드 제외
    const preparedRecords = batch.map(r => {
      const fields = { ...r };
      if (excludeLeads) {
        delete fields.leads;
      }
      return { fields };
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: preparedRecords })
    });

    const result = await res.json();
    if (result.error) {
      console.error('    오류:', result.error.message);
    }

    created += batch.length;

    if ((i + 10) % 50 === 0 || i + 10 >= records.length) {
      console.log(`    생성됨: ${created}/${records.length}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  return created;
}

// Supabase에서 Meta 데이터 조회 및 집계
async function fetchMetaData(clientId) {
  const { data, error } = await supabase
    .from('polarad_meta_data')
    .select('date, device, impressions, clicks, spend, leads')
    .eq('client_id', clientId)
    .order('date', { ascending: true });

  if (error) throw new Error(`Supabase 조회 실패: ${error.message}`);

  // 일별 + 디바이스별 집계
  const aggregated = {};

  data.forEach(row => {
    let device = (row.device || 'unknown').toLowerCase();
    if (device === 'desktop' || device === 'pc') device = 'pc';
    else if (device.includes('mobile') || device === 'android' || device === 'ios') device = 'mobile';
    else device = 'other';

    const key = `${row.date}_meta_${device}`;

    if (!aggregated[key]) {
      aggregated[key] = {
        date: row.date,
        device: device,
        impressions: 0,
        clicks: 0,
        spend: 0,
        leads: 0,
        source: 'meta',
        campaign_name: '',
        keywords: '',
        is_finalized: false,
      };
    }

    aggregated[key].impressions += row.impressions || 0;
    aggregated[key].clicks += row.clicks || 0;
    aggregated[key].spend += Math.round(row.spend || 0);
    aggregated[key].leads += row.leads || 0;
  });

  return Object.values(aggregated);
}

// Supabase에서 Naver 데이터 조회 (H.E.A 판교용 - place)
async function fetchNaverPlaceData(clientId) {
  const { data, error } = await supabase
    .from('polarad_naver_data')
    .select('date, impressions, clicks, total_cost')
    .eq('client_id', clientId)
    .order('date', { ascending: true });

  if (error) return [];

  // 일별 집계
  const aggregated = {};

  data.forEach(row => {
    const key = `${row.date}_naver_place`;

    if (!aggregated[key]) {
      aggregated[key] = {
        date: row.date,
        device: 'all',
        impressions: 0,
        clicks: 0,
        spend: 0,
        leads: 0,
        source: 'naver_place',
        campaign_name: '네이버 플레이스',
        keywords: '',
        is_finalized: false,
      };
    }

    aggregated[key].impressions += row.impressions || 0;
    aggregated[key].clicks += row.clicks || 0;
    aggregated[key].spend += row.total_cost || 0;
  });

  return Object.values(aggregated);
}

async function migrateClient(slug) {
  const config = CLIENTS[slug];
  if (!config) {
    console.error(`설정 없음: ${slug}`);
    return;
  }

  console.log(`\n📦 ${config.name} 마이그레이션`);

  // 1. Airtable 정리
  console.log('  1. Airtable 기존 데이터 삭제 중...');
  const deleted = await clearAirtable(config.baseId, config.tableId);
  console.log(`     삭제 완료: ${deleted}개`);

  // 2. Meta 데이터 가져오기
  console.log('  2. Supabase Meta 데이터 조회 중...');
  const metaRecords = await fetchMetaData(config.clientId);
  console.log(`     Meta 레코드: ${metaRecords.length}개`);

  // 3. Naver 데이터 (H.E.A 판교만)
  let naverRecords = [];
  if (slug === 'hea-pangyo') {
    console.log('  3. Supabase Naver 플레이스 데이터 조회 중...');
    naverRecords = await fetchNaverPlaceData(config.clientId);
    console.log(`     Naver 레코드: ${naverRecords.length}개`);
  }

  // 4. Airtable에 저장 (H.E.A 판교는 leads 필드 제외)
  const allRecords = [...metaRecords, ...naverRecords];
  const excludeLeads = (slug === 'hea-pangyo');
  console.log(`  4. Airtable에 저장 중... (총 ${allRecords.length}개)${excludeLeads ? ' [leads 제외]' : ''}`);
  const created = await createRecords(config.baseId, config.tableId, allRecords, excludeLeads);

  console.log(`  ✅ 완료: ${created}개 생성`);

  // 검증
  const metaSpend = metaRecords.reduce((sum, r) => sum + r.spend, 0);
  const metaImpressions = metaRecords.reduce((sum, r) => sum + r.impressions, 0);
  console.log(`  📊 Meta 검증: spend=${metaSpend}, impressions=${metaImpressions}`);
}

async function main() {
  console.log('🚀 Airtable 데이터 정리 및 재마이그레이션\n');

  await migrateClient('hea-pangyo');
  await migrateClient('naratton');

  console.log('\n✅ 전체 마이그레이션 완료');
}

main().catch(console.error);
