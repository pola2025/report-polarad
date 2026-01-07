#!/usr/bin/env node
/**
 * Polarad Meta - 데이터 백필 스크립트 (Supabase 저장)
 *
 * ⚠️ 주의: 이 프로젝트는 Airtable을 데이터 소스로 사용!
 *         이 스크립트 대신 backfill-meta-ads.js 또는 backfill-airtable.js 사용 권장
 *
 * 사용법:
 *   node backfill.js --client "클라이언트명" --start 2025-10-01 --end 2025-12-07
 *   node backfill.js --client "클라이언트명" --days 90
 *
 * 기능:
 *   - Meta API에서 video_views, avg_watch_time 포함 데이터 수집
 *   - polarad_meta_data 테이블에 upsert (Supabase)
 *   - 텔레그램 알림 (백필 채널)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 테이블명
const TABLES = {
  CLIENTS: 'polarad_clients',
  META_DATA: 'polarad_meta_data',
};

// 백필 알림 채널
const BACKFILL_CHAT_ID = '-1003394139746';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.warn('⚠️  TELEGRAM_BOT_TOKEN이 설정되지 않았습니다. 텔레그램 알림이 비활성화됩니다.');
}

// 통계
const stats = {
  totalRecords: 0,
  clientResults: {},
  errors: [],
};

// 텔레그램 알림 전송
async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: BACKFILL_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error('텔레그램 알림 실패:', error.message);
  }
}

// Meta API 호출
async function fetchMetaData(client, startDate, endDate) {
  const accessToken = client.meta_access_token;
  const adAccountId = client.meta_ad_account_id;

  if (!accessToken || !adAccountId) {
    throw new Error(`클라이언트 ${client.client_name}: Meta 설정 누락`);
  }

  const fields = [
    'date_start',
    'ad_id',
    'ad_name',
    'campaign_id',
    'campaign_name',
    'impressions',
    'clicks',
    'spend',
    'actions',
    'video_avg_time_watched_actions',
    'video_p100_watched_actions',
  ].join(',');

  const breakdowns = 'publisher_platform,device_platform';

  const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?` +
    `fields=${fields}&` +
    `breakdowns=${breakdowns}&` +
    `time_range={"since":"${startDate}","until":"${endDate}"}&` +
    `time_increment=1&` +
    `level=ad&` +
    `limit=1000&` +
    `access_token=${accessToken}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Meta API 오류: ${data.error.message}`);
  }

  return data.data || [];
}

// 데이터 변환
function transformMetaData(rawData, clientId) {
  return rawData.map((row) => {
    const leads = row.actions?.find((a) => a.action_type === 'lead')?.value || 0;
    const videoViews = row.video_p100_watched_actions?.[0]?.value || 0;
    const avgWatchTime = row.video_avg_time_watched_actions?.[0]?.value || 0;

    return {
      client_id: clientId,
      date: row.date_start,
      ad_id: row.ad_id,
      ad_name: row.ad_name,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      platform: row.publisher_platform?.toLowerCase() || null,
      device: row.device_platform?.toLowerCase() || null,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      leads: parseInt(leads),
      spend: parseFloat(row.spend) || 0,
      video_views: parseInt(videoViews),
      avg_watch_time: parseFloat(avgWatchTime),
      currency: 'KRW',
    };
  });
}

// Supabase에 upsert
async function upsertData(records) {
  if (records.length === 0) return 0;

  const { error } = await supabase
    .from(TABLES.META_DATA)
    .upsert(records, {
      onConflict: 'client_id,date,ad_id,platform,device',
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Supabase upsert 오류: ${error.message}`);
  }

  return records.length;
}

// 클라이언트별 백필 실행
async function backfillClient(client, startDate, endDate) {
  console.log(`\n📊 ${client.client_name} 백필 시작...`);
  console.log(`   기간: ${startDate} ~ ${endDate}`);

  try {
    const rawData = await fetchMetaData(client, startDate, endDate);
    console.log(`   Meta API: ${rawData.length}개 레코드`);

    if (rawData.length === 0) {
      return { success: true, count: 0 };
    }

    // client.id (UUID)를 사용해야 함 - client.client_id는 문자열
    const transformedData = transformMetaData(rawData, client.id);
    const count = await upsertData(transformedData);

    console.log(`   ✅ ${count}개 레코드 저장 완료`);
    return { success: true, count };
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
Polarad Meta 데이터 백필 스크립트 (Supabase 저장)

⚠️ 주의: 이 프로젝트는 Airtable을 데이터 소스로 사용!
        이 스크립트 대신 backfill-meta-ads.js 또는 backfill-airtable.js 사용 권장

사용법:
  node backfill.js --client "클라이언트명" --start 2025-10-01 --end 2025-12-07
  node backfill.js --client "클라이언트명" --days 90

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
    console.error('  node backfill.js --client "클라이언트명" --days 30');
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

  console.log('🚀 Polarad Meta 백필 시작');
  console.log(`📅 기간: ${startDate} ~ ${endDate}`);

  // 클라이언트 조회 (--client 필수)
  const clientName = args[clientIndex + 1];
  const { data: clients, error } = await supabase
    .from(TABLES.CLIENTS)
    .select('*')
    .eq('is_active', true)
    .ilike('client_name', `%${clientName}%`);

  if (error) {
    console.error('❌ 클라이언트 조회 실패:', error.message);
    return;
  }

  if (clients.length === 0) {
    console.log('⚠️  백필할 클라이언트가 없습니다.');
    return;
  }

  console.log(`\n👥 대상 클라이언트: ${clients.length}개`);
  clients.forEach((c) => console.log(`   - ${c.client_name}`));

  // 백필 시작 알림
  await sendTelegramNotification(
    `🔄 <b>백필 시작</b>\n\n` +
    `📅 기간: ${startDate} ~ ${endDate}\n` +
    `👥 클라이언트: ${clients.length}개`
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
    stats.errors.forEach((e) => console.log(`   - ${e.client}: ${e.error}`));
  }

  // 완료 알림
  const successCount = Object.values(stats.clientResults).filter((r) => r.success).length;
  const errorCount = stats.errors.length;

  await sendTelegramNotification(
    `✅ <b>백필 완료</b>\n\n` +
    `📅 기간: ${startDate} ~ ${endDate}\n` +
    `📊 총 레코드: ${stats.totalRecords}개\n` +
    `✅ 성공: ${successCount}개 클라이언트\n` +
    (errorCount > 0 ? `❌ 실패: ${errorCount}개 클라이언트` : '')
  );
}

main().catch(console.error);
