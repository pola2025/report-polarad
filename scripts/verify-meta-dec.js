// Meta API에서 나라똔 12월 데이터 직접 조회
require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchMetaData(accessToken, adAccountId, startDate, endDate) {
  const fields = [
    'date_start',
    'campaign_id',
    'campaign_name',
    'impressions',
    'clicks',
    'spend',
    'actions',
  ].join(',');

  const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?` +
    `fields=${fields}&` +
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

async function main() {
  // 나라똔 클라이언트 정보 조회
  const { data: clients, error } = await supabase
    .from('polarad_clients')
    .select('id, client_name, meta_ad_account_id, meta_access_token')
    .ilike('client_name', '%나라똔%')
    .single();

  if (error || !clients) {
    console.error('클라이언트 조회 실패:', error?.message);
    return;
  }

  console.log('===== Meta API 직접 조회: 나라똔 12월 =====');
  console.log('클라이언트:', clients.client_name);
  console.log('Ad Account ID:', clients.meta_ad_account_id);

  try {
    const data = await fetchMetaData(
      clients.meta_access_token,
      clients.meta_ad_account_id,
      '2025-12-01',
      '2025-12-31'
    );

    console.log('\nMeta API 응답 레코드:', data.length + '개');

    const totalSpend = data.reduce((sum, r) => sum + parseFloat(r.spend || 0), 0);
    const totalImpressions = data.reduce((sum, r) => sum + parseInt(r.impressions || 0), 0);
    const totalClicks = data.reduce((sum, r) => sum + parseInt(r.clicks || 0), 0);

    console.log('\n총 지출 (USD):', totalSpend.toFixed(2));
    console.log('총 지출 (KRW, 1USD=1500원):', Math.round(totalSpend * 1500).toLocaleString() + '원');
    console.log('총 노출:', totalImpressions.toLocaleString());
    console.log('총 클릭:', totalClicks.toLocaleString());

    // 일별 상세
    console.log('\n일별 상세 (USD):');
    const byDate = {};
    data.forEach(r => {
      const d = r.date_start;
      if (!byDate[d]) byDate[d] = { spend: 0, imp: 0, clicks: 0 };
      byDate[d].spend += parseFloat(r.spend || 0);
      byDate[d].imp += parseInt(r.impressions || 0);
      byDate[d].clicks += parseInt(r.clicks || 0);
    });

    Object.keys(byDate).sort().forEach(d => {
      const v = byDate[d];
      console.log(`${d}: $${v.spend.toFixed(2)} | 노출:${v.imp} | 클릭:${v.clicks}`);
    });

  } catch (err) {
    console.error('Meta API 오류:', err.message);
  }
}

main();
