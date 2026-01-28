#!/usr/bin/env node
/**
 * 나라똔 리드 데이터 → Airtable 광고 데이터 leads 필드 업데이트
 * dashboard 디렉토리에서 실행 (node_modules 사용)
 */

require('dotenv').config({ path: '.env.local' });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const NARATTON_BASE_ID = 'appN2KzUoORRrb8X9';
const LEADS_TABLE_ID = 'tblmOcJ5eRYJdrAzT';  // 나라똔_리드상세
const ADS_TABLE_ID = 'tblmC9Ft2ioXKXsrL';    // 광고 데이터 (Table 1)

/**
 * Airtable에서 리드 데이터 조회 (날짜 범위)
 */
async function fetchLeadsFromAirtable(startDate, endDate) {
  const allRecords = [];
  let offset = '';

  // endDate + 1일 (inclusive)
  const endDateObj = new Date(endDate);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDatePlusOne = endDateObj.toISOString().split('T')[0];

  do {
    const formula = encodeURIComponent(
      `AND({신청일}>='${startDate}', {신청일}<'${endDatePlusOne}')`
    );
    let url = `https://api.airtable.com/v0/${NARATTON_BASE_ID}/${LEADS_TABLE_ID}?filterByFormula=${formula}`;
    if (offset) url += `&offset=${offset}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await response.json();
    if (data.error) {
      console.error('Airtable 에러:', data.error);
      break;
    }

    for (const record of data.records || []) {
      allRecords.push({
        신청일: record.fields['신청일'],
        이름: record.fields['이름'],
      });
    }

    offset = data.offset || '';
  } while (offset);

  return allRecords;
}

/**
 * 일별 리드 집계
 */
function aggregateByDate(leads) {
  const daily = {};
  for (const lead of leads) {
    const date = lead['신청일'];
    if (!date) continue;
    if (!daily[date]) daily[date] = 0;
    daily[date]++;
  }
  return daily;
}

/**
 * 광고 데이터 테이블의 leads 필드 업데이트
 */
async function updateAdsLeads(dailyLeads) {
  let updatedCount = 0;

  for (const [date, leadsCount] of Object.entries(dailyLeads)) {
    // 해당 날짜의 광고 레코드 조회 (Date 타입이므로 DATESTR 함수 사용)
    const formula = encodeURIComponent(`AND(DATESTR({date})='${date}', {source}='meta')`);
    const url = `https://api.airtable.com/v0/${NARATTON_BASE_ID}/${ADS_TABLE_ID}?filterByFormula=${formula}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await res.json();
    if (data.error || !data.records?.length) {
      console.log(`  ${date}: 광고 데이터 없음`);
      continue;
    }

    // 첫 번째 레코드에 leads 합산
    const record = data.records[0];
    await fetch(`https://api.airtable.com/v0/${NARATTON_BASE_ID}/${ADS_TABLE_ID}/${record.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: { homepage_leads: leadsCount },  // 홈페이지 리드 (녹색)
      }),
    });

    console.log(`  ${date}: ${leadsCount}건 업데이트`);
    updatedCount++;
    await new Promise(r => setTimeout(r, 100));
  }

  return updatedCount;
}

/**
 * 메인
 */
async function main() {
  console.log('🔄 나라똔 리드 → 광고 데이터 leads 필드 업데이트\n');

  const args = process.argv.slice(2);
  const daysIndex = args.indexOf('--days');
  const days = daysIndex !== -1 ? parseInt(args[daysIndex + 1]) || 30 : 30;

  const endDate = new Date().toISOString().split('T')[0];
  const startDateObj = new Date();
  startDateObj.setDate(startDateObj.getDate() - days);
  const startDate = startDateObj.toISOString().split('T')[0];

  console.log(`📅 기간: ${startDate} ~ ${endDate}\n`);

  // 1. 리드 데이터 조회
  console.log('1️⃣ Airtable 리드 테이블에서 조회...');
  const leads = await fetchLeadsFromAirtable(startDate, endDate);
  console.log(`   총 ${leads.length}건 조회\n`);

  if (leads.length === 0) {
    console.log('⚠️ 해당 기간 리드 데이터 없음');
    return;
  }

  // 2. 일별 집계
  console.log('2️⃣ 일별 집계...');
  const dailyLeads = aggregateByDate(leads);
  const dates = Object.keys(dailyLeads).sort();

  for (const date of dates) {
    console.log(`   ${date}: ${dailyLeads[date]}건`);
  }

  // 3. 광고 데이터 업데이트
  console.log('\n3️⃣ 광고 데이터 leads 필드 업데이트...');
  const updatedCount = await updateAdsLeads(dailyLeads);

  console.log('\n' + '='.repeat(50));
  console.log('✅ 완료');
  console.log(`   리드: ${leads.length}건`);
  console.log(`   업데이트: ${updatedCount}건`);
}

main().catch(console.error);
