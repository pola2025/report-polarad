#!/usr/bin/env node
/**
 * Meta API Warmup - POLA-REPORT 앱 검수용 API 호출 기록 쌓기
 *
 * Meta 앱 검수에서 요구하는 "최근 15일간 충분한 Ads API 호출"을 충족하기 위해
 * 매일 1회 실행하여 다양한 엔드포인트를 호출합니다.
 *
 * App ID: 2081730902593417 (POLA-REPORT)
 *
 * 실행 방법:
 *   - GitHub Actions: 매일 오전 9시(KST) 자동 실행 (.github/workflows/meta-api-warmup.yml)
 *   - 수동: node scripts/meta-api-warmup.js
 *   - 확인: node scripts/meta-api-warmup.js --dry-run
 *   - 도움말: node scripts/meta-api-warmup.js --help
 *
 * 호출 엔드포인트 (8개, 5개 권한 커버):
 *   1. GET  /me/adaccounts              (ads_read)
 *   2. GET  /act_{id}/insights          (ads_read)
 *   3. GET  /act_{id}/campaigns         (ads_read)
 *   4. GET  /{campaign_id}/insights     (ads_read)
 *   5. POST /{campaign_id} status       (ads_management)
 *   6. GET  /me/accounts                (pages_show_list)
 *   7. GET  /{page_id}                  (pages_read_engagement)
 *   8. GET  /me/businesses              (business_management)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

// ─── 설정 ────────────────────────────────────────────
const META_APP_ID = '2081730902593417';
const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const BACKFILL_CHAT_ID = '-1003394139746';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CLI 인자 파싱
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isHelp = args.includes('--help');

// ─── 도움말 ──────────────────────────────────────────
if (isHelp) {
  console.log(`
Meta API Warmup - POLA-REPORT 앱 검수용 API 호출 기록 쌓기

사용법:
  node scripts/meta-api-warmup.js              실제 API 호출 실행
  node scripts/meta-api-warmup.js --dry-run    API 호출 없이 설정 확인만
  node scripts/meta-api-warmup.js --help       이 도움말 표시

설명:
  Meta 앱 검수에서 요구하는 "최근 15일간 Ads API 호출 기록"을 쌓기 위해
  매일 1회 실행합니다. Supabase에서 클라이언트 목록을 조회하고
  각 클라이언트의 토큰으로 7개 엔드포인트를 호출합니다.

  GitHub Actions (.github/workflows/meta-api-warmup.yml)로 매일 자동 실행됩니다.
`);
  process.exit(0);
}

// ─── 유틸리티 ────────────────────────────────────────
function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

async function sendTelegramNotification(message) {
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
  } catch (error) {
    console.error('텔레그램 알림 실패:', error.message);
  }
}

async function metaGet(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data;
}

// ─── API 호출 함수들 ──────────────────────────────────

async function callAdAccounts(token) {
  const url = `${BASE_URL}/me/adaccounts?fields=name,account_id,currency,account_status&limit=100&access_token=${token}`;
  const data = await metaGet(url);
  return { count: data.data?.length || 0, data: data.data };
}

async function callAccountInsights(adAccountId, token) {
  const yesterday = getYesterday();
  const url = `${BASE_URL}/act_${adAccountId}/insights?` +
    `fields=impressions,clicks,spend,actions&` +
    `time_range={"since":"${yesterday}","until":"${yesterday}"}&` +
    `level=account&` +
    `access_token=${token}`;
  const data = await metaGet(url);
  return { rows: data.data?.length || 0 };
}

async function callCampaigns(adAccountId, token) {
  const url = `${BASE_URL}/act_${adAccountId}/campaigns?` +
    `fields=name,status,objective&` +
    `limit=100&` +
    `access_token=${token}`;
  const data = await metaGet(url);
  return { count: data.data?.length || 0, data: data.data };
}

async function callCampaignInsights(campaignId, token) {
  const yesterday = getYesterday();
  const url = `${BASE_URL}/${campaignId}/insights?` +
    `fields=impressions,clicks,spend&` +
    `time_range={"since":"${yesterday}","until":"${yesterday}"}&` +
    `access_token=${token}`;
  const data = await metaGet(url);
  return { rows: data.data?.length || 0 };
}

async function callPages(token) {
  const url = `${BASE_URL}/me/accounts?fields=name,id,access_token&limit=100&access_token=${token}`;
  const data = await metaGet(url);
  return { count: data.data?.length || 0, data: data.data };
}

async function callPageDetail(pageId, pageToken) {
  const url = `${BASE_URL}/${pageId}?fields=name,fan_count,followers_count&access_token=${pageToken}`;
  const data = await metaGet(url);
  return { name: data.name, fans: data.fan_count };
}

async function callBusinesses(token) {
  const url = `${BASE_URL}/me/businesses?fields=name,id&limit=100&access_token=${token}`;
  const data = await metaGet(url);
  return { count: data.data?.length || 0 };
}

async function callCampaignStatusUpdate(campaignId, currentStatus, token) {
  // ads_management 권한 증명: 캠페인 상태를 동일한 값으로 POST (no-op, 안전)
  const url = `${BASE_URL}/${campaignId}?access_token=${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: currentStatus }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return { success: data.success };
}

// ─── 클라이언트별 워밍업 ──────────────────────────────

async function warmupClient(client) {
  const token = client.meta_access_token;
  const adAccountId = client.meta_ad_account_id;
  const name = client.client_name;
  const results = [];
  let success = 0;
  let fail = 0;

  // 1. /me/adaccounts (ads_read)
  try {
    const r = await callAdAccounts(token);
    results.push(`  [1/8] GET /me/adaccounts → 200 OK (${r.count} accounts)`);
    success++;
  } catch (e) {
    results.push(`  [1/8] GET /me/adaccounts → FAIL: ${e.message}`);
    fail++;
  }

  // 2. /act_{id}/insights (ads_read)
  try {
    const r = await callAccountInsights(adAccountId, token);
    results.push(`  [2/8] GET /act_${adAccountId}/insights → 200 OK (${r.rows} rows)`);
    success++;
  } catch (e) {
    results.push(`  [2/8] GET /act_${adAccountId}/insights → FAIL: ${e.message}`);
    fail++;
  }

  // 3. /act_{id}/campaigns (ads_read)
  let firstCampaign = null;
  try {
    const r = await callCampaigns(adAccountId, token);
    results.push(`  [3/8] GET /act_${adAccountId}/campaigns → 200 OK (${r.count} campaigns)`);
    if (r.data && r.data.length > 0) {
      firstCampaign = r.data[0];
    }
    success++;
  } catch (e) {
    results.push(`  [3/8] GET /act_${adAccountId}/campaigns → FAIL: ${e.message}`);
    fail++;
  }

  // 4. /{campaign_id}/insights (ads_read)
  if (firstCampaign) {
    try {
      const r = await callCampaignInsights(firstCampaign.id, token);
      results.push(`  [4/8] GET /${firstCampaign.id}/insights → 200 OK (${r.rows} rows)`);
      success++;
    } catch (e) {
      results.push(`  [4/8] GET /${firstCampaign.id}/insights → FAIL: ${e.message}`);
      fail++;
    }
  } else {
    results.push(`  [4/8] GET /{campaign_id}/insights → SKIP (no campaigns)`);
  }

  // 5. POST /{campaign_id} status (ads_management) - 동일 상태로 POST (no-op)
  if (firstCampaign) {
    try {
      const r = await callCampaignStatusUpdate(firstCampaign.id, firstCampaign.status, token);
      results.push(`  [5/8] POST /${firstCampaign.id} status=${firstCampaign.status} → 200 OK (ads_management)`);
      success++;
    } catch (e) {
      results.push(`  [5/8] POST /${firstCampaign.id} status → FAIL: ${e.message}`);
      fail++;
    }
  } else {
    results.push(`  [5/8] POST /{campaign_id} status → SKIP (no campaigns)`);
  }

  // 6. /me/accounts (pages_show_list)
  let firstPage = null;
  try {
    const r = await callPages(token);
    results.push(`  [6/8] GET /me/accounts → 200 OK (${r.count} pages)`);
    if (r.data && r.data.length > 0) {
      firstPage = r.data[0];
    }
    success++;
  } catch (e) {
    results.push(`  [6/8] GET /me/accounts → FAIL: ${e.message}`);
    fail++;
  }

  // 7. /{page_id} (pages_read_engagement)
  if (firstPage) {
    try {
      const r = await callPageDetail(firstPage.id, firstPage.access_token || token);
      results.push(`  [7/8] GET /${firstPage.id} → 200 OK (${r.name}, fans: ${r.fans})`);
      success++;
    } catch (e) {
      results.push(`  [7/8] GET /${firstPage.id} → FAIL: ${e.message}`);
      fail++;
    }
  } else {
    results.push(`  [7/8] GET /{page_id} → SKIP (no pages)`);
  }

  // 8. /me/businesses (business_management)
  try {
    const r = await callBusinesses(token);
    results.push(`  [8/8] GET /me/businesses → 200 OK (${r.count} businesses)`);
    success++;
  } catch (e) {
    results.push(`  [8/8] GET /me/businesses → FAIL: ${e.message}`);
    fail++;
  }

  return { name, success, fail, results };
}

// ─── 메인 ─────────────────────────────────────────────

async function main() {
  const today = getToday();
  console.log(`=== Meta API Warmup - POLA-REPORT App (${META_APP_ID}) ===`);
  console.log(`날짜: ${today}`);
  console.log(`모드: ${isDryRun ? 'DRY-RUN (API 호출 안 함)' : 'LIVE'}`);
  console.log();

  // 환경변수 확인
  const envChecks = [
    ['NEXT_PUBLIC_SUPABASE_URL', !!process.env.NEXT_PUBLIC_SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', !!process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['TELEGRAM_BOT_TOKEN', !!process.env.TELEGRAM_BOT_TOKEN],
  ];

  console.log('[환경변수 확인]');
  for (const [name, ok] of envChecks) {
    console.log(`  ${ok ? 'OK' : 'MISSING'} ${name}`);
  }
  console.log();

  // Supabase에서 클라이언트 목록 조회
  const { data: clients, error } = await supabase
    .from('polarad_clients')
    .select('client_name, meta_access_token, meta_ad_account_id')
    .not('meta_access_token', 'is', null)
    .not('meta_ad_account_id', 'is', null);

  if (error) {
    console.error('Supabase 클라이언트 조회 실패:', error.message);
    process.exit(1);
  }

  console.log(`[클라이언트] ${clients.length}개 발견 (Meta 토큰 보유)\n`);

  if (isDryRun) {
    for (const c of clients) {
      console.log(`  - ${c.client_name} (act_${c.meta_ad_account_id})`);
    }
    console.log('\n-- DRY-RUN 완료. 실제 API 호출은 하지 않았습니다. --');
    return;
  }

  // 실제 API 호출
  let totalSuccess = 0;
  let totalFail = 0;
  const allResults = [];

  for (const client of clients) {
    console.log(`--- ${client.client_name} (act_${client.meta_ad_account_id}) ---`);
    const result = await warmupClient(client);
    totalSuccess += result.success;
    totalFail += result.fail;
    allResults.push(result);

    for (const line of result.results) {
      console.log(line);
    }
    console.log(`  => ${result.success} 성공, ${result.fail} 실패\n`);

    // Rate limiting - 클라이언트 간 500ms 대기
    await new Promise(r => setTimeout(r, 500));
  }

  // 결과 요약
  const summary = `${totalSuccess} 성공, ${totalFail} 실패 (${clients.length} clients)`;
  console.log(`=== 완료: ${summary} ===`);

  // 텔레그램 알림
  const clientSummaries = allResults
    .map(r => `  ${r.name}: ${r.success}/${r.success + r.fail}`)
    .join('\n');

  const telegramMsg =
    `<b>Meta API Warmup</b> (${today})\n` +
    `App: POLA-REPORT (${META_APP_ID})\n\n` +
    `${clientSummaries}\n\n` +
    `<b>${summary}</b>`;

  await sendTelegramNotification(telegramMsg);
}

main().catch(console.error);
