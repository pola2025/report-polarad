#!/usr/bin/env node
/**
 * 네이버 플레이스 광고 - Airtable 캐시 동기화
 *
 * 구조:
 *   1. 네이버 API → Airtable (하루 1회, API 호출 제한 방지)
 *   2. Airtable → Supabase (대시보드 조회용)
 *
 * 사용법:
 *   node naver-sync-airtable.js --fetch     # 네이버 API → Airtable
 *   node naver-sync-airtable.js --sync      # Airtable → Supabase
 *   node naver-sync-airtable.js --all       # 전체 동기화
 *
 * Airtable 테이블 구조:
 *   - date (Date)
 *   - keyword (Text)
 *   - impressions (Number)
 *   - clicks (Number)
 *   - spend (Number/Currency)
 *   - ctr (Number/Percent)
 *   - avg_cpc (Number)
 *   - avg_rank (Number)
 *   - campaign_name (Text)
 *   - synced_at (DateTime)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 네이버 API 설정
const NAVER_API_BASE = 'https://api.searchad.naver.com';
const CUSTOMER_ID = process.env.NAVER_CUSTOMER_ID;
const API_KEY = process.env.NAVER_API_KEY;
const SECRET_KEY = process.env.NAVER_SECRET_KEY;

// Airtable 설정
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_NAVER_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_NAVER_TABLE_NAME || 'NaverPlaceAds';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

// 테이블명
const TABLES = {
  CLIENTS: 'polarad_clients',
  NAVER_DATA: 'polarad_naver_data',
};

// 백필 알림 채널
const BACKFILL_CHAT_ID = '-1003394139746';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * 네이버 API Signature 생성
 */
function generateSignature(timestamp, method, uri) {
  const message = `${timestamp}.${method}.${uri}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(message);
  return hmac.digest('base64');
}

/**
 * 네이버 API 헤더 생성
 */
function getNaverHeaders(method, uri) {
  const timestamp = String(Date.now());
  const signature = generateSignature(timestamp, method, uri);

  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Timestamp': timestamp,
    'X-API-KEY': API_KEY,
    'X-Customer': CUSTOMER_ID,
    'X-Signature': signature,
  };
}

/**
 * 네이버 API 호출
 */
async function callNaverAPI(method, uri, body = null) {
  const headers = getNaverHeaders(method, uri);
  const url = `${NAVER_API_BASE}${uri}`;

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Naver API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Airtable API 호출
 */
async function callAirtableAPI(method, endpoint, body = null) {
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}${endpoint}`;

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Airtable에서 모든 레코드 조회 (페이지네이션 처리)
 */
async function getAllAirtableRecords(filterFormula = null) {
  let allRecords = [];
  let offset = null;

  do {
    let endpoint = '?pageSize=100';
    if (offset) endpoint += `&offset=${offset}`;
    if (filterFormula) endpoint += `&filterByFormula=${encodeURIComponent(filterFormula)}`;

    const response = await callAirtableAPI('GET', endpoint);
    allRecords = allRecords.concat(response.records || []);
    offset = response.offset;
  } while (offset);

  return allRecords;
}

/**
 * Airtable에 레코드 upsert (생성 또는 업데이트)
 */
async function upsertAirtableRecords(records) {
  // Airtable은 한 번에 10개씩만 처리 가능
  const batchSize = 10;
  let totalUpserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const body = {
      records: batch.map(r => ({
        fields: r,
      })),
      typecast: true,  // 자동 타입 변환
    };

    await callAirtableAPI('POST', '', body);
    totalUpserted += batch.length;
  }

  return totalUpserted;
}

/**
 * 네이버 API에서 캠페인 목록 조회
 */
async function getCampaigns() {
  const uri = '/ncc/campaigns';
  return callNaverAPI('GET', uri);
}

/**
 * 네이버 API에서 광고그룹 목록 조회
 */
