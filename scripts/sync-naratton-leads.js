#!/usr/bin/env node
/**
 * 나라똔 홈페이지 리드 데이터 → Airtable 동기화 스크립트
 *
 * 1. MongoDB(나라똔 홈페이지)에서 상담 신청 데이터 조회
 * 2. Airtable 나라똔_리드상세 테이블에 저장 (중복 방지)
 * 3. 일별 집계하여 광고 데이터 테이블의 leads 필드 업데이트
 *
 * 사용법:
 *   node sync-naratton-leads.js --days 30        # 최근 30일 동기화
 *   node sync-naratton-leads.js --start 2026-01-01 --end 2026-01-28
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });

const { MongoClient } = require('mongodb');

// 환경변수
const MONGODB_URI = process.env.NARATTON_MONGODB_URI || process.env.MONGODB_URI;
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKFILL_CHAT_ID = '-1003394139746';

// Airtable 설정
const NARATTON_BASE_ID = 'appN2KzUoORRrb8X9';
const LEADS_TABLE_ID = 'tblmOcJ5eRYJdrAzT';  // 나라똔_리드상세
const ADS_TABLE_ID = 'tblmC9Ft2ioXKXsrL';    // 광고 데이터 (Table 1)

/**
 * 텔레그램 알림
 */
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: BACKFILL_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error('텔레그램 알림 실패:', e.message);
  }
}

/**
 * MongoDB에서 상담 신청 데이터 조회
 */
async function fetchMongoLeads(startDate, endDate) {
  if (!MONGODB_URI) {
    console.error('❌ NARATTON_MONGODB_URI 또는 MONGODB_URI 환경변수 필요');
    return [];
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('naraddon');
    const collection = db.collection('consultations');

    const query = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      },
    };

    const leads = await collection.find(query).sort({ createdAt: -1 }).toArray();
    console.log(`📥 MongoDB에서 ${leads.length}건 조회`);

    return leads;
  } finally {
    await client.close();
  }
}

/**
 * Airtable에서 기존 리드 조회 (중복 체크용)
 */
async function getExistingLeadIds() {
  const existingIds = new Set();
  let offset = '';

  do {
    let url = `https://api.airtable.com/v0/${NARATTON_BASE_ID}/${LEADS_TABLE_ID}?fields[]=mongodb_id`;
    if (offset) url += `&offset=${offset}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await res.json();
    if (data.error) break;

    for (const record of data.records || []) {
      if (record.fields.mongodb_id) {
        existingIds.add(record.fields.mongodb_id);
      }
    }

    offset = data.offset || '';
  } while (offset);

  return existingIds;
}

/**
 * Airtable에 리드 저장
 */
async function saveLeadsToAirtable(leads) {
  if (leads.length === 0) return 0;

  let savedCount = 0;
  const batchSize = 10;

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);

    const records = batch.map(lead => ({
      fields: {
        '신청일': lead.createdAt ? new Date(lead.createdAt).toISOString().split('T')[0] : null,
        '이름': lead.userName || lead.name || '',
        '연락처': lead.userPhone || lead.phone || '',
        '이메일': lead.userEmail || lead.email || '',
        '회사명': lead.companyName || '',
        '상담유형': lead.consultationType || (lead.isExaminerConsultation ? '기업심사관 상담' : '전문가 상담'),
        '상담분야': normalizeConsultField(lead.consultationField || lead.consultType),
        '지역': lead.region || '',
        '연매출': lead.annualRevenue || '',
        '직원수': lead.employeeCount || '',
        '메시지': lead.message || '',
        'mongodb_id': lead._id.toString(),
        '동기화일시': new Date().toISOString(),
      },
    }));

    const res = await fetch(`https://api.airtable.com/v0/${NARATTON_BASE_ID}/${LEADS_TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records }),
    });

    const data = await res.json();
    if (data.records) {
      savedCount += data.records.length;
    }

    // Rate limit 방지
    await new Promise(r => setTimeout(r, 200));
  }

  return savedCount;
}

/**
 * 상담분야 정규화
 */
function normalizeConsultField(field) {
  if (!field) return null;

  const mapping = {
    'government': '정부지원금',
    'certification': '인증',
    'startup': '창업',
    'legal': '법무·특허',
    'tax': '세무·회계',
    '정부지원금': '정부지원금',
    '인증': '인증',
    '창업': '창업',
    '법무·특허': '법무·특허',
    '세무·회계': '세무·회계',
  };

  return mapping[field] || '기타';
}

/**
 * 일별 리드 집계
 */
