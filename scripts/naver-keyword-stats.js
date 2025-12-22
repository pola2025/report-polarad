#!/usr/bin/env node
/**
 * Polarad - 네이버 데이터랩 상호명 검색량 수집 스크립트
 *
 * 사용법:
 *   node naver-keyword-stats.js                    # 최근 12개월 데이터 수집
 *   node naver-keyword-stats.js --months 6         # 최근 6개월
 *   node naver-keyword-stats.js --year 2025        # 2025년 전체
 *
 * 네이버 데이터랩 API 제한:
 *   - 검색어 트렌드는 상대값(0~100)으로 제공
 *   - 실제 검색량은 제공하지 않음 (추정값 계산 필요)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 네이버 데이터랩 API 설정
const DATALAB_API_URL = 'https://openapi.naver.com/v1/datalab/search';
const CLIENT_ID = process.env.NAVER_DATALAB_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_DATALAB_CLIENT_SECRET;

// 테이블명
const TABLES = {
  CLIENTS: 'polarad_clients',
  KEYWORD_STATS: 'polarad_keyword_stats',
};

// 백필 알림 채널
const BACKFILL_CHAT_ID = '-1003394139746';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// H.E.A 판교 검색 키워드 그룹
const KEYWORD_GROUPS = [
  {
    groupName: 'hea판교',
    keywords: ['hea판교'],
  },
  {
    groupName: '판교hea',
    keywords: ['판교hea'],
  },
];

/**
 * 네이버 데이터랩 API 호출
 */
async function callDatalabAPI(startDate, endDate, keywordGroups, device = '') {
  const body = {
    startDate,
    endDate,
    timeUnit: 'month',
    keywordGroups: keywordGroups.map(g => ({
      groupName: g.groupName,
      keywords: g.keywords,
    })),
  };

  if (device) {
    body.device = device; // 'pc' or 'mo'
  }

  const response = await fetch(DATALAB_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Naver-Client-Id': CLIENT_ID,
      'X-Naver-Client-Secret': CLIENT_SECRET,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Datalab API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * 검색 트렌드 데이터를 추정 검색량으로 변환
 * 네이버 데이터랩은 상대값(0~100)만 제공하므로 추정 필요
 *
 * 기준: 월평균 검색량 1000회를 ratio 50으로 가정
 */
function estimateSearchVolume(ratio, baseVolume = 1000) {
  if (ratio === 0) return 0;
  // ratio 50 = 1000회 기준으로 추정
  return Math.round((ratio / 50) * baseVolume);
}

/**
 * 클라이언트 정보 조회
 */
async function getClient() {
  const { data, error } = await supabase
    .from(TABLES.CLIENTS)
    .select('id, client_name, client_id')
    .eq('is_active', true)
    .single();

  if (error) {
    throw new Error(`클라이언트 조회 실패: ${error.message}`);
  }

  return data;
}

/**
 * Supabase에 데이터 저장
 */
async function saveToSupabase(clientId, records) {
  if (records.length === 0) return 0;

  const { error } = await supabase
    .from(TABLES.KEYWORD_STATS)
    .upsert(records, {
      onConflict: 'client_id,year_month,keyword',
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
 * 메인 함수
 */
async function main() {
  console.log('🔍 네이버 데이터랩 상호명 검색량 수집 시작\n');

  // 환경변수 확인
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ 환경변수 설정 필요:');
    console.error('   NAVER_DATALAB_CLIENT_ID, NAVER_DATALAB_CLIENT_SECRET');
    return;
  }

  // 날짜 계산
  const args = process.argv.slice(2);
  let startDate, endDate;

  if (args.includes('--year')) {
    const yearIndex = args.indexOf('--year');
    const year = args[yearIndex + 1] || new Date().getFullYear();
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else {
    const monthsIndex = args.indexOf('--months');
    const months = monthsIndex !== -1 ? parseInt(args[monthsIndex + 1]) || 12 : 12;

    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    startDate = start.toISOString().split('T')[0];
    endDate = end.toISOString().split('T')[0];
  }

  console.log(`📅 기간: ${startDate} ~ ${endDate}`);

  try {
    // 클라이언트 정보 조회
    const client = await getClient();
    console.log(`👤 클라이언트: ${client.client_name}\n`);

    const allRecords = [];

    // PC 검색량 조회
    console.log('💻 PC 검색량 조회 중...');
    const pcData = await callDatalabAPI(startDate, endDate, KEYWORD_GROUPS, 'pc');

    // 모바일 검색량 조회
    console.log('📱 모바일 검색량 조회 중...');
    const mobileData = await callDatalabAPI(startDate, endDate, KEYWORD_GROUPS, 'mo');

    // 데이터 병합 및 변환
    console.log('\n📊 데이터 처리 중...');

    // PC 데이터 매핑
    const dataMap = new Map(); // key: `${year_month}_${keyword}`

    if (pcData.results) {
      for (const result of pcData.results) {
        const keyword = result.title;
        for (const point of result.data) {
          const yearMonth = point.period.substring(0, 7); // YYYY-MM
          const key = `${yearMonth}_${keyword}`;

          if (!dataMap.has(key)) {
            dataMap.set(key, {
              client_id: client.id,
              year_month: yearMonth,
              keyword: keyword,
              pc_searches: 0,
              mobile_searches: 0,
            });
          }

          dataMap.get(key).pc_searches = estimateSearchVolume(point.ratio);
        }
      }
    }

    // 모바일 데이터 병합
    if (mobileData.results) {
      for (const result of mobileData.results) {
        const keyword = result.title;
        for (const point of result.data) {
          const yearMonth = point.period.substring(0, 7);
          const key = `${yearMonth}_${keyword}`;

          if (!dataMap.has(key)) {
            dataMap.set(key, {
              client_id: client.id,
              year_month: yearMonth,
              keyword: keyword,
              pc_searches: 0,
              mobile_searches: 0,
            });
          }

          dataMap.get(key).mobile_searches = estimateSearchVolume(point.ratio);
        }
      }
    }

    // 레코드 배열로 변환
    const records = Array.from(dataMap.values());

    console.log(`\n📈 수집된 데이터:`);
    records.forEach(r => {
      console.log(`   ${r.year_month} | ${r.keyword}: PC ${r.pc_searches}, 모바일 ${r.mobile_searches}`);
    });

    // Supabase에 저장
    if (records.length > 0) {
      const savedCount = await saveToSupabase(client.id, records);
      console.log(`\n✅ ${savedCount}개 레코드 저장 완료`);

      // 완료 알림
      await sendTelegramNotification(
        `✅ <b>상호명 검색량 수집 완료</b>\n\n` +
        `📅 기간: ${startDate} ~ ${endDate}\n` +
        `📊 레코드: ${savedCount}개\n` +
        `🔑 키워드: ${KEYWORD_GROUPS.map(g => g.groupName).join(', ')}`
      );
    } else {
      console.log('\n⚠️ 수집된 데이터가 없습니다.');
    }

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);

    await sendTelegramNotification(
      `❌ <b>상호명 검색량 수집 실패</b>\n\n` +
      `📅 기간: ${startDate} ~ ${endDate}\n` +
      `오류: ${error.message}`
    );
  }
}

main().catch(console.error);
