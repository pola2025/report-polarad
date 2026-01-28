#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const baseId = 'appJlOqnadLsMJQYw';
const tableId = 'tbl8ftclEFG5ypohX';

async function check() {
  const formula = `AND({date}="2026-01-17", {source}="meta")`;
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();

  console.log('2026-01-17 Meta 데이터:', data.records?.length || 0, '개');
  data.records?.forEach(r => {
    const f = r.fields;
    console.log(`  ${f.device}: 노출 ${f.impressions}, 클릭 ${f.clicks}, 비용 ${f.spend}`);
  });
}

check();
