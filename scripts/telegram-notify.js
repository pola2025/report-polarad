/**
 * 텔레그램 리포트 자동 알림 스크립트
 * GitHub Actions에서 주간/월간 리포트 알림을 자동 발송
 *
 * 환경변수:
 * - TELEGRAM_BOT_TOKEN: 텔레그램 봇 토큰
 * - TELEGRAM_CHAT_ID: 알림 받을 채팅 ID
 * - SUPABASE_URL: Supabase URL
 * - SUPABASE_SERVICE_KEY: Supabase 서비스 키
 * - REPORT_TYPE: 'weekly' 또는 'monthly'
 */

const https = require('https');

// 환경변수에서 설정 로드
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REPORT_TYPE = process.env.REPORT_TYPE || 'weekly';
const REPORT_BASE_URL = 'https://report.polarad.co.kr';

// 환경변수 검증
function validateEnv() {
  const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ 필수 환경변수 누락:', missing.join(', '));
    process.exit(1);
  }
}

// Supabase API 호출
function supabaseRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SUPABASE_URL);

    const reqOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`JSON 파싱 실패: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 최신 리포트 조회
async function getLatestReport(reportType) {
  const endpoint = `/rest/v1/polarad_reports?report_type=eq.${reportType}&order=period_end.desc&limit=1`;
  const reports = await supabaseRequest(endpoint);

  if (!reports || reports.length === 0) {
    throw new Error(`${reportType} 리포트를 찾을 수 없습니다.`);
  }

  return reports[0];
}

// 리포트 기간 데이터 조회 (Meta + Naver)
async function getReportData(clientUuid, startDate, endDate) {
  const metaEndpoint = `/rest/v1/polarad_meta_data?client_id=eq.${clientUuid}&date=gte.${startDate}&date=lte.${endDate}&select=impressions,clicks,spend`;
  const naverEndpoint = `/rest/v1/polarad_naver_data?client_id=eq.${clientUuid}&date=gte.${startDate}&date=lte.${endDate}&select=impressions,clicks,cost`;

  const [metaData, naverData] = await Promise.all([
    supabaseRequest(metaEndpoint),
    supabaseRequest(naverEndpoint)
  ]);

  // Meta 합계
  const metaTotals = (metaData || []).reduce((acc, row) => ({
    impressions: acc.impressions + (row.impressions || 0),
    clicks: acc.clicks + (row.clicks || 0),
    spend: acc.spend + (row.spend || 0)
  }), { impressions: 0, clicks: 0, spend: 0 });

  // Naver 합계
  const naverTotals = (naverData || []).reduce((acc, row) => ({
    impressions: acc.impressions + (row.impressions || 0),
    clicks: acc.clicks + (row.clicks || 0),
    cost: acc.cost + (row.cost || 0)
  }), { impressions: 0, clicks: 0, cost: 0 });

  return {
    meta: metaTotals,
    naver: naverTotals,
    hasNaver: naverData && naverData.length > 0,
    total: {
      impressions: metaTotals.impressions + naverTotals.impressions,
      clicks: metaTotals.clicks + naverTotals.clicks,
      spend: metaTotals.spend + naverTotals.cost
    }
  };
}

// 클라이언트 정보 조회
async function getClientInfo(clientId) {
  const endpoint = `/rest/v1/polarad_clients?client_id=eq.${encodeURIComponent(clientId)}&limit=1`;
  const clients = await supabaseRequest(endpoint);

  if (!clients || clients.length === 0) {
    throw new Error(`클라이언트를 찾을 수 없습니다: ${clientId}`);
  }

  return clients[0];
}

// 숫자 포맷팅
function formatNumber(num) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(num));
}

// 금액 포맷팅 (만원 단위)
function formatMoney(amount) {
  const manwon = Math.round(amount / 10000);
  return `약 ${formatNumber(manwon)}만원`;
}

// CTR 계산
function calcCTR(clicks, impressions) {
  if (impressions === 0) return '0.00';
  return ((clicks / impressions) * 100).toFixed(2);
}

// 날짜 포맷팅
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\. /g, '.').replace(/\.$/, '');
}

// 텔레그램 메시지 발송
function sendTelegramMessage(message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.ok) {
          resolve(result);
        } else {
          reject(new Error(result.description));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 주간 리포트 메시지 생성
function buildWeeklyMessage(report, data, clientName) {
  const periodStart = formatDate(report.period_start);
  const periodEnd = formatDate(report.period_end);
  const ctr = calcCTR(data.total.clicks, data.total.impressions);

  let message = `📊 <b>${clientName} 주간 광고 성과 리포트</b>

