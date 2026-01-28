#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const baseId = 'appJlOqnadLsMJQYw';
const tableId = 'tbl8ftclEFG5ypohX';

async function check() {
  const formula = `AND({date}>="2026-01-07", {date}<="2026-01-17", {source}="meta")`;
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();

  console.log('HEA 판교 1월 7~17일 Meta 데이터:');
  console.log('총 레코드:', data.records?.length || 0);

  // 일별 합계
  const byDate = {};
  data.records?.forEach(r => {
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
}

check();