function aggregateByDate(leads) {
  const daily = {};

  for (const lead of leads) {
    const date = lead.createdAt
      ? new Date(lead.createdAt).toISOString().split('T')[0]
      : null;

    if (!date) continue;

    if (!daily[date]) {
      daily[date] = 0;
    }
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
    // 해당 날짜의 광고 레코드 조회
    const formula = encodeURIComponent(`{date}='${date}'`);
    const url = `https://api.airtable.com/v0/${NARATTON_BASE_ID}/${ADS_TABLE_ID}?filterByFormula=${formula}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await res.json();
    if (data.error || !data.records?.length) continue;

    // 각 레코드의 leads 업데이트 (디바이스별 분배 또는 첫 번째에 합산)
    // 여기서는 모든 레코드에 동일한 leads 값 설정 (집계용)
    const totalRecords = data.records.length;
    const leadsPerRecord = Math.floor(leadsCount / totalRecords);
    const remainder = leadsCount % totalRecords;

    for (let i = 0; i < data.records.length; i++) {
      const record = data.records[i];
      const recordLeads = i === 0 ? leadsPerRecord + remainder : leadsPerRecord;

      // leads가 0이면 스킵
      if (recordLeads === 0 && i > 0) continue;

      await fetch(`https://api.airtable.com/v0/${NARATTON_BASE_ID}/${ADS_TABLE_ID}/${record.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: { leads: recordLeads },
        }),
      });

      updatedCount++;
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return updatedCount;
}

/**
 * 메인 함수
 */
async function main() {
  console.log('🔄 나라똔 리드 데이터 동기화 시작\n');

  const args = process.argv.slice(2);

  // 날짜 계산
  let startDate, endDate;
  const daysIndex = args.indexOf('--days');
  const startIndex = args.indexOf('--start');
  const endIndex = args.indexOf('--end');

  if (daysIndex !== -1) {
    const days = parseInt(args[daysIndex + 1]) || 30;
    endDate = new Date().toISOString().split('T')[0];
    const start = new Date();
    start.setDate(start.getDate() - days);
    startDate = start.toISOString().split('T')[0];
  } else {
    startDate = startIndex !== -1 ? args[startIndex + 1] : null;
    endDate = endIndex !== -1 ? args[endIndex + 1] : new Date().toISOString().split('T')[0];
  }

  if (!startDate) {
    // 기본: 최근 30일
    const start = new Date();
    start.setDate(start.getDate() - 30);
    startDate = start.toISOString().split('T')[0];
    endDate = new Date().toISOString().split('T')[0];
  }

  console.log(`📅 기간: ${startDate} ~ ${endDate}\n`);

  try {
    // 1. MongoDB에서 리드 조회
    console.log('1️⃣ MongoDB에서 리드 데이터 조회...');
    const mongoLeads = await fetchMongoLeads(startDate, endDate);

    if (mongoLeads.length === 0) {
      console.log('   ⚠️ 해당 기간 리드 데이터 없음');
      return;
    }

    // 2. 기존 리드 ID 조회 (중복 방지)
    console.log('\n2️⃣ 기존 동기화된 리드 확인...');
    const existingIds = await getExistingLeadIds();
    console.log(`   기존: ${existingIds.size}건`);

    // 3. 새 리드 필터링
    const newLeads = mongoLeads.filter(lead => !existingIds.has(lead._id.toString()));
    console.log(`   신규: ${newLeads.length}건`);

    // 4. Airtable에 저장
    if (newLeads.length > 0) {
      console.log('\n3️⃣ Airtable에 리드 저장...');
      const savedCount = await saveLeadsToAirtable(newLeads);
      console.log(`   ✅ ${savedCount}건 저장 완료`);
    }

    // 5. 일별 집계
    console.log('\n4️⃣ 일별 리드 집계...');
    const dailyLeads = aggregateByDate(mongoLeads);
    const dates = Object.keys(dailyLeads).sort();

    console.log('   일별 현황:');
    for (const date of dates.slice(-7)) {
      console.log(`   - ${date}: ${dailyLeads[date]}건`);
    }

    // 6. 광고 데이터 leads 필드 업데이트
    console.log('\n5️⃣ 광고 데이터 leads 필드 업데이트...');
    const updatedCount = await updateAdsLeads(dailyLeads);
    console.log(`   ✅ ${updatedCount}건 업데이트`);

    // 결과 요약
    const totalLeads = mongoLeads.length;
    console.log('\n' + '='.repeat(50));
    console.log('📊 동기화 완료');
    console.log('='.repeat(50));
    console.log(`   기간: ${startDate} ~ ${endDate}`);
    console.log(`   총 리드: ${totalLeads}건`);
    console.log(`   신규 저장: ${newLeads.length}건`);
    console.log(`   광고 데이터 업데이트: ${updatedCount}건`);

    // 텔레그램 알림
    await sendTelegram(
      `✅ <b>나라똔 리드 동기화 완료</b>\n\n` +
      `📅 기간: ${startDate} ~ ${endDate}\n` +
      `📊 총 리드: ${totalLeads}건\n` +
      `🆕 신규 저장: ${newLeads.length}건\n` +
      `📝 광고 데이터 업데이트: ${updatedCount}건`
    );

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    console.error(error.stack);

    await sendTelegram(
      `❌ <b>나라똔 리드 동기화 실패</b>\n\n` +
      `오류: ${error.message}`
    );

    process.exit(1);
  }
}

main();
