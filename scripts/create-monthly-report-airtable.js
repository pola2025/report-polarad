#!/usr/bin/env node
/**
 * 월간 리포트 생성 (Airtable 기반)
 *
 * 사용법:
 *   node create-monthly-report-airtable.js                          # 지난달 HEA 판교 리포트
 *   node create-monthly-report-airtable.js --month 1 --year 2026   # 2026년 1월
 *   node create-monthly-report-airtable.js --client naratton        # 나라똔
 *   node create-monthly-report-airtable.js --force                  # 기존 리포트 덮어쓰기
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKFILL_CHAT_ID = '-1003394139746';

// 리포트 테이블 설정
const REPORTS_BASE_ID = process.env.AIRTABLE_REPORTS_BASE_ID || 'appJlOqnadLsMJQYw';
const REPORTS_TABLE_ID = process.env.AIRTABLE_REPORTS_TABLE_ID || 'tbl4BAtILQRH7JQaG';

// 클라이언트 설정
const CLIENTS = {
  'hea-pangyo': {
    clientId: 'h-e-a-판교',
    clientName: 'H.E.A 판교',
    slug: 'hea-pangyo',
    baseId: process.env.AIRTABLE_HEA_BASE_ID,
    tableId: process.env.AIRTABLE_HEA_TABLE_ID,
    metricType: 'video', // video: 영상, lead: 리드
  },
  'naratton': {
    clientId: '나라똔',
    clientName: '나라똔',
    slug: 'naratton',
    baseId: process.env.AIRTABLE_NARATTON_BASE_ID,
    tableId: process.env.AIRTABLE_NARATTON_TABLE_ID,
    metricType: 'lead',
  },
};

// 텔레그램 알림
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: BACKFILL_CHAT_ID, text: message, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('텔레그램 알림 실패:', e.message);
  }
}

// Airtable 페이지네이션 조회
async function fetchAllRecords(baseId, tableId, formula) {
  const all = [];
  let offset = '';

  do {
    let url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}&pageSize=100`;
    if (offset) url += `&offset=${offset}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const data = await res.json();

    if (data.error) {
      console.error('Airtable 조회 오류:', data.error);
      break;
    }

    all.push(...(data.records || []));
    offset = data.offset || '';
  } while (offset);

  return all;
}

// 날짜 범위 계산
function getMonthRange(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  // Airtable <= 버그 우회: endDate + 1일
  const nextMonth = new Date(year, month, 1);
  const nextDay = nextMonth.toISOString().split('T')[0];
  return { start, end, nextDay };
}

// 이전 월 계산
function getPrevMonth(year, month) {
  let py = year, pm = month - 1;
  if (pm === 0) { pm = 12; py -= 1; }
  return { year: py, month: pm };
}

// 광고 데이터 조회
async function getAdData(baseId, tableId, startDate, nextDay, source) {
  let formula = `AND({date}>='${startDate}', {date}<'${nextDay}')`;
  if (source) {
    formula = `AND({date}>='${startDate}', {date}<'${nextDay}', {source}='${source}')`;
  }
  return fetchAllRecords(baseId, tableId, formula);
}

// 변화율 계산
function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

// 기존 리포트 확인
async function findExistingReport(clientId, year, month) {
  const formula = `AND({client_id}='${clientId}', {report_type}='monthly', {year}=${year}, {month}=${month})`;
  const records = await fetchAllRecords(REPORTS_BASE_ID, REPORTS_TABLE_ID, formula);
  return records.length > 0 ? records[0] : null;
}

// 리포트 생성
async function createReport(clientKey, year, month, force = false) {
  const client = CLIENTS[clientKey];
  if (!client) {
    console.error(`클라이언트 없음: ${clientKey}`);
    return;
  }

  const range = getMonthRange(year, month);
  console.log(`\n📊 ${client.clientName} ${year}년 ${month}월 월간 리포트 생성`);
  console.log(`   기간: ${range.start} ~ ${range.end}`);

  // 기존 리포트 확인
  const existing = await findExistingReport(client.clientId, year, month);
  if (existing && !force) {
    const existingId = existing.fields.id;
    console.log(`   ⚠️ 이미 존재하는 리포트: ${existingId}`);
    console.log(`   --force 옵션으로 덮어쓰기 가능`);
    return existingId;
  }

  // Meta 데이터 조회
  const metaRecords = await getAdData(client.baseId, client.tableId, range.start, range.nextDay, 'meta');
  const metaTotals = metaRecords.reduce((acc, r) => {
    const f = r.fields;
    acc.impressions += f.impressions || 0;
    acc.clicks += f.clicks || 0;
    acc.spend += f.spend || 0; // 이미 KRW
    acc.leads += f.leads || 0;
    acc.videoViews += f.video_views || 0;
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0, leads: 0, videoViews: 0 });

  // Naver 데이터 조회
  const naverRecords = await getAdData(client.baseId, client.tableId, range.start, range.nextDay);
  const naverData = naverRecords.filter(r => {
    const src = r.fields.source;
    const kw = (r.fields.keywords || '').toLowerCase();
    return (src === 'naver_place' || src === 'naver_brand_search') && kw !== 'total' && kw !== '_total_';
  });

  const naverTotals = naverData.reduce((acc, r) => {
    const f = r.fields;
    acc.impressions += f.impressions || 0;
    acc.clicks += f.clicks || 0;
    acc.spend += f.spend || 0;
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0 });

  const totalImpressions = metaTotals.impressions + naverTotals.impressions;
  const totalClicks = metaTotals.clicks + naverTotals.clicks;
  const totalSpend = metaTotals.spend + naverTotals.spend;
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const cpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0;

  console.log(`\n📈 집계 결과:`);
  console.log(`   Meta: 노출 ${metaTotals.impressions.toLocaleString()}, 클릭 ${metaTotals.clicks}, 비용 ${metaTotals.spend.toLocaleString()}원`);
  console.log(`   Naver: 노출 ${naverTotals.impressions.toLocaleString()}, 클릭 ${naverTotals.clicks}, 비용 ${naverTotals.spend.toLocaleString()}원`);
  console.log(`   합계: 노출 ${totalImpressions.toLocaleString()}, 클릭 ${totalClicks}, CTR ${ctr}%`);

  if (totalImpressions === 0) {
    console.log(`   ❌ 데이터가 없어 리포트 생성 중단`);
    return null;
  }

  // 이전 달 데이터 (비교용)
  const prev = getPrevMonth(year, month);
  const prevRange = getMonthRange(prev.year, prev.month);
  const prevMetaRecords = await getAdData(client.baseId, client.tableId, prevRange.start, prevRange.nextDay, 'meta');
  const prevMetaTotals = prevMetaRecords.reduce((acc, r) => {
    acc.impressions += r.fields.impressions || 0;
    acc.clicks += r.fields.clicks || 0;
    acc.spend += r.fields.spend || 0;
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0 });

  const prevNaverRecords = await getAdData(client.baseId, client.tableId, prevRange.start, prevRange.nextDay);
  const prevNaverData = prevNaverRecords.filter(r => {
    const src = r.fields.source;
    return src === 'naver_place' || src === 'naver_brand_search';
  });
  const prevNaverTotals = prevNaverData.reduce((acc, r) => {
    acc.impressions += r.fields.impressions || 0;
    acc.clicks += r.fields.clicks || 0;
    acc.spend += r.fields.spend || 0;
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0 });

  const prevTotalImpressions = prevMetaTotals.impressions + prevNaverTotals.impressions;
  const prevTotalClicks = prevMetaTotals.clicks + prevNaverTotals.clicks;
  const prevTotalSpend = prevMetaTotals.spend + prevNaverTotals.spend;

  const impressionChange = calcChange(totalImpressions, prevTotalImpressions);
  const clickChange = calcChange(totalClicks, prevTotalClicks);
  const spendChange = calcChange(totalSpend, prevTotalSpend);

  // 리포트 ID 생성
  const reportId = crypto.randomUUID();
  const now = new Date().toISOString();

  // AI 인사이트 생성
  const aiInsights = {
    summary: `${month}월 총 노출수 ${totalImpressions.toLocaleString()}회, 클릭수 ${totalClicks.toLocaleString()}회로 CTR ${ctr}%를 달성했습니다. 전월 대비 노출 ${impressionChange > 0 ? '+' : ''}${impressionChange}%, 클릭 ${clickChange > 0 ? '+' : ''}${clickChange}% 변동했습니다.`,
    highlights: [
      `전월 대비 노출 ${impressionChange > 0 ? '+' : ''}${impressionChange}% 변동`,
      `CTR ${ctr}% 달성`,
      `총 광고비 ${Math.round(totalSpend / 10000)}만원`,
      metaTotals.videoViews > 0 ? `영상 조회수 ${metaTotals.videoViews.toLocaleString()}회` : null,
      metaTotals.leads > 0 && client.metricType !== 'video' ? `리드 ${metaTotals.leads}건 확보` : null,
    ].filter(Boolean),
    generatedAt: now,
    platforms: {
      meta: {
        impressions: metaTotals.impressions,
        clicks: metaTotals.clicks,
        spend: metaTotals.spend,
        videoViews: metaTotals.videoViews,
        leads: metaTotals.leads,
      },
      naver: {
        impressions: naverTotals.impressions,
        clicks: naverTotals.clicks,
        spend: naverTotals.spend,
      },
    },
    comparison: {
      impressions: { current: totalImpressions, previous: prevTotalImpressions, change: impressionChange },
      clicks: { current: totalClicks, previous: prevTotalClicks, change: clickChange },
      spend: { current: totalSpend, previous: prevTotalSpend, change: spendChange },
    },
  };

  // 기존 리포트 삭제 (force 모드)
  if (existing && force) {
    await fetch(`https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}/${existing.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    console.log(`   🗑️ 기존 리포트 삭제됨`);
  }

  // Airtable에 리포트 생성
  const res = await fetch(`https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [{
        fields: {
          id: reportId,
          client_id: client.clientId,
          client_slug: client.slug,
          report_type: 'monthly',
          period_start: range.start,
          period_end: range.end,
          year,
          month,
          status: 'published',
          published_at: now,
          ai_insights: JSON.stringify(aiInsights),
          ai_generated_at: now,
          created_at: now,
          updated_at: now,
          created_by: 'script',
        },
      }],
    }),
  });

  const result = await res.json();
  if (result.error) {
    throw new Error(`리포트 저장 실패: ${result.error.message}`);
  }

  const reportUrl = `https://report.polarad.co.kr/report/monthly/${reportId}`;
  console.log(`\n✅ 월간 리포트 생성 완료!`);
  console.log(`   ID: ${reportId}`);
  console.log(`   URL: ${reportUrl}`);

  await sendTelegram(
    `✅ <b>${client.clientName} ${year}년 ${month}월 월간 리포트</b>\n\n` +
    `📅 기간: ${range.start} ~ ${range.end}\n` +
    `📊 노출: ${totalImpressions.toLocaleString()}회 (${impressionChange > 0 ? '+' : ''}${impressionChange}%)\n` +
    `🖱️ 클릭: ${totalClicks.toLocaleString()}회 (CTR ${ctr}%)\n` +
    `💰 광고비: ${Math.round(totalSpend / 10000)}만원\n\n` +
    `🔗 ${reportUrl}`
  );

  return reportId;
}

// 메인 함수
async function main() {
  console.log('🚀 월간 리포트 생성 (Airtable)\n');

  const args = process.argv.slice(2);
  const force = args.includes('--force');

  // 클라이언트 지정
  let clientKey = 'hea-pangyo'; // 기본값
  const clientIdx = args.indexOf('--client');
  if (clientIdx !== -1) clientKey = args[clientIdx + 1];

  // 연도/월 지정
  let year, month;
  const yearIdx = args.indexOf('--year');
  const monthIdx = args.indexOf('--month');

  if (yearIdx !== -1) year = parseInt(args[yearIdx + 1]);
  if (monthIdx !== -1) {
    month = parseInt(args[monthIdx + 1]);
    if (!year) year = new Date().getFullYear();
  } else {
    // 기본: 지난달
    const now = new Date();
    month = now.getMonth(); // 0-indexed = 지난달
    if (month === 0) { month = 12; year = (year || now.getFullYear()) - 1; }
    else { year = year || now.getFullYear(); }
  }

  try {
    const id = await createReport(clientKey, year, month, force);
    if (id) console.log(`\n🎉 완료! ID: ${id}`);
  } catch (e) {
    console.error(`\n❌ 오류: ${e.message}`);
    process.exit(1);
  }
}

main();
