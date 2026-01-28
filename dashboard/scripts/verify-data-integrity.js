#!/usr/bin/env node
/**
 * HEA 판교 1월 7~17일 데이터 정합성 확인
 * Meta API vs Airtable 비교
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const baseId = 'appJlOqnadLsMJQYw';
const tableId = 'tbl8ftclEFG5ypohX';
const USD_TO_KRW = 1490;

async function fetchMetaData(accessToken, adAccountId, start, end) {
  const fields = 'date_start,impressions,clicks,spend';
  const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?` +
    `fields=${fields}` +
    `&time_range={"since":"${start}","until":"${end}"}` +
    `&time_increment=1` +
    `&level=account` +
    `&access_token=${accessToken}`;

  const res = await fetch(url);
  const data = await res.json();
  return data.data || [];
}

async function fetchAirtableData(start, end) {
  let allRecords = [];
  let offset = null;

  do {
    let url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula={source}="meta"`;
    if (offset) url += `&offset=${offset}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  // 날짜 필터
  return allRecords.filter(r => r.fields.date >= start && r.fields.date <= end);
}

async function verify() {
  console.log('=== HEA 판교 데이터 정합성 검증 ===\n');
  console.log('기간: 2026-01-07 ~ 2026-01-17\n');

  const { data: client } = await supabase
    .from('polarad_clients')
    .select('meta_ad_account_id, meta_access_token')
    .eq('slug', 'hea-pangyo')
    .single();

  // Meta API 데이터
  const metaData = await fetchMetaData(client.meta_access_token, client.meta_ad_account_id, '2026-01-07', '2026-01-17');
  const metaByDate = {};
  metaData.forEach(row => {
    metaByDate[row.date_start] = {
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      spend: Math.round((parseFloat(row.spend) || 0) * USD_TO_KRW)
    };
  });

  // Airtable 데이터
  const airtableData = await fetchAirtableData('2026-01-07', '2026-01-17');
  const airtableByDate = {};
  airtableData.forEach(r => {
    const f = r.fields;
    if (!airtableByDate[f.date]) {
      airtableByDate[f.date] = { impressions: 0, clicks: 0, spend: 0 };
    }
    airtableByDate[f.date].impressions += f.impressions || 0;
    airtableByDate[f.date].clicks += f.clicks || 0;
    airtableByDate[f.date].spend += f.spend || 0;
  });

  // 비교
  console.log('날짜       | Meta API         | Airtable         | 차이');
  console.log('-'.repeat(70));

  let totalMeta = { impressions: 0, clicks: 0, spend: 0 };
  let totalAirtable = { impressions: 0, clicks: 0, spend: 0 };
  let issues = [];

  for (let d = 7; d <= 17; d++) {
    const date = `2026-01-${String(d).padStart(2, '0')}`;
    const meta = metaByDate[date] || { impressions: 0, clicks: 0, spend: 0 };
    const at = airtableByDate[date] || { impressions: 0, clicks: 0, spend: 0 };

    totalMeta.impressions += meta.impressions;
    totalMeta.clicks += meta.clicks;
    totalMeta.spend += meta.spend;

    totalAirtable.impressions += at.impressions;
    totalAirtable.clicks += at.clicks;
    totalAirtable.spend += at.spend;

    const impDiff = at.impressions - meta.impressions;
    const clickDiff = at.clicks - meta.clicks;
    const spendDiff = at.spend - meta.spend;

    const status = (impDiff === 0 && clickDiff === 0 && Math.abs(spendDiff) < 100) ? '✅' : '⚠️';

    if (status === '⚠️') {
      issues.push({ date, impDiff, clickDiff, spendDiff });
    }

    console.log(`${date} | ${String(meta.impressions).padStart(6)} / ${String(meta.clicks).padStart(4)} / ${meta.spend.toLocaleString().padStart(8)} | ${String(at.impressions).padStart(6)} / ${String(at.clicks).padStart(4)} / ${at.spend.toLocaleString().padStart(8)} | ${status}`);
  }

  console.log('-'.repeat(70));
  console.log(`합계       | ${String(totalMeta.impressions).padStart(6)} / ${String(totalMeta.clicks).padStart(4)} / ${totalMeta.spend.toLocaleString().padStart(8)} | ${String(totalAirtable.impressions).padStart(6)} / ${String(totalAirtable.clicks).padStart(4)} / ${totalAirtable.spend.toLocaleString().padStart(8)}`);

  console.log('\n=== 결과 ===');
  if (issues.length === 0) {
    console.log('✅ 데이터 정합성 확인됨');
  } else {
    console.log(`⚠️ ${issues.length}개 날짜에 불일치 발견:`);
    issues.forEach(i => {
      console.log(`  ${i.date}: 노출 ${i.impDiff}, 클릭 ${i.clickDiff}, 비용 ${i.spendDiff}원 차이`);
    });
  }
}

verify().catch(console.error);
