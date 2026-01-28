#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const baseId = 'appJlOqnadLsMJQYw';
const tableId = 'tbl8ftclEFG5ypohX';

async function check() {
  // 방법 1: 정확한 날짜 매칭
  const formula1 = `{date}="2026-01-17"`;
  const url1 = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula1)}`;

  const res1 = await fetch(url1, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data1 = await res1.json();

  console.log('방법 1 (정확한 매칭):');
  console.log('레코드 수:', data1.records?.length || 0);
  data1.records?.forEach(r => {
    console.log(' -', r.fields.date, r.fields.device, r.fields.source);
  });

  // 방법 2: 전체 조회 (최근 100개)
  const url2 = `https://api.airtable.com/v0/${baseId}/${tableId}?maxRecords=100&sort[0][field]=date&sort[0][direction]=desc`;

  const res2 = await fetch(url2, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data2 = await res2.json();

  console.log('\n방법 2 (최근 100개 중 1월 17일):');
  const jan17 = data2.records?.filter(r => r.fields.date === '2026-01-17') || [];
  console.log('1월 17일 레코드:', jan17.length);
  jan17.forEach(r => {
    console.log(' -', r.fields.date, r.fields.device, r.fields.source, r.id);
  });

  // 최근 날짜 목록
  console.log('\n최근 날짜 목록:');
  const dates = [...new Set(data2.records?.map(r => r.fields.date))].sort().reverse().slice(0, 15);
  dates.forEach(d => console.log(' -', d));
}

check();
