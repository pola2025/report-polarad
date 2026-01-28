#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const baseId = 'appJlOqnadLsMJQYw';
const tableId = 'tbl8ftclEFG5ypohX';

async function fetchAllRecords() {
  const formula = `AND({date}>="2026-01-07", {date}<="2026-01-17", {source}="meta")`;
  let allRecords = [];
  let offset = null;

  do {
    let url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}`;
    if (offset) url += `&offset=${offset}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

async function check() {
  console.log('HEA 판교 1월 7~17일 Meta 데이터 (페이지네이션 포함):');

  const records = await fetchAllRecords();
  console.log('총 레코드:', records.length);

  // 일별 합계
  const byDate = {};
  records.forEach(r => {
    const f = r.fields;
    if (!byDate[f.date]) byDate[f.date] = { impressions: 0, clicks: 0, spend: 0 };
    byDate[f.date].impressions += f.impressions || 0;
    byDate[f.date].clicks += f.clicks || 0;
    byDate[f.date].spend += f.spend || 0;
  });

  console.log('\n일별 합계:');
  Object.entries(byDate).sort().forEach(([date, d]) => {
    console.log(`${date}: 노출 ${d.impressions}, 클릭 ${d.clicks}, 비용 ${d.spend.toLocaleString()}원`);
  });

  // 1월 17일 확인
  const jan17 = records.filter(r => r.fields.date === '2026-01-17');
  console.log('\n1월 17일 상세:');
  if (jan17.length === 0) {
    console.log('  ❌ 데이터 없음');
  } else {
    jan17.forEach(r => {
      const f = r.fields;
      console.log(`  ${f.device}: 노출 ${f.impressions}, 클릭 ${f.clicks}, 비용 ${f.spend}`);
    });
  }
}

check();
