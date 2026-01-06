/**
 * Meta API 광고 레벨 테스트 스크립트
 * 사용법: 환경변수 설정 후 실행
 */

async function testMetaApi() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('환경 변수 설정 필요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // 클라이언트 정보 조회
  const clientRes = await fetch(
    SUPABASE_URL + '/rest/v1/polarad_clients?client_name=eq.H.E.A%20%ED%8C%90%EA%B5%90&select=meta_ad_account_id,meta_access_token',
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
  );
  const clients = await clientRes.json();

  if (clients.length === 0) {
    console.log('클라이언트 없음');
    return;
  }

  const client = clients[0];
  console.log('Ad Account ID:', client.meta_ad_account_id);

  // Meta API 테스트 (광고 레벨)
  const startDate = '2025-12-01';
  const endDate = '2025-12-31';
  const fields = 'date_start,impressions,clicks,spend,actions,ad_id,ad_name,campaign_name';

  const metaUrl = 'https://graph.facebook.com/v21.0/act_' + client.meta_ad_account_id + '/insights?' +
    'fields=' + fields + '&' +
    'breakdowns=device_platform&' +
    'time_range={"since":"' + startDate + '","until":"' + endDate + '"}&' +
    'time_increment=1&' +
    'level=ad&' +
    'limit=10&' +
    'access_token=' + client.meta_access_token;

  const metaRes = await fetch(metaUrl);
  const metaData = await metaRes.json();

  if (metaData.error) {
    console.log('Meta API 오류:', metaData.error.message);
    return;
  }

  console.log('\n=== Meta API 광고 레벨 테스트 ===');
  console.log('총 레코드:', metaData.data?.length || 0);

  if (metaData.data && metaData.data.length > 0) {
    metaData.data.slice(0, 3).forEach((row, i) => {
      console.log('\n--- ' + (i+1) + ' ---');
      console.log('date:', row.date_start);
      console.log('ad_id:', row.ad_id);
      console.log('ad_name:', row.ad_name);
      console.log('campaign_name:', row.campaign_name);
      console.log('device:', row.device_platform);
      console.log('impressions:', row.impressions, 'clicks:', row.clicks, 'spend:', row.spend);
    });
  }
}

testMetaApi().catch(e => console.error('Error:', e.message));
