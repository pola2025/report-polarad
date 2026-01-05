require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const crypto = require('crypto');

const NAVER_API_BASE = 'https://api.searchad.naver.com';
const CUSTOMER_ID = process.env.NAVER_CUSTOMER_ID;
const API_KEY = process.env.NAVER_API_KEY;
const SECRET_KEY = process.env.NAVER_SECRET_KEY;

function generateSignature(timestamp, method, uri) {
  const message = `${timestamp}.${method}.${uri}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(message);
  return hmac.digest('base64');
}

function getNaverHeaders(method, uri) {
  const timestamp = String(Date.now());
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Timestamp': timestamp,
    'X-API-KEY': API_KEY,
    'X-Customer': CUSTOMER_ID,
    'X-Signature': generateSignature(timestamp, method, uri),
  };
}

async function callNaverAPI(method, uri, body = null) {
  // 서명은 원본 URI 경로만 사용 (쿼리스트링 제외)
  const uriPath = uri.split('?')[0];
  const headers = getNaverHeaders(method, uriPath);
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  console.log(`API: ${method} ${uri}`);
  const response = await fetch(NAVER_API_BASE + uri, options);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  // 캠페인 목록 조회
  console.log('=== 캠페인 목록 ===');
  const campaigns = await callNaverAPI('GET', '/ncc/campaigns');
  console.log('캠페인 수:', campaigns.length);
  campaigns.forEach(c => console.log(`  - ${c.name} (${c.nccCampaignId}) [${c.campaignTp}]`));

  // 광고그룹 목록 조회
  console.log('\n=== 광고그룹 목록 ===');
  const adgroups = await callNaverAPI('GET', '/ncc/adgroups');
  console.log('광고그룹 수:', adgroups.length);
  adgroups.forEach(g => console.log(`  - ${g.name} (${g.nccAdgroupId}) [캠페인: ${g.nccCampaignId}]`));

  // Stats API로 통계 조회
  if (adgroups.length > 0) {
    const groupIds = adgroups.map(g => g.nccAdgroupId);
    console.log('\n=== Stats API 테스트 ===');
    console.log('광고그룹 IDs:', groupIds.join(', '));

    // /stats API 호출 (URL 인코딩)
    const ids = groupIds.join(',');
    const fields = encodeURIComponent('["impCnt","clkCnt","ctr","ccnt"]');
    const timeRange = encodeURIComponent('{"since":"2025-12-01","until":"2025-12-31"}');
    const statsUri = `/stats?ids=${ids}&fields=${fields}&timeRange=${timeRange}`;

    console.log('URI:', statsUri);
    const stats = await callNaverAPI('GET', statsUri);
    console.log('\nStats 응답:');
    console.log(JSON.stringify(stats, null, 2));
  }
}

main().catch(console.error);
