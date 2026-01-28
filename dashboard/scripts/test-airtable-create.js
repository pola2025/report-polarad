#!/usr/bin/env node
/**
 * Airtable 레코드 생성 테스트
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const baseId = 'appJlOqnadLsMJQYw';
const tableId = 'tbl8ftclEFG5ypohX';

async function testCreate() {
  console.log('=== Airtable 레코드 생성 테스트 ===\n');

  const testRecord = {
    date: '2026-01-17',
    source: 'meta',
    device: 'desktop',
    impressions: 9,
    clicks: 1,
    spend: 30
  };

  console.log('생성할 레코드:', testRecord);

  const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: testRecord })
  });

  const data = await res.json();
  console.log('\nAirtable 응답:');
  console.log(JSON.stringify(data, null, 2));
}

testCreate().catch(console.error);