안녕하세요, 폴라애드 광고운영팀입니다.
${report.title} 리포트가 발행되었습니다.

━━━━━━━━━━━━━━━━━━━━

📅 <b>${report.title}</b>
   기간: ${periodStart} ~ ${periodEnd}

   • 총 노출: ${formatNumber(data.total.impressions)}회
   • 총 클릭: ${formatNumber(data.total.clicks)}회
   • CTR: ${ctr}%
   • 광고비: ${formatMoney(data.total.spend)}

   🔗 <a href="${REPORT_BASE_URL}/report/monthly/${report.id}">리포트 보기</a>

━━━━━━━━━━━━━━━━━━━━`;

  if (report.ai_insights) {
    const summary = report.ai_insights.summary || '';
    if (summary) {
      message += `

💡 <b>AI 분석 요약</b>
${summary}`;
    }
  }

  message += `

📍 전체 리포트 목록: <a href="${REPORT_BASE_URL}/?client=hea-pangyo">대시보드 바로가기</a>`;

  if (!data.hasNaver) {
    message += `

<i>* 네이버 키워드 데이터는 월 마감 후 업데이트됩니다.</i>`;
  }

  return message;
}

// 월간 리포트 메시지 생성
function buildMonthlyMessage(report, data, clientName) {
  const periodStart = formatDate(report.period_start);
  const periodEnd = formatDate(report.period_end);
  const ctr = calcCTR(data.total.clicks, data.total.impressions);

  let message = `📊 <b>${clientName} 월간 광고 성과 리포트</b>

안녕하세요, 폴라애드 광고운영팀입니다.
${report.title} 리포트가 발행되었습니다.

━━━━━━━━━━━━━━━━━━━━

📅 <b>${report.title}</b>
   기간: ${periodStart} ~ ${periodEnd}

   • 총 노출: ${formatNumber(data.total.impressions)}회
   • 총 클릭: ${formatNumber(data.total.clicks)}회
   • CTR: ${ctr}%
   • 총 광고비: ${formatMoney(data.total.spend)}

   🔗 <a href="${REPORT_BASE_URL}/report/monthly/${report.id}">리포트 보기</a>

━━━━━━━━━━━━━━━━━━━━`;

  if (report.ai_insights) {
    const summary = report.ai_insights.summary || '';
    if (summary) {
      message += `

💡 <b>AI 분석 요약</b>
${summary}`;
    }
  }

  message += `

📍 전체 리포트 목록: <a href="${REPORT_BASE_URL}/?client=hea-pangyo">대시보드 바로가기</a>`;

  return message;
}

// 메인 함수
async function main() {
  console.log(`🚀 텔레그램 ${REPORT_TYPE} 리포트 알림 시작...`);

  validateEnv();

  try {
    // 1. 최신 리포트 조회
    console.log(`📋 최신 ${REPORT_TYPE} 리포트 조회 중...`);
    const report = await getLatestReport(REPORT_TYPE);
    console.log(`   → ${report.title} (${report.id})`);

    // 2. 클라이언트 정보 조회
    console.log('👤 클라이언트 정보 조회 중...');
    const client = await getClientInfo(report.client_id);
    console.log(`   → ${client.name}`);

    // 3. 리포트 기간 데이터 조회
    console.log('📊 리포트 데이터 조회 중...');
    const data = await getReportData(client.id, report.period_start, report.period_end);
    console.log(`   → 노출: ${formatNumber(data.total.impressions)}, 클릭: ${formatNumber(data.total.clicks)}`);

    // 4. 메시지 생성
    const message = REPORT_TYPE === 'weekly'
      ? buildWeeklyMessage(report, data, client.name)
      : buildMonthlyMessage(report, data, client.name);

    // 5. 텔레그램 발송
    console.log('📤 텔레그램 메시지 발송 중...');
    await sendTelegramMessage(message);

    console.log('✅ 텔레그램 알림 발송 완료!');

  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
    process.exit(1);
  }
}

main();
