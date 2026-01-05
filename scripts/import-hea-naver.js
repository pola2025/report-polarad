/**
 * H.E.A 판교 네이버 플레이스 데이터 Import 스크립트
 * CSV → Airtable (일별 집계)
 */

const fs = require('fs');
const path = require('path');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = 'appJlOqnadLsMJQYw';
const TABLE_ID = 'tbl8ftclEFG5ypohX';

// CSV 파일 경로
const CSV_PATH = 'c:/Users/flame/Downloads/월간리포트,hea_pangyo_naver (1).csv';

async function main() {
  // CSV 읽기
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  // 헤더 건너뛰기 (첫 2줄)
  const dataLines = lines.slice(2);

  // 일별 집계
  const dailyData = {};

  dataLines.forEach(line => {
    // CSV 파싱 (쉼표로 분리, 따옴표 처리)
    const parts = line.split(',');
    if (parts.length < 7) return;

    const date = parts[0].trim().replace(/\./g, '-').slice(0, 10); // 2025.12.14. → 2025-12-14
    const impressions = parseInt(parts[2]) || 0;
    const clicks = parseInt(parts[3]) || 0;
    const cost = parseInt(parts[6].replace(/[^0-9]/g, '')) || 0;

    if (!dailyData[date]) {
      dailyData[date] = { impressions: 0, clicks: 0, spend: 0 };
    }

    dailyData[date].impressions += impressions;
    dailyData[date].clicks += clicks;
    dailyData[date].spend += cost;
  });

  console.log('일별 집계 결과:');
  const dates = Object.keys(dailyData).sort();
  let totalImp = 0, totalClicks = 0, totalSpend = 0;
  dates.forEach(date => {
    const d = dailyData[date];
    totalImp += d.impressions;
    totalClicks += d.clicks;
    totalSpend += d.spend;
    console.log(`${date}: 노출 ${d.impressions}, 클릭 ${d.clicks}, 비용 ${d.spend}`);
  });
  console.log(`---\n총계: 노출 ${totalImp}, 클릭 ${totalClicks}, 비용 ${totalSpend}`);
  console.log(`레코드 수: ${dates.length}`);

  // Airtable에 추가
  console.log('\nAirtable에 추가 중...');

  for (const date of dates) {
    const d = dailyData[date];
    const record = {
      fields: {
        date: date,
        device: 'all',
        impressions: d.impressions,
        clicks: d.clicks,
        spend: d.spend,
        source: 'naver_place',
        is_finalized: true,
      }
    };

    const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(record),
    });

    if (response.ok) {
      console.log(`✓ ${date} 추가 완료`);
    } else {
      const err = await response.json();
      console.error(`✗ ${date} 실패:`, err);
    }

    // Rate limit 방지
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n완료!');
}

main().catch(console.error);
