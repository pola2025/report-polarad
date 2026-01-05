#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;

async function checkClient(name, baseId, tableId) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();

  console.log(`\n=== ${name} ===`);
  console.log('총 레코드:', data.records?.length);

  // source별 집계
  const bySource = {};
  (data.records || []).forEach(r => {
    const src = r.fields.source || 'unknown';
    if (!bySource[src]) {
      bySource[src] = { count: 0, spend: 0, impressions: 0 };
    }
    bySource[src].count++;
    bySource[src].spend += r.fields.spend || 0;
    bySource[src].impressions += r.fields.impressions || 0;
  });

  console.log('\nSource별:');
  Object.entries(bySource).forEach(([src, d]) => {
    console.log(`  ${src}: ${d.count}개, spend=${d.spend}, impressions=${d.impressions}`);
  });
}

async function main() {
  await checkClient('H.E.A 판교', process.env.AIRTABLE_HEA_BASE_ID, process.env.AIRTABLE_HEA_TABLE_ID);
  await checkClient('나라똔', process.env.AIRTABLE_NARATTON_BASE_ID, process.env.AIRTABLE_NARATTON_TABLE_ID);
}

main();
