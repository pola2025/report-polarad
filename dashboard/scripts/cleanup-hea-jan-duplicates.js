#!/usr/bin/env node
/**
 * HEA 판교 1월 7~17일 중복 데이터 정리
 */
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

async function deleteRecord(recordId) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  return res.ok;
}

async function cleanup() {
  console.log('=== HEA 판교 1월 7~17일 중복 정리 ===\n');

  const records = await fetchAllRecords();
  console.log('총 레코드:', records.length);

  // 중복 찾기 (date + device 기준)
  const seen = {};
  const toDelete = [];

  for (const r of records) {
    const key = `${r.fields.date}_${r.fields.device}`;
    if (seen[key]) {
      toDelete.push(r.id);
    } else {
      seen[key] = r.id;
    }
  }

  console.log('중복 레코드:', toDelete.length);

  if (toDelete.length === 0) {
    console.log('중복 없음');
    return;
  }

  console.log('\n삭제 시작...');
  for (const id of toDelete) {
    await deleteRecord(id);
    console.log('삭제:', id);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n=== 완료 ===');
}

cleanup().catch(console.error);
