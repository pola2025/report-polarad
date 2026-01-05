#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const baseId = 'appN2KzUoORRrb8X9';
const tableId = 'tblmC9Ft2ioXKXsrL';

async function check() {
  // 최근 30개 레코드 조회
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?maxRecords=30&sort[0][field]=date&sort[0][direction]=desc`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });

  const data = await res.json();

  console.log('=== 나라똔 에어테이블 최근 데이터 ===\n');
  console.log('총 레코드:', data.records?.length || 0);
  console.log('\n날짜별 데이터:');

  data.records?.forEach(r => {
    const f = r.fields;
    console.log(`  ${f.date} | ${f.source} | 노출:${f.impressions} | 클릭:${f.clicks} | 비용:${f.spend || 0}`);
  });

  // source별 집계
  const sources = {};
  data.records?.forEach(r => {
    const s = r.fields.source || 'unknown';
    if (!sources[s]) sources[s] = { count: 0, spend: 0 };
    sources[s].count++;
    sources[s].spend += r.fields.spend || 0;
  });

  console.log('\nsource별 집계:');
  Object.entries(sources).forEach(([k, v]) => {
    console.log(`  ${k}: ${v.count}건, 총비용: ${v.spend}원`);
  });
}

check().catch(console.error);
