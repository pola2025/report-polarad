#!/usr/bin/env node
/**
 * Polarad - 네이버 플레이스 광고 데이터 자동 백필 스크립트
 *
 * 사용법:
 *   node naver-backfill.js --days 7           # 최근 7일 데이터 수집
 *   node naver-backfill.js --start 2025-12-01 --end 2025-12-21
 *   node naver-backfill.js --yesterday        # 어제 데이터만 수집 (일일 자동화용)
 *
 * 환경변수:
 *   NAVER_CUSTOMER_ID     - 네이버 광고 고객 ID
 *   NAVER_API_KEY         - API 라이선스 키
 *   NAVER_SECRET_KEY      - 비밀 키
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

// 테이블명
const TABLES = {
  CLIENTS: 'polarad_clients',
  NAVER_DATA: 'polarad_naver_data',
};

// 백필 알림 채널
const BACKFILL_CHAT_ID = '-1003394139746';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// 통계
const stats = {
  totalRecords: 0,
  errors: [],
  dateRange: { start: null, end: null },
};

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
 * 시그니처 생성 시 경로만 사용 (쿼리 파라미터 제외)
 */
async function callNaverAPI(method, uri, body = null) {
  // 시그니처용 경로 추출 (쿼리 파라미터 제외)
  const uriPath = uri.split('?')[0];
  const headers = getNaverHeaders(method, uriPath);
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
 * StatReport 생성 요청
 * reportTp: AD (광고별), ADGROUP (광고그룹별), CAMPAIGN (캠페인별)
 */
async function createStatReport(startDate, endDate, reportTp = 'AD') {
  const uri = '/stat-reports';

  const body = {
    reportTp,
    statDt: startDate.replace(/-/g, ''),  // YYYYMMDD 형식
    endDt: endDate.replace(/-/g, ''),
    // 플레이스 광고는 일반적으로 PLACE 또는 LOCAL 타입
  };

  console.log(`📊 StatReport 생성 요청: ${startDate} ~ ${endDate}`);

  try {
    const result = await callNaverAPI('POST', uri, body);
    console.log('   StatReport 생성 완료:', result);
    return result;
  } catch (error) {
    console.error('   StatReport 생성 실패:', error.message);
    throw error;
  }
}

/**
 * StatReport 조회
 */
async function getStatReport(reportJobId) {
  const uri = `/stat-reports/${reportJobId}`;
  return callNaverAPI('GET', uri);
}

/**
 * StatReport 다운로드
 */
async function downloadStatReport(downloadUrl) {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  return response.text();
}

/**
 * Stats API로 직접 통계 조회 (실시간)
 */
async function getStats(ids, startDate, endDate) {
  const uri = `/stats?ids=${ids.join(',')}&fields=["impCnt","clkCnt","salesAmt","convCnt"]&timeRange={"since":"${startDate}","until":"${endDate}"}`;

  return callNaverAPI('GET', uri);
}

/**
 * 캠페인 목록 조회
 */
async function getCampaigns() {
  const uri = '/ncc/campaigns';
  return callNaverAPI('GET', uri);
}

/**
 * 광고그룹 목록 조회
 */
async function getAdGroups(campaignId) {
  const uri = `/ncc/adgroups?nccCampaignId=${campaignId}`;
  return callNaverAPI('GET', uri);
}

/**
 * 키워드 목록 조회
 */
async function getKeywords(adGroupId) {
  const uri = `/ncc/keywords?nccAdgroupId=${adGroupId}`;
  return callNaverAPI('GET', uri);
}

/**
 * 키워드별 통계 조회 (MasterReport 방식)
 */
async function getKeywordStats(startDate, endDate) {
  console.log('\n📈 키워드별 통계 조회 중...');

  try {
    // 1. 캠페인 목록 조회
    const campaigns = await getCampaigns();
    console.log(`   캠페인 ${campaigns.length}개 발견`);

    const allKeywordStats = [];

    for (const campaign of campaigns) {
      // 플레이스 광고 캠페인 필터링 (campaignTp가 PLACE 또는 WEB_SITE)
      if (!['PLACE', 'WEB_SITE', '2'].includes(campaign.campaignTp)) {
        continue;
      }

      console.log(`   캠페인: ${campaign.name}`);

      // 2. 광고그룹 조회
      const adGroups = await getAdGroups(campaign.nccCampaignId);

      for (const adGroup of adGroups) {
        // 3. 키워드 조회
        const keywords = await getKeywords(adGroup.nccAdgroupId);

        if (keywords.length === 0) continue;

        // 4. 키워드 ID로 통계 조회
        const keywordIds = keywords.map(k => k.nccKeywordId);

        try {
          const stats = await getStats(keywordIds, startDate, endDate);

          // 키워드 정보와 통계 매핑
          for (const kw of keywords) {
            const kwStats = stats.find(s => s.id === kw.nccKeywordId);
            if (kwStats) {
              allKeywordStats.push({
                keyword: kw.keyword,
                campaign_name: campaign.name,
                adgroup_name: adGroup.name,
                impressions: kwStats.impCnt || 0,
                clicks: kwStats.clkCnt || 0,
                spend: kwStats.salesAmt || 0,
                conversions: kwStats.convCnt || 0,
              });
            }
          }
        } catch (statError) {
          console.error(`     통계 조회 실패: ${statError.message}`);
        }
      }
    }

    return allKeywordStats;
  } catch (error) {
    console.error('키워드 통계 조회 실패:', error.message);
    throw error;
  }
}

/**
 * MasterReport로 전체 통계 조회 (간단한 방식)
 */
async function getMasterReportData(startDate, endDate) {
  console.log('\n📊 MasterReport 데이터 조회 중...');

  const uri = '/master-reports';

  // MasterReport 생성 요청
  const body = {
    item: 'Keyword',  // 키워드별 리포트
    fromTime: startDate,
    toTime: endDate,
  };

  try {
    const result = await callNaverAPI('POST', uri, body);
    console.log('   MasterReport 요청 완료:', result);

    // 리포트 생성 대기 (폴링)
    let reportReady = false;
    let reportData = null;
    let attempts = 0;
    const maxAttempts = 30;

    while (!reportReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const status = await callNaverAPI('GET', `/master-reports/${result.id}`);

      if (status.status === 'DONE' || status.status === 'COMPLETED') {
        reportReady = true;
        reportData = status;
      } else if (status.status === 'FAILED') {
        throw new Error('MasterReport 생성 실패');
      }

      attempts++;
    }

    if (!reportReady) {
      throw new Error('MasterReport 생성 타임아웃');
    }

    // 리포트 다운로드
    if (reportData.downloadUrl) {
      const csvData = await downloadStatReport(reportData.downloadUrl);
      return parseCSV(csvData);
    }

    return [];
  } catch (error) {
    console.error('MasterReport 조회 실패:', error.message);
    throw error;
  }
}

/**
 * CSV 파싱
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });
    data.push(row);
  }

  return data;
}

/**
 * Supabase에 데이터 저장
 */
async function saveToSupabase(clientId, date, keywordData) {
  const records = keywordData.map(kw => ({
    client_id: clientId,
    date: date,
    keyword: kw.keyword,
    impressions: parseInt(kw.impressions) || 0,
    clicks: parseInt(kw.clicks) || 0,
    ctr: kw.clicks && kw.impressions ? (kw.clicks / kw.impressions * 100) : 0,
    avg_cpc: kw.clicks ? Math.round(kw.spend / kw.clicks) : 0,
    total_cost: parseInt(kw.spend) || 0,
    avg_rank: parseFloat(kw.avg_rank) || 0,
  }));

  if (records.length === 0) return 0;

  const { error } = await supabase
    .from(TABLES.NAVER_DATA)
    .upsert(records, {
      onConflict: 'client_id,date,keyword',
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Supabase 저장 실패: ${error.message}`);
  }

  return records.length;
}

/**
 * 텔레그램 알림 전송
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
 * 클라이언트 정보 조회
 */
async function getClient() {
  const { data, error } = await supabase
    .from(TABLES.CLIENTS)
    .select('id, client_name')
    .eq('is_active', true)
    .single();

  if (error) {
    throw new Error(`클라이언트 조회 실패: ${error.message}`);
  }

  return data;
}

/**
 * 메인 함수
 */
async function main() {
  console.log('🚀 네이버 플레이스 광고 데이터 백필 시작\n');

  // 환경변수 확인
  if (!CUSTOMER_ID || !API_KEY || !SECRET_KEY) {
    console.error('❌ 환경변수 설정 필요:');
    console.error('   NAVER_CUSTOMER_ID, NAVER_API_KEY, NAVER_SECRET_KEY');
    console.log('\n.env.local 파일에 다음을 추가하세요:');
    console.log('NAVER_CUSTOMER_ID=3161455');
    console.log('NAVER_API_KEY=YOUR_NAVER_API_KEY');
    console.log('NAVER_SECRET_KEY=YOUR_NAVER_SECRET_KEY');
    return;
  }

  // 날짜 계산
  const args = process.argv.slice(2);
  let startDate, endDate;

  if (args.includes('--yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    startDate = yesterday.toISOString().split('T')[0];
    endDate = startDate;
  } else if (args.includes('--days')) {
    const daysIndex = args.indexOf('--days');
    const days = parseInt(args[daysIndex + 1]) || 7;
    endDate = new Date().toISOString().split('T')[0];
    const start = new Date();
    start.setDate(start.getDate() - days);
    startDate = start.toISOString().split('T')[0];
  } else if (args.includes('--start')) {
    const startIndex = args.indexOf('--start');
    const endIndex = args.indexOf('--end');
    startDate = args[startIndex + 1];
    endDate = endIndex !== -1 ? args[endIndex + 1] : new Date().toISOString().split('T')[0];
  } else {
    // 기본: 어제 데이터
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    startDate = yesterday.toISOString().split('T')[0];
    endDate = startDate;
  }

  console.log(`📅 기간: ${startDate} ~ ${endDate}`);
  stats.dateRange = { start: startDate, end: endDate };

  try {
    // 클라이언트 정보 조회
    const client = await getClient();
    console.log(`👤 클라이언트: ${client.client_name}\n`);

    // API 연결 테스트
    console.log('🔗 네이버 API 연결 테스트...');
    const campaigns = await getCampaigns();
    console.log(`   ✅ 연결 성공! 캠페인 ${campaigns.length}개 발견\n`);

    // 캠페인 정보 출력
    console.log('📋 캠페인 목록:');
    campaigns.forEach(c => {
      console.log(`   - ${c.name} (${c.campaignTp}, ${c.status})`);
    });

    // 키워드별 통계 조회
    const keywordStats = await getKeywordStats(startDate, endDate);
    console.log(`\n📊 키워드 통계 ${keywordStats.length}개 수집`);

    if (keywordStats.length > 0) {
      // 일별로 저장
      const savedCount = await saveToSupabase(client.id, endDate, keywordStats);
      stats.totalRecords = savedCount;
      console.log(`✅ ${savedCount}개 레코드 저장 완료`);
    }

    // 완료 알림
    await sendTelegramNotification(
      `✅ <b>네이버 광고 백필 완료</b>\n\n` +
      `📅 기간: ${startDate} ~ ${endDate}\n` +
      `📊 레코드: ${stats.totalRecords}개`
    );

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    stats.errors.push(error.message);

    await sendTelegramNotification(
      `❌ <b>네이버 광고 백필 실패</b>\n\n` +
      `📅 기간: ${startDate} ~ ${endDate}\n` +
      `오류: ${error.message}`
    );
  }

  // 결과 요약
  console.log('\n' + '='.repeat(50));
  console.log('📊 백필 결과 요약');
  console.log('='.repeat(50));
  console.log(`기간: ${stats.dateRange.start} ~ ${stats.dateRange.end}`);
  console.log(`총 레코드: ${stats.totalRecords}개`);
  if (stats.errors.length > 0) {
    console.log(`오류: ${stats.errors.length}건`);
  }
}

main().catch(console.error);
