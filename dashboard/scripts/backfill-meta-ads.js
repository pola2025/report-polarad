/**
 * Meta 광고 레벨 데이터 백필 스크립트
 *
 * - level=ad로 광고별 데이터 수집
 * - date + source + ad_id로 중복 체크
 */

// 환경 변수에서 읽기 (node --env-file=.env.local 로 실행)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !AIRTABLE_TOKEN) {
  console.error('필수 환경 변수가 설정되지 않았습니다.');
  console.error('사용법: 환경변수 설정 후 실행');
  console.error('  node scripts/backfill-meta-ads.js');
  process.exit(1);
}

const AIRTABLE_CONFIG = {
  'H.E.A 판교': {
    baseId: 'appJlOqnadLsMJQYw',
    tableId: 'tbl8ftclEFG5ypohX',
  },
  '나라똔': {
    baseId: 'appN2KzUoORRrb8X9',
    tableId: 'tblmC9Ft2ioXKXsrL',
  },
};

// actions 배열에서 특정 action_type 값 추출
function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find((a) => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

// Meta API 호출 (광고 레벨, 영상 데이터 포함, 페이지네이션)
async function fetchMetaData(accessToken, adAccountId, startDate, endDate) {
  const fields = 'date_start,impressions,clicks,spend,actions,ad_id,ad_name,campaign_name,video_play_actions,video_thruplay_watched_actions,video_avg_time_watched_actions';
  const allData = [];

  let url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?` +
    `fields=${fields}&` +
    `breakdowns=device_platform&` +
    `time_range={"since":"${startDate}","until":"${endDate}"}&` +
    `time_increment=1&` +
    `level=ad&` +
    `limit=500&` +
    `access_token=${accessToken}`;

  let pageCount = 0;
  while (url) {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta API 오류: ${data.error.message}`);
    }

    if (data.data) {
      allData.push(...data.data);
      pageCount++;
      process.stdout.write(`  페이지 ${pageCount} (${data.data.length}개)...`);
    }

    url = data.paging?.next || '';
  }
  console.log(` 총 ${allData.length}개`);

  return allData;
}

// Airtable에서 기존 레코드 조회 (device 포함)
async function findExistingRecord(baseId, tableId, date, source, adId, device) {
  const formula = `AND({date}='${date}', {source}='${source}', {ad_id}='${adId}', {device}='${device}')`;
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  });

  const data = await response.json();
  return data.records?.[0] || null;
}

// Airtable 레코드 생성
async function createAirtableRecord(baseId, tableId, fields) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Airtable 생성 오류: ${data.error.message}`);
  }
}

// Airtable 레코드 업데이트
async function updateAirtableRecord(baseId, tableId, recordId, fields) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Airtable 업데이트 오류: ${data.error.message}`);
  }
}

// 클라이언트별 백필
async function backfillClient(clientName, accessToken, adAccountId, startDate, endDate) {
  const config = AIRTABLE_CONFIG[clientName];
  if (!config) {
    throw new Error(`Airtable 설정 없음: ${clientName}`);
  }

  console.log(`\n📦 ${clientName} 백필 시작...`);
  console.log(`  기간: ${startDate} ~ ${endDate}`);

  // Meta API 호출
  process.stdout.write('  Meta API 호출: ');
  const rawData = await fetchMetaData(accessToken, adAccountId, startDate, endDate);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`  Airtable 저장 중...`);
  for (const row of rawData) {
    const date = row.date_start;
    const device = row.device_platform?.toLowerCase() || 'unknown';
    const source = 'meta';
    const adId = row.ad_id || '';
    const adName = row.ad_name || '';
    const campaignName = row.campaign_name || '';

    // 영상 데이터 추출
    const videoViews = row.video_play_actions?.[0]?.value
      ? parseInt(row.video_play_actions[0].value) : 0;
    const videoThruplay = row.video_thruplay_watched_actions?.[0]?.value
      ? parseInt(row.video_thruplay_watched_actions[0].value) : 0;
    // 평균 시청 시간 (초 단위)
    const avgWatchTime = row.video_avg_time_watched_actions?.[0]?.value
      ? parseFloat(row.video_avg_time_watched_actions[0].value) : 0;

    const fields = {
      date,
      device,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      spend: Math.round(parseFloat(row.spend) || 0),
      source,
      ad_id: adId,
      campaign_name: `${adName}${campaignName ? ` (${campaignName})` : ''}`,
      video_views: videoViews,
      video_thruplay: videoThruplay,
      avg_watch_time: avgWatchTime,
      keywords: '',
      is_finalized: false,
    };

    // 나라똔은 리드 수집
    if (clientName !== 'H.E.A 판교') {
      fields.leads = getActionValue(row.actions, 'lead');
    }

    // 기존 레코드 확인 (device 포함)
    const existing = await findExistingRecord(config.baseId, config.tableId, date, source, adId, device);

    if (existing) {
      if (existing.fields.is_finalized === true) {
        skipped++;
        continue;
      }
      await updateAirtableRecord(config.baseId, config.tableId, existing.id, fields);
      updated++;
    } else {
      await createAirtableRecord(config.baseId, config.tableId, fields);
      created++;
    }

    // Rate limit 방지 (100ms)
    await new Promise(r => setTimeout(r, 100));

    // 진행 상황 표시
    if ((created + updated + skipped) % 50 === 0) {
      process.stdout.write('.');
    }
  }

  console.log(`\n  ✅ 완료: 생성 ${created}개, 업데이트 ${updated}개, 스킵 ${skipped}개`);
  return { created, updated, skipped };
}

// 메인 함수
async function main() {
  // 날짜 설정 (12월 전체)
  const startDate = '2025-12-01';
  const endDate = '2025-12-31';

  console.log('🔄 Meta 광고 레벨 백필 시작');
  console.log('='.repeat(50));

  // 활성 클라이언트 조회
  const clientRes = await fetch(
    SUPABASE_URL + '/rest/v1/polarad_clients?is_active=eq.true&select=client_name,meta_ad_account_id,meta_access_token',
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
  );
  const clients = await clientRes.json();

  const results = {};
  let totalCreated = 0;
  let totalUpdated = 0;

  for (const client of clients) {
    if (!client.meta_ad_account_id || !client.meta_access_token) {
      console.log(`⏭️  ${client.client_name}: Meta 계정 정보 없음, 스킵`);
      continue;
    }

    try {
      const result = await backfillClient(
        client.client_name,
        client.meta_access_token,
        client.meta_ad_account_id,
        startDate,
        endDate
      );
      results[client.client_name] = result;
      totalCreated += result.created;
      totalUpdated += result.updated;
    } catch (e) {
      console.error(`❌ ${client.client_name}: ${e.message}`);
      results[client.client_name] = { error: e.message };
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ 백필 완료');
  console.log(`  총 생성: ${totalCreated}개`);
  console.log(`  총 업데이트: ${totalUpdated}개`);
}

main().catch(e => console.error('Error:', e.message));
