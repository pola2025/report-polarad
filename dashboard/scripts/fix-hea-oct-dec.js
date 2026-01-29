#!/usr/bin/env node
/**
 * HEA 판교 데이터 수정 스크립트
 *
 * 1. 10월(2025-10) Meta 데이터 전체 삭제
 * 2. 11월(2025-11) Meta 데이터: spend × 1500 환율 적용
 * 3. 12월 1~28일(2025-12-01~28) Meta 데이터: spend × 1500 환율 적용
 *
 * 사용법:
 *   node --env-file=.env.local scripts/fix-hea-oct-dec.js
 *
 *   DRY_RUN=true node --env-file=.env.local scripts/fix-hea-oct-dec.js
 */

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
if (!AIRTABLE_TOKEN) {
  console.error('AIRTABLE_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const BASE_ID = 'appJlOqnadLsMJQYw';
const TABLE_ID = 'tbl8ftclEFG5ypohX';
const EXCHANGE_RATE = 1500;
const DRY_RUN = process.env.DRY_RUN === 'true';

const API_BASE = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

async function fetchRecords(filterFormula) {
  const records = [];
  let offset = '';

  do {
    const formula = encodeURIComponent(filterFormula);
    let url = `${API_BASE}?filterByFormula=${formula}&pageSize=100`;
    if (offset) url += `&offset=${offset}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const data = await res.json();

    if (data.error) {
      console.error('Airtable 조회 오류:', data.error);
      throw new Error(data.error.message);
    }

    records.push(...(data.records || []));
    offset = data.offset || '';
  } while (offset);

  return records;
}

async function deleteRecord(recordId) {
  if (DRY_RUN) return true;

  const res = await fetch(`${API_BASE}/${recordId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  });
  return res.ok;
}

async function updateRecord(recordId, fields) {
  if (DRY_RUN) return true;

  const res = await fetch(`${API_BASE}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await res.json();
  if (data.error) {
    console.error(`업데이트 오류 (${recordId}):`, data.error);
    return false;
  }
  return true;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 1. 10월 데이터 삭제 =====
async function deleteOctober() {
  console.log('\n=== 1단계: 10월(2025-10) Meta 데이터 삭제 ===\n');

  const formula = `AND({date}>='2025-10-01', {date}<='2025-10-31', {source}='meta')`;
  const records = await fetchRecords(formula);

  console.log(`10월 Meta 레코드: ${records.length}개`);

  if (records.length === 0) {
    console.log('삭제할 레코드 없음');
    return { total: 0, deleted: 0 };
  }

  // 샘플 출력
  const sample = records.slice(0, 3);
  sample.forEach(r => {
    console.log(`  ${r.fields.date} | ${r.fields.device} | spend=${r.fields.spend} | ${r.fields.campaign_name || r.fields.ad_id || ''}`);
  });
  if (records.length > 3) console.log(`  ... 외 ${records.length - 3}개`);

  if (DRY_RUN) {
    console.log(`[DRY_RUN] ${records.length}개 레코드 삭제 예정`);
    return { total: records.length, deleted: 0 };
  }

  let deleted = 0;
  for (const r of records) {
    const ok = await deleteRecord(r.id);
    if (ok) deleted++;
    await sleep(200);
  }

  console.log(`삭제 완료: ${deleted}/${records.length}`);
  return { total: records.length, deleted };
}

// ===== 2. 11월 데이터 환율 적용 =====
async function fixNovember() {
  console.log('\n=== 2단계: 11월(2025-11) Meta 데이터 환율 적용 ===\n');

  const formula = `AND({date}>='2025-11-01', {date}<='2025-11-30', {source}='meta')`;
  const records = await fetchRecords(formula);

  console.log(`11월 Meta 레코드: ${records.length}개`);

  if (records.length === 0) {
    console.log('수정할 레코드 없음');
    return { total: 0, updated: 0, skipped: 0 };
  }

  // 이미 환율 적용된 데이터 감지
  // HEA 판교 하루 예산 ~$17-19 → KRW 25,500-28,500
  // USD 값이면 spend < 100, KRW 값이면 spend > 1000
  const needsFix = records.filter(r => {
    const spend = r.fields.spend || 0;
    // spend가 100 미만이면 USD로 간주 (환율 미적용 상태)
    return spend > 0 && spend < 100;
  });

  const alreadyFixed = records.filter(r => {
    const spend = r.fields.spend || 0;
    return spend >= 100;
  });

  console.log(`환율 적용 필요: ${needsFix.length}개 (USD 값 감지)`);
  console.log(`이미 적용됨: ${alreadyFixed.length}개 (KRW 값 감지)`);

  // 샘플 출력
  if (needsFix.length > 0) {
    console.log('\n[수정 대상 샘플]');
    needsFix.slice(0, 5).forEach(r => {
      const spend = r.fields.spend || 0;
      console.log(`  ${r.fields.date} | ${r.fields.device} | USD $${spend.toFixed(2)} → KRW ₩${Math.round(spend * EXCHANGE_RATE).toLocaleString()}`);
    });
  }

  if (DRY_RUN) {
    console.log(`\n[DRY_RUN] ${needsFix.length}개 레코드 환율 적용 예정 (×${EXCHANGE_RATE})`);
    return { total: records.length, updated: 0, skipped: alreadyFixed.length };
  }

  let updated = 0;
  for (const r of needsFix) {
    const spendUsd = r.fields.spend || 0;
    const spendKrw = Math.round(spendUsd * EXCHANGE_RATE);

    const ok = await updateRecord(r.id, { spend: spendKrw });
    if (ok) updated++;
    await sleep(200);
  }

  console.log(`환율 적용 완료: ${updated}/${needsFix.length}`);
  return { total: records.length, updated, skipped: alreadyFixed.length };
}

// ===== 3. 12월 1~28일 데이터 환율 적용 =====
async function fixDecember() {
  console.log('\n=== 3단계: 12월 1~28일(2025-12) Meta 데이터 환율 적용 ===\n');

  const formula = `AND({date}>='2025-12-01', {date}<='2025-12-28', {source}='meta')`;
  const records = await fetchRecords(formula);

  console.log(`12월 1~28일 Meta 레코드: ${records.length}개`);

  if (records.length === 0) {
    console.log('수정할 레코드 없음');
    return { total: 0, updated: 0, skipped: 0 };
  }

  const needsFix = records.filter(r => {
    const spend = r.fields.spend || 0;
    return spend > 0 && spend < 100;
  });

  const alreadyFixed = records.filter(r => {
    const spend = r.fields.spend || 0;
    return spend >= 100;
  });

  console.log(`환율 적용 필요: ${needsFix.length}개 (USD 값 감지)`);
  console.log(`이미 적용됨: ${alreadyFixed.length}개 (KRW 값 감지)`);

  if (needsFix.length > 0) {
    console.log('\n[수정 대상 샘플]');
    needsFix.slice(0, 5).forEach(r => {
      const spend = r.fields.spend || 0;
      console.log(`  ${r.fields.date} | ${r.fields.device} | USD $${spend.toFixed(2)} → KRW ₩${Math.round(spend * EXCHANGE_RATE).toLocaleString()}`);
    });
  }

  if (DRY_RUN) {
    console.log(`\n[DRY_RUN] ${needsFix.length}개 레코드 환율 적용 예정 (×${EXCHANGE_RATE})`);
    return { total: records.length, updated: 0, skipped: alreadyFixed.length };
  }

  let updated = 0;
  for (const r of needsFix) {
    const spendUsd = r.fields.spend || 0;
    const spendKrw = Math.round(spendUsd * EXCHANGE_RATE);

    const ok = await updateRecord(r.id, { spend: spendKrw });
    if (ok) updated++;
    await sleep(200);
  }

  console.log(`환율 적용 완료: ${updated}/${needsFix.length}`);
  return { total: records.length, updated, skipped: alreadyFixed.length };
}

// ===== 메인 실행 =====
async function main() {
  console.log('========================================');
  console.log('  HEA 판교 데이터 수정 스크립트');
  console.log('  Base: appJlOqnadLsMJQYw (HEA 판교)');
  console.log('  Table: tbl8ftclEFG5ypohX');
  console.log(`  환율: 1 USD = ${EXCHANGE_RATE} KRW`);
  if (DRY_RUN) console.log('  [DRY_RUN 모드 - 실제 변경 없음]');
  console.log('========================================');

  const oct = await deleteOctober();
  const nov = await fixNovember();
  const dec = await fixDecember();

  console.log('\n========================================');
  console.log('  최종 결과');
  console.log('========================================');
  console.log(`10월: ${oct.total}개 중 ${oct.deleted}개 삭제`);
  console.log(`11월: ${nov.total}개 중 ${nov.updated}개 환율 적용 (${nov.skipped}개 스킵)`);
  console.log(`12월: ${dec.total}개 중 ${dec.updated}개 환율 적용 (${dec.skipped}개 스킵)`);
  console.log('========================================');
}

main().catch(err => {
  console.error('스크립트 실행 오류:', err);
  process.exit(1);
});
