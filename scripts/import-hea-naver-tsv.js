#!/usr/bin/env node
/**
 * H.E.A 판교 네이버 플레이스 광고 TSV 데이터 → Airtable 입력
 *
 * TSV 컬럼 (탭 구분):
 * 날짜, 고객ID, 캠페인ID, 그룹ID, -, 광고ID, 사업장ID, ?, 시간, ?, 디바이스(P/M), 노출, 클릭, 비용, ?, ?
 *
 * 사용법:
 *   node import-hea-naver-tsv.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const fs = require('fs');
const path = require('path');

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const HEA_BASE_ID = process.env.AIRTABLE_HEA_BASE_ID;
const HEA_TABLE_ID = process.env.AIRTABLE_HEA_TABLE_ID;

// TSV 파일 경로
const TSV_PATH = path.resolve(__dirname, '../brand-search-raw-data.tsv');

// TSV 파싱 및 일별+디바이스별 집계
function parseTSV(content) {
  const lines = content.trim().split('\n');
  const aggregated = {};

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 14) continue;

    const dateRaw = parts[0]; // 20251215
    const deviceCode = parts[10]; // P or M
    const impressions = parseInt(parts[11]) || 0;
    const clicks = parseInt(parts[12]) || 0;
    const spend = parseFloat(parts[13]) || 0;

    // 날짜 변환 (20251215 → 2025-12-15)
    const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;

    // 디바이스 변환
    const device = deviceCode === 'P' ? 'pc' : 'mobile';

    const key = `${date}_${device}`;

    if (!aggregated[key]) {
      aggregated[key] = {
        date,
        device,
        impressions: 0,
        clicks: 0,
        spend: 0,
        source: 'naver_place',
        campaign_name: '플레이스광고',
        keywords: '',
        is_finalized: false, // 백필 데이터
      };
    }

    aggregated[key].impressions += impressions;
    aggregated[key].clicks += clicks;
    aggregated[key].spend += Math.round(spend);
  }

  return Object.values(aggregated);
}

// Airtable에서 기존 레코드 조회
async function findExistingRecord(date, source, device) {
  const formula = `AND({date}='${date}', {source}='${source}', {device}='${device}')`;
  const url = `https://api.airtable.com/v0/${HEA_BASE_ID}/${HEA_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  });

  const data = await response.json();
  return data.records?.[0] || null;
}

// Airtable 레코드 생성
async function createRecord(fields) {
  const url = `https://api.airtable.com/v0/${HEA_BASE_ID}/${HEA_TABLE_ID}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  return response.json();
}

// Airtable 레코드 업데이트
async function updateRecord(recordId, fields) {
  const url = `https://api.airtable.com/v0/${HEA_BASE_ID}/${HEA_TABLE_ID}/${recordId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  return response.json();
}

// 메인 함수
async function main() {
  console.log('🚀 H.E.A 판교 네이버 플레이스 광고 데이터 가져오기');
  console.log(`📄 파일: ${TSV_PATH}`);

  // TSV 파일 읽기
  if (!fs.existsSync(TSV_PATH)) {
    console.error('❌ TSV 파일을 찾을 수 없습니다:', TSV_PATH);
    return;
  }

  const content = fs.readFileSync(TSV_PATH, 'utf-8');
  const records = parseTSV(content);

  console.log(`📊 집계된 레코드: ${records.length}개`);

  // 통계
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let totalImpressions = 0;
  let totalClicks = 0;

  // Airtable에 upsert
  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    totalImpressions += record.impressions;
    totalClicks += record.clicks;

    if ((i + 1) % 10 === 0 || i === records.length - 1) {
      console.log(`  진행: ${i + 1}/${records.length}`);
    }

    try {
      const existing = await findExistingRecord(record.date, record.source, record.device);

      if (existing) {
        // 이미 월마감 데이터면 스킵
        if (existing.fields.is_finalized === true) {
          skipped++;
          continue;
        }
        await updateRecord(existing.id, record);
        updated++;
      } else {
        await createRecord(record);
        created++;
      }

      // Rate limit 방지
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`  오류 (${record.date} ${record.device}): ${e.message}`);
    }
  }

  console.log('\n=== 결과 ===');
  console.log(`생성: ${created}개`);
  console.log(`업데이트: ${updated}개`);
  console.log(`스킵 (월마감): ${skipped}개`);
  console.log(`총 노출: ${totalImpressions.toLocaleString()}`);
  console.log(`총 클릭: ${totalClicks.toLocaleString()}`);
  console.log('✅ 완료');
}

main().catch(console.error);