async function getAdGroups(campaignId) {
  const uri = `/ncc/adgroups?nccCampaignId=${campaignId}`;
  return callNaverAPI('GET', uri);
}

/**
 * 네이버 API에서 키워드 목록 조회
 */
async function getKeywords(adGroupId) {
  const uri = `/ncc/keywords?nccAdgroupId=${adGroupId}`;
  return callNaverAPI('GET', uri);
}

/**
 * 네이버 API에서 통계 조회
 */
async function getStats(ids, startDate, endDate) {
  if (ids.length === 0) return [];

  const fields = encodeURIComponent(JSON.stringify(['impCnt', 'clkCnt', 'salesAmt', 'convCnt', 'avgRnk']));
  const timeRange = encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }));
  const uri = `/stats?ids=${ids.join(',')}&fields=${fields}&timeRange=${timeRange}`;

  return callNaverAPI('GET', uri);
}

/**
 * 네이버 API → Airtable 동기화
 */
async function fetchToAirtable(startDate, endDate) {
  console.log('\n📥 네이버 API → Airtable 동기화');
  console.log(`   기간: ${startDate} ~ ${endDate}`);

  // API 키 확인
  if (!CUSTOMER_ID || !API_KEY || !SECRET_KEY) {
    throw new Error('네이버 API 환경변수가 설정되지 않았습니다');
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error('Airtable 환경변수가 설정되지 않았습니다');
  }

  // 캠페인 목록 조회
  console.log('\n🔍 캠페인 조회 중...');
  const campaigns = await getCampaigns();
  console.log(`   캠페인 ${campaigns.length}개 발견`);

  const allKeywordData = [];
  const now = new Date().toISOString();

  for (const campaign of campaigns) {
    console.log(`   📁 ${campaign.name} (${campaign.campaignTp})`);

    // 광고그룹 조회
    const adGroups = await getAdGroups(campaign.nccCampaignId);

    for (const adGroup of adGroups) {
      // 키워드 조회
      const keywords = await getKeywords(adGroup.nccAdgroupId);
      if (keywords.length === 0) continue;

      // 키워드 통계 조회
      const keywordIds = keywords.map(k => k.nccKeywordId);

      try {
        const stats = await getStats(keywordIds, startDate, endDate);

        for (const kw of keywords) {
          const kwStats = stats.find(s => s.id === kw.nccKeywordId) || {};

          allKeywordData.push({
            date: endDate,
            keyword: kw.keyword,
            impressions: kwStats.impCnt || 0,
            clicks: kwStats.clkCnt || 0,
            spend: kwStats.salesAmt || 0,
            ctr: kwStats.impCnt ? ((kwStats.clkCnt || 0) / kwStats.impCnt * 100).toFixed(2) : 0,
            avg_cpc: kwStats.clkCnt ? Math.round((kwStats.salesAmt || 0) / kwStats.clkCnt) : 0,
            avg_rank: kwStats.avgRnk || 0,
            campaign_name: campaign.name,
            adgroup_name: adGroup.name,
            synced_at: now,
          });
        }
      } catch (error) {
        console.error(`     통계 조회 실패: ${error.message}`);
      }

      // API 호출 제한 방지 (0.5초 대기)
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n📊 수집된 키워드 데이터: ${allKeywordData.length}개`);

  if (allKeywordData.length > 0) {
    console.log('💾 Airtable에 저장 중...');
    const saved = await upsertAirtableRecords(allKeywordData);
    console.log(`   ✅ ${saved}개 레코드 저장 완료`);
  }

  return allKeywordData.length;
}

/**
 * Airtable → Supabase 동기화
 */
async function syncToSupabase(startDate = null, endDate = null) {
  console.log('\n📤 Airtable → Supabase 동기화');

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error('Airtable 환경변수가 설정되지 않았습니다');
  }

  // 클라이언트 정보 조회
  const { data: client, error: clientError } = await supabase
    .from(TABLES.CLIENTS)
    .select('id, client_name')
    .eq('is_active', true)
    .single();

  if (clientError) {
    throw new Error(`클라이언트 조회 실패: ${clientError.message}`);
  }

  console.log(`   클라이언트: ${client.client_name}`);

  // Airtable에서 데이터 조회
  let filterFormula = null;
  if (startDate && endDate) {
    filterFormula = `AND(IS_AFTER({date}, '${startDate}'), IS_BEFORE({date}, '${endDate}'))`;
  }

  console.log('   Airtable 데이터 조회 중...');
  const records = await getAllAirtableRecords(filterFormula);
  console.log(`   ${records.length}개 레코드 발견`);

  if (records.length === 0) {
    console.log('   동기화할 데이터가 없습니다.');
    return 0;
  }

  // Supabase 형식으로 변환
  const supabaseRecords = records.map(r => ({
    client_id: client.id,
    date: r.fields.date,
    keyword: r.fields.keyword,
    impressions: parseInt(r.fields.impressions) || 0,
    clicks: parseInt(r.fields.clicks) || 0,
    ctr: parseFloat(r.fields.ctr) || 0,
    avg_cpc: parseInt(r.fields.avg_cpc) || 0,
    total_cost: parseInt(r.fields.spend) || 0,
    avg_rank: parseFloat(r.fields.avg_rank) || 0,
  }));

  // Supabase에 upsert
  console.log('   Supabase에 저장 중...');
  const { error: upsertError } = await supabase
    .from(TABLES.NAVER_DATA)
    .upsert(supabaseRecords, {
      onConflict: 'client_id,date,keyword',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`Supabase 저장 실패: ${upsertError.message}`);
  }

  console.log(`   ✅ ${supabaseRecords.length}개 레코드 동기화 완료`);
  return supabaseRecords.length;
}

/**
 * 텔레그램 알림
 */
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
      }),
    });
  } catch (error) {
    console.error('텔레그램 알림 실패:', error.message);
  }
}

/**
 * 메인 함수
 */
async function main() {
  console.log('🚀 네이버 플레이스 광고 Airtable 동기화\n');

  const args = process.argv.slice(2);
  const doFetch = args.includes('--fetch') || args.includes('--all');
  const doSync = args.includes('--sync') || args.includes('--all');

  if (!doFetch && !doSync) {
    console.log('사용법:');
    console.log('  node naver-sync-airtable.js --fetch     # 네이버 API → Airtable');
    console.log('  node naver-sync-airtable.js --sync      # Airtable → Supabase');
    console.log('  node naver-sync-airtable.js --all       # 전체 동기화');
    console.log('\n옵션:');
    console.log('  --days <n>    최근 n일 데이터 (기본: 1)');
    return;
  }

  // 날짜 계산
  const daysIndex = args.indexOf('--days');
  const days = daysIndex !== -1 ? parseInt(args[daysIndex + 1]) || 1 : 1;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // 어제
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  console.log(`📅 기간: ${startStr} ~ ${endStr}`);

  let fetchCount = 0;
  let syncCount = 0;

  try {
    if (doFetch) {
      fetchCount = await fetchToAirtable(startStr, endStr);
    }

    if (doSync) {
      syncCount = await syncToSupabase(startStr, endStr);
    }

    // 완료 알림
    await sendTelegramNotification(
      `✅ <b>네이버 광고 동기화 완료</b>\n\n` +
      `📅 기간: ${startStr} ~ ${endStr}\n` +
      (doFetch ? `📥 Airtable 저장: ${fetchCount}개\n` : '') +
      (doSync ? `📤 Supabase 동기화: ${syncCount}개` : '')
    );

    console.log('\n✅ 동기화 완료!');

  } catch (error) {
    console.error('\n❌ 오류:', error.message);

    await sendTelegramNotification(
      `❌ <b>네이버 광고 동기화 실패</b>\n\n오류: ${error.message}`
    );
  }
}

main().catch(console.error);
