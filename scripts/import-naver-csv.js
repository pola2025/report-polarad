#!/usr/bin/env node
/**
 * 나라똔 네이버 브랜드검색 CSV 데이터 → Airtable 입력
 *
 * 사용법:
 *   node import-naver-csv.js "c:\path\to\file.csv"
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const fs = require('fs');
const path = require('path');

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const NARATTON_BASE_ID = process.env.AIRTABLE_NARATTON_BASE_ID;
const NARATTON_TABLE_ID = process.env.AIRTABLE_NARATTON_TABLE_ID;

// CSV 파싱
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const records = [];

  // 헤더 스킵 (첫 2줄)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 5) continue;

    const campaign = parts[0];
    const dateStr = parts[1]; // 2025.12.03.
    const adGroup = parts[2]; // 브랜드검색광고_PC or 브랜드검색광고_모바일
    const impressions = parseInt(parts[3]) || 0;
    const clicks = parseInt(parts[4]) || 0;

    // 날짜 변환 (2025.12.03. → 2025-12-03)
    const date = dateStr.replace(/\./g, '-').slice(0, -1);

    // 디바이스 추출
    let device = 'unknown';
    if (adGroup.includes('PC')) device = 'pc';
    else if (adGroup.includes('모바일')) device = 'mobile';

    records.push({
      date,
      device,
      impressions,
      clicks,
      spend: 0,
      source: 'naver_brand_search',
      campaign_name: campaign,
      keywords: '',
      is_finalized: true, // 월마감 데이터
    });
  }

  return records;
}

// Airtable에서 기존 레코드 조회
async function findExistingRecord(date, source, device) {
  const formula = `AND({date}='${date}', {source}='${source}', {device}='${device}')`;
  const url = `https://api.airtable.com/v0/${NARATTON_BASE_ID}/${NARATTON_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  });

  const data = await response.json();
  return data.records?.[0] || null;
}

// Airtable 레코드 생성
async function createRecord(fields) {
  const url = `https://api.airtable.com/v0/${NARATTON_BASE_ID}/${NARATTON_TABLE_ID}`;

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
  const url = `https://api.airtable.com/v0/${NARATTON_BASE_ID}/${NARATTON_TABLE_ID}/${recordId}`;

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
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.log('사용법: node import-naver-csv.js "c:\\path\\to\\file.csv"');
    return;
  }

  console.log('🚀 나라똔 네이버 브랜드검색 데이터 가져오기');
  console.log(`📄 파일: ${csvPath}`);

  // CSV 파일 읽기
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parseCSV(content);

  console.log(`📊 파싱된 레코드: ${records.length}개`);

  // 통계
  let created = 0;
  let updated = 0;
  let totalImpressions = 0;
  let totalClicks = 0;

  // Airtable에 upsert
  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    totalImpressions += record.impressions;
    totalClicks += record.clicks;

    if ((i + 1) % 20 === 0 || i === records.length - 1) {
      console.log(`  진행: ${i + 1}/${records.length}`);
    }

    try {
      const existing = await findExistingRecord(record.date, record.source, record.device);

      if (existing) {
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
  console.log(`총 노출: ${totalImpressions.toLocaleString()}`);
  console.log(`총 클릭: ${totalClicks.toLocaleString()}`);
  console.log('✅ 완료');
}

main().catch(console.error);
