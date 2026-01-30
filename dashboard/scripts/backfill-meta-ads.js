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
  '비즈액터스쿨': {
    baseId: process.env.AIRTABLE_BAS_BASE_ID,
    tableId: process.env.AIRTABLE_BAS_TABLE_ID,
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

// Airtable에서 해당 기간의 기존 레코드 일괄 조회 (성능 최적화)
async function loadExistingRecords(baseId, tableId, startDate, endDate, source) {
  const records = [];
  let offset = '';

  do {
    const formula = encodeURIComponent(`AND({date}>='${startDate}', {date}<='${endDate}', {source}='${source}')`);
    let url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${formula}&pageSize=100`;
    if (offset) url += `&offset=${offset}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const data = await response.json();
    records.push(...(data.records || []));
    offset = data.offset || '';
  } while (offset);

  // date+ad_id+device 키로 맵 생성
  const map = new Map();
  records.forEach(r => {
    const key = `${r.fields.date}|${r.fields.ad_id || ''}|${r.fields.device || ''}`;
    map.set(key, r);
  });

  return map;
}

// Airtable에서 기존 레코드 조회 (단건 - 폴백용)
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
  if (!config || !config.baseId || !config.tableId) {
    throw new Error(`Airtable 설정 없음 또는 환경변수 미설정: ${clientName}`);
  }

  console.log(`\n📦 ${clientName} 백필 시작...`);
  console.log(`  기간: ${startDate} ~ ${endDate}`);

  // Meta API 호출
  process.stdout.write('  Meta API 호출: ');
  const rawData = await fetchMetaData(accessToken, adAccountId, startDate, endDate);

  // 기존 레코드 일괄 로드 (UPSERT 강화)
  process.stdout.write('  기존 레코드 로드: ');
  const existingMap = await loadExistingRecords(config.baseId, config.tableId, startDate, endDate, 'meta');
  console.log(`${existingMap.size}개 로드됨`);

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

    // 기존 레코드 확인 (일괄 로드된 맵에서 먼저 확인)
    const key = `${date}|${adId}|${device}`;
    let existing = existingMap.get(key);

    // 맵에 없으면 API로 직접 확인 (신규 데이터일 수 있음)
    if (!existing) {
      existing = await findExistingRecord(config.baseId, config.tableId, date, source, adId, device);
    }

    if (existing) {
      if (existing.fields.is_finalized === true) {
        skipped++;
        continue;
      }
      await updateAirtableRecord(config.baseId, config.tableId, existing.id, fields);
      updated++;
      // 맵 업데이트 (다음 중복 방지)
      existingMap.set(key, { id: existing.id, fields });
    } else {
      await createAirtableRecord(config.baseId, config.tableId, fields);
      created++;
      // 맵에 추가 (다음 중복 방지)
      existingMap.set(key, { id: 'new', fields });
    }

    // Rate limit 방지 (50ms로 단축)
    await new Promise(r => setTimeout(r, 50));

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
  // 클라이언트 지정 필수!
  const targetClient = process.env.CLIENT;
  if (!targetClient) {
    console.error('❌ CLIENT 환경변수 필수!');
    console.error('');
    console.error('사용법:');
    console.error('  CLIENT=나라똔 BACKFILL_START=2026-01-01 BACKFILL_END=2026-01-06 node --env-file=.env.local scripts/backfill-meta-ads.js');
    console.error('  CLIENT="H.E.A 판교" BACKFILL_START=2026-01-01 BACKFILL_END=2026-01-06 node --env-file=.env.local scripts/backfill-meta-ads.js');
    console.error('');
    console.error('가능한 클라이언트: 나라똔, H.E.A 판교, 비즈액터스쿨');
    process.exit(1);
  }

  // 날짜 설정 필수!
  const startDate = process.env.BACKFILL_START;
  const endDate = process.env.BACKFILL_END;
  if (!startDate || !endDate) {
    console.error('❌ BACKFILL_START, BACKFILL_END 환경변수 필수!');
    console.error('');
    console.error('사용법:');
    console.error('  CLIENT=나라똔 BACKFILL_START=2026-01-01 BACKFILL_END=2026-01-06 node --env-file=.env.local scripts/backfill-meta-ads.js');
    process.exit(1);
  }

  console.log('🔄 Meta 광고 레벨 백필 시작');
  console.log('='.repeat(50));
  console.log(`  대상 클라이언트: ${targetClient}`);
  console.log(`  기간: ${startDate} ~ ${endDate}`);
  console.log('='.repeat(50));

  // 지정된 클라이언트만 조회
  const clientRes = await fetch(
    SUPABASE_URL + `/rest/v1/polarad_clients?client_name=eq.${encodeURIComponent(targetClient)}&select=client_name,meta_ad_account_id,meta_access_token`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
  );
  const clients = await clientRes.json();

  if (!clients || clients.length === 0) {
    console.error(`❌ 클라이언트를 찾을 수 없음: ${targetClient}`);
    process.exit(1);
  }

  const client = clients[0];
  if (!client.meta_ad_account_id || !client.meta_access_token) {
    console.error(`❌ ${client.client_name}: Meta 계정 정보 없음`);
    process.exit(1);
  }

  try {
    const result = await backfillClient(
      client.client_name,
      client.meta_access_token,
      client.meta_ad_account_id,
      startDate,
      endDate
    );
    console.log('\n' + '='.repeat(50));
    console.log('✅ 백필 완료');
    console.log(`  생성: ${result.created}개`);
    console.log(`  업데이트: ${result.updated}개`);
    console.log(`  스킵: ${result.skipped}개`);
  } catch (e) {
    console.error(`❌ ${client.client_name}: ${e.message}`);
    process.exit(1);
  }
}

main().catch(e => console.error('Error:', e.message));
