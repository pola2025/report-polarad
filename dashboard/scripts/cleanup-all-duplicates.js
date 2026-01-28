#!/usr/bin/env node
/**
 * HEA 판교 전체 중복 데이터 정리
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const baseId = 'appJlOqnadLsMJQYw';
const tableId = 'tbl8ftclEFG5ypohX';

async function fetchAllRecords() {
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

  return allRecords;
}

async function deleteRecord(recordId) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  return res.ok;
}

async function cleanup() {
  console.log('=== HEA 판교 전체 Meta 데이터 중복 정리 ===\n');

  const records = await fetchAllRecords();
  console.log('총 Meta 레코드:', records.length);

  // 중복 찾기 (date + device 기준)
  const seen = {};
  const toDelete = [];

  for (const r of records) {
    const key = `${r.fields.date}_${r.fields.device}`;
    if (seen[key]) {
      toDelete.push({ id: r.id, date: r.fields.date, device: r.fields.device });
    } else {
      seen[key] = r.id;
    }
  }

  console.log('중복 레코드:', toDelete.length);

  // 1월 17일 중복 확인
  const jan17Dup = toDelete.filter(r => r.date === '2026-01-17');
  console.log('1월 17일 중복:', jan17Dup.length);

  if (toDelete.length === 0) {
    console.log('\n중복 없음');
    return;
  }

  console.log('\n삭제 시작...');
  let deleted = 0;
  for (const r of toDelete) {
    const ok = await deleteRecord(r.id);
    if (ok) {
      deleted++;
      if (r.date === '2026-01-17') {
        console.log(`삭제: ${r.id} (${r.date} ${r.device})`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n=== 완료 ===`);
  console.log(`삭제됨: ${deleted}/${toDelete.length}`);
}

cleanup().catch(console.error);
