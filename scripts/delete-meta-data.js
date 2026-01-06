#!/usr/bin/env node
/**
 * Airtable Meta 데이터 삭제 스크립트
 * campaign_name이 빈 값인 레코드만 삭제하거나 전체 삭제
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_HEA_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_HEA_TABLE_ID;

async function deleteRecords(recordIds) {
  // Airtable은 한 번에 10개까지만 삭제 가능
  const chunks = [];
  for (let i = 0; i < recordIds.length; i += 10) {
    chunks.push(recordIds.slice(i, i + 10));
  }

  let deleted = 0;
  for (const chunk of chunks) {
    const params = chunk.map(id => `records[]=${id}`).join('&');
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });

    const data = await res.json();
    if (data.error) {
      console.error('삭제 오류:', data.error);
    } else {
      deleted += data.records?.length || 0;
    }

    // Rate limit 방지
    await new Promise(r => setTimeout(r, 200));
  }

  return deleted;
}

async function main() {
  const args = process.argv.slice(2);
  const deleteAll = args.includes('--all');

  console.log('🗑️  Airtable Meta 데이터 삭제');
  console.log(deleteAll ? '   모드: 전체 삭제' : '   모드: campaign_name 빈 값만 삭제');

  // Meta 데이터 조회
  let formula;
  if (deleteAll) {
    formula = encodeURIComponent("{source}='meta'");
  } else {
    formula = encodeURIComponent("AND({source}='meta', {campaign_name}='')");
  }

  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${formula}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();

  if (!data.records?.length) {
    console.log('   삭제할 레코드 없음');
    return;
  }

  console.log(`   삭제 대상: ${data.records.length}개 레코드`);

  const recordIds = data.records.map(r => r.id);
  const deleted = await deleteRecords(recordIds);

  console.log(`   ✅ ${deleted}개 레코드 삭제 완료`);
}

main().catch(console.error);
