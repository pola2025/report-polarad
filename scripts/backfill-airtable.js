#!/usr/bin/env node
/**
 * Polarad Meta - Airtable 백필 스크립트 (캠페인 레벨)
 *
 * Meta API에서 데이터를 수집하여 Airtable에 저장
 * Upsert 로직: date + source + device 조합으로 중복 방지
 *
 * ⚠️ 주의: HEA 판교는 이 스크립트 사용 금지! (광고 레벨 backfill-meta-ads.js 사용)
 *
 * 사용법:
 *   node backfill-airtable.js --client "나라똔" --days 30
 *   node backfill-airtable.js --client "나라똔" --start 2025-01-01 --end 2025-01-05
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const AIRTABLE_CONFIG = {
  'H.E.A 판교': {
    baseId: process.env.AIRTABLE_HEA_BASE_ID,
    tableId: process.env.AIRTABLE_HEA_TABLE_ID,
  },
  '나라똔': {
    baseId: process.env.AIRTABLE_NARATTON_BASE_ID,
    tableId: process.env.AIRTABLE_NARATTON_TABLE_ID,
  },
};

// 텔레그램 설정
const BACKFILL_CHAT_ID = '-1003394139746';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// 통계
const stats = {
  totalRecords: 0,
  clientResults: {},
  errors: [],
};

// 텔레그램 알림
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
      }),
    });
  } catch (e) {
    console.error('텔레그램 알림 실패:', e.message);
  }
}

// actions 배열에서 특정 action_type 값 추출
function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find((a) => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

// Meta API 호출
async function fetchMetaData(accessToken, adAccountId, startDate, endDate) {
  const fields = [
    'date_start',
    'campaign_id',
    'campaign_name',
    'impressions',
    'clicks',
    'spend',
    'actions',
    'video_p100_watched_actions',
    'video_avg_time_watched_actions',
  ].join(',');

  // 일별 + 캠페인별 + 디바이스별 집계
  const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?` +
    `fields=${fields}&` +
    `breakdowns=device_platform&` +
    `time_range={"since":"${startDate}","until":"${endDate}"}&` +
    `time_increment=1&` +
    `level=campaign&` +
    `limit=1000&` +
    `access_token=${accessToken}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Meta API 오류: ${data.error.message}`);
  }

  return data.data || [];
}

// Airtable에서 기존 레코드 조회 (date + source + device + campaign_name으로 검색)
async function findExistingRecord(baseId, tableId, date, source, device, campaignName = '') {
  const formula = `AND({date}='${date}', {source}='${source}', {device}='${device}', {campaign_name}='${campaignName}')`;
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  });

  const data = await response.json();
  return data.records?.[0] || null;
}

// Airtable에 레코드 생성
async function createRecord(baseId, tableId, fields) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Airtable 생성 오류: ${data.error.message}`);
  }
  return data;
}

// Airtable 레코드 업데이트
async function updateRecord(baseId, tableId, recordId, fields) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Airtable 업데이트 오류: ${data.error.message}`);
  }
  return data;
}

// Airtable Upsert (date + source + device + campaign_name 기준)
async function upsertToAirtable(baseId, tableId, records) {
  let created = 0;
  let updated = 0;

  for (const record of records) {
    const { date, source, device, campaign_name } = record;

    // is_finalized가 true인 기존 레코드는 건드리지 않음
    const existing = await findExistingRecord(baseId, tableId, date, source, device, campaign_name);

    if (existing) {
      // 이미 월마감 데이터면 스킵
      if (existing.fields.is_finalized === true) {
        console.log(`   [스킵] ${date} ${campaign_name} ${device} - 월마감 데이터`);
        continue;
      }
      // 백필 데이터 업데이트
      await updateRecord(baseId, tableId, existing.id, record);
      updated++;
    } else {
      // 새 레코드 생성
      await createRecord(baseId, tableId, record);
      created++;
    }

    // Rate limit 방지
    await new Promise(r => setTimeout(r, 200));
  }

  return { created, updated };
}

// Meta 데이터를 Airtable 형식으로 변환
function transformMetaData(rawData, includeLeads = true) {
  return rawData.map(row => {
    // 영상 관련 데이터 추출
    const videoViews = row.video_p100_watched_actions?.[0]?.value || 0;
    const avgWatchTime = row.video_avg_time_watched_actions?.[0]?.value || 0;

    const record = {
      date: row.date_start,
      device: row.device_platform?.toLowerCase() || 'unknown',
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      spend: Math.round(parseFloat(row.spend) || 0),
      source: 'meta',
      campaign_name: row.campaign_name || '',
      keywords: '',
      is_finalized: false,
      video_views: parseInt(videoViews) || 0,
      avg_watch_time: parseFloat(avgWatchTime) || 0,
    };
    // leads는 나라똔만 (H.E.A 판교는 식당이라 리드 없음)
    if (includeLeads) {
      record.leads = getActionValue(row.actions, 'lead');
    }
    return record;
  });
}

// 클라이언트별 백필 실행
async function backfillClient(client, startDate, endDate) {
  console.log(`\n📊 ${client.client_name} 백필 시작...`);
  console.log(`   기간: ${startDate} ~ ${endDate}`);

  const airtableConfig = AIRTABLE_CONFIG[client.client_name];
  if (!airtableConfig) {
    console.error(`   ❌ Airtable 설정 없음: ${client.client_name}`);
    return { success: false, count: 0 };
  }

  try {
    // Meta API 호출
    const rawData = await fetchMetaData(
      client.meta_access_token,
      client.meta_ad_account_id,
      startDate,
      endDate
    );
    console.log(`   Meta API: ${rawData.length}개 레코드`);

    if (rawData.length === 0) {
      return { success: true, count: 0 };
    }

    // 데이터 변환 (H.E.A 판교는 식당이라 leads 제외)
    const includeLeads = client.client_name !== 'H.E.A 판교';
    const records = transformMetaData(rawData, includeLeads);

    // Airtable에 upsert
    const result = await upsertToAirtable(
      airtableConfig.baseId,
      airtableConfig.tableId,
      records
    );

    console.log(`   ✅ 생성: ${result.created}, 업데이트: ${result.updated}`);
    return { success: true, count: result.created + result.updated };
  } catch (error) {
    console.error(`   ❌ 오류: ${error.message}`);
    stats.errors.push({ client: client.client_name, error: error.message });
    return { success: false, count: 0, error: error.message };
  }
}

// 메인 함수
async function main() {
  const args = process.argv.slice(2);

  // 도움말
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Polarad Meta → Airtable 백필 스크립트 (캠페인 레벨)

⚠️ 주의: HEA 판교는 이 스크립트 사용 금지! (광고 레벨 backfill-meta-ads.js 사용)

사용법:
  node backfill-airtable.js --client "나라똔" --days 30
  node backfill-airtable.js --client "나라똔" --start 2025-01-01 --end 2025-01-05

옵션:
  --client <name>   클라이언트 지정 (필수)
  --start <date>    시작일 (YYYY-MM-DD)
  --end <date>      종료일 (YYYY-MM-DD)
  --days <n>        오늘부터 n일 전까지 백필
    `);
    return;
  }

  // --client 필수 체크
  const clientIndex = args.indexOf('--client');
  if (clientIndex === -1) {
    console.error('❌ --client 옵션 필수!');
    console.error('');
    console.error('사용법:');
    console.error('  node backfill-airtable.js --client "나라똔" --days 30');
    return;
  }

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
    console.error('❌ 시작일을 지정하세요 (--start 또는 --days)');
    return;
  }

  console.log('🚀 Polarad Meta → Airtable 백필 시작');
  console.log(`📅 기간: ${startDate} ~ ${endDate}`);

  // 클라이언트 조회 (--client 필수)
  const clientName = args[clientIndex + 1];
  const { data: clients, error } = await supabase
    .from('polarad_clients')
    .select('id, client_name, meta_ad_account_id, meta_access_token')
    .eq('is_active', true)
    .ilike('client_name', `%${clientName}%`)
    .not('meta_ad_account_id', 'is', null)
    .not('meta_access_token', 'is', null);

  if (error) {
    console.error('❌ 클라이언트 조회 실패:', error.message);
    return;
  }

  if (clients.length === 0) {
    console.log('⚠️  백필할 클라이언트가 없습니다.');
    return;
  }

  console.log(`\n👥 대상 클라이언트: ${clients.length}개`);
  clients.forEach(c => console.log(`   - ${c.client_name}`));

  // 백필 시작 알림
  await sendTelegram(
    `🔄 <b>Airtable 백필 시작</b>\n\n` +
    `📅 기간: ${startDate} ~ ${endDate}\n` +
    `👥 클라이언트: ${clients.length}개\n` +
    `📦 소스: Meta`
  );

  // 각 클라이언트 백필
  for (const client of clients) {
    const result = await backfillClient(client, startDate, endDate);
    stats.clientResults[client.client_name] = result;
    stats.totalRecords += result.count;
  }

  // 결과 요약
  console.log('\n' + '='.repeat(50));
  console.log('📊 백필 결과 요약');
  console.log('='.repeat(50));
  console.log(`총 레코드: ${stats.totalRecords}개`);

  Object.entries(stats.clientResults).forEach(([name, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${name}: ${result.count}개`);
  });

  if (stats.errors.length > 0) {
    console.log('\n❌ 오류 목록:');
    stats.errors.forEach(e => console.log(`   - ${e.client}: ${e.error}`));
  }

  // 완료 알림
  const successCount = Object.values(stats.clientResults).filter(r => r.success).length;
  const errorCount = stats.errors.length;

  await sendTelegram(
    `✅ <b>Airtable 백필 완료</b>\n\n` +
    `📅 기간: ${startDate} ~ ${endDate}\n` +
    `📊 총 레코드: ${stats.totalRecords}개\n` +
    `✅ 성공: ${successCount}개 클라이언트\n` +
    (errorCount > 0 ? `❌ 실패: ${errorCount}개 클라이언트` : '')
  );
}

main().catch(console.error);
