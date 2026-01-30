/**
 * BAS 데이터 마이그레이션: Supabase raw_data → Airtable (ad 레벨)
 *
 * 기존 BAS 프로젝트의 Supabase raw_data 테이블에서
 * ad-level 데이터를 읽어 Airtable에 저장
 *
 * 1. Airtable 기존 캠페인 레벨 데이터 삭제
 * 2. Supabase raw_data에서 BAS 광고 데이터 조회
 * 3. Airtable에 ad_id 포함하여 저장
 *
 * 사용법:
 *   node --env-file=.env.local scripts/migrate-bas-to-ad-level.js
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const BAS_BASE_ID = process.env.AIRTABLE_BAS_BASE_ID;
const BAS_TABLE_ID = process.env.AIRTABLE_BAS_TABLE_ID;

if (!SUPABASE_URL || !SUPABASE_KEY || !AIRTABLE_TOKEN || !BAS_BASE_ID || !BAS_TABLE_ID) {
  console.error('필수 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AIRTABLE_API_KEY, AIRTABLE_BAS_BASE_ID, AIRTABLE_BAS_TABLE_ID');
  process.exit(1);
}

// ===== Supabase 조회 =====

async function fetchSupabaseRawData() {
  console.log('📥 Supabase raw_data에서 BAS 데이터 조회...');

  // BAS client_id 조회 (clients 테이블 - BAS 프로젝트 원본)
  // client_name으로 검색 시도
  const searchNames = ['비즈액터스쿨', 'BAS', 'bas'];
  let clientId = null;
  let clientName = null;

  for (const name of searchNames) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?client_name=eq.${encodeURIComponent(name)}&select=id,client_name`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      clientId = data[0].id;
      clientName = data[0].client_name;
      break;
    }
  }

  if (!clientId) {
    // 전체 클라이언트 목록 확인
    console.error('❌ BAS 클라이언트를 찾을 수 없습니다. 사용 가능한 클라이언트:');
    const allRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?select=id,client_name&limit=30`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const allClients = await allRes.json();
    if (Array.isArray(allClients)) {
      allClients.forEach(c => console.log(`  - ${c.client_name} (${c.id})`));
    } else {
      console.log('  응답:', JSON.stringify(allClients));
    }
    process.exit(1);
  }

  console.log(`  클라이언트: ${clientName} (ID: ${clientId})`);

  // raw_data에서 BAS 데이터 조회 (페이지네이션)
  const allData = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/raw_data?client_id=eq.${clientId}&select=*&order=date.asc&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data = await res.json();

    if (!data || data.length === 0) break;
    allData.push(...data);
    offset += pageSize;
    process.stdout.write(`  ${allData.length}개 로드됨...\r`);

    if (data.length < pageSize) break;
  }

  console.log(`\n  ✅ 총 ${allData.length}개 레코드 조회`);
  return allData;
}

// ===== Airtable 삭제 =====

async function deleteAllAirtableRecords() {
  console.log('\n🗑️ Airtable 기존 캠페인 레벨 데이터 삭제...');

  // 기존 레코드 ID 수집
  const recordIds = [];
  let offset = '';

  do {
    let url = `https://api.airtable.com/v0/${BAS_BASE_ID}/${BAS_TABLE_ID}?pageSize=100`;
    if (offset) url += `&offset=${offset}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const data = await response.json();

    if (data.error) {
      console.error('Airtable 오류:', data.error);
      process.exit(1);
    }

    recordIds.push(...(data.records || []).map(r => r.id));
    offset = data.offset || '';
  } while (offset);

  console.log(`  삭제 대상: ${recordIds.length}개`);

  // 10개씩 배치 삭제 (Airtable 제한)
  for (let i = 0; i < recordIds.length; i += 10) {
    const batch = recordIds.slice(i, i + 10);
    const params = batch.map(id => `records[]=${id}`).join('&');
    const url = `https://api.airtable.com/v0/${BAS_BASE_ID}/${BAS_TABLE_ID}?${params}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const data = await response.json();
    if (data.error) {
      console.error(`  삭제 오류 (${i}~${i + batch.length}):`, data.error);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 100));
    process.stdout.write(`  ${Math.min(i + 10, recordIds.length)}/${recordIds.length} 삭제됨\r`);
  }

  console.log(`\n  ✅ ${recordIds.length}개 삭제 완료`);
}

// ===== Airtable 생성 =====

async function createAirtableRecords(rawData) {
  console.log('\n📤 Airtable에 ad-level 데이터 생성...');

  // device 매핑 (raw_data device → Airtable device)
  function mapDevice(platform, device) {
    if (device === 'mobile_app' || device === 'mobile_web' || platform === 'mobile') return 'mobile';
    if (device === 'desktop' || platform === 'desktop') return 'pc';
    return device || 'other';
  }

  let created = 0;
  let errors = 0;

  // 10개씩 배치 생성 (Airtable 제한)
  for (let i = 0; i < rawData.length; i += 10) {
    const batch = rawData.slice(i, i + 10);

    const records = batch.map(row => ({
      fields: {
        date: row.date,
        device: mapDevice(row.platform, row.device),
        impressions: row.impressions || 0,
        clicks: row.clicks || 0,
        leads: row.leads || 0,
        spend: Math.round(row.spend || 0),
        source: 'meta',
        ad_id: row.ad_id || '',
        campaign_name: `${row.ad_name || ''}${row.campaign_name ? ` (${row.campaign_name})` : ''}`,
        video_views: row.video_views || 0,
        avg_watch_time: row.avg_watch_time || 0,
        is_finalized: false,
      },
    }));

    const response = await fetch(`https://api.airtable.com/v0/${BAS_BASE_ID}/${BAS_TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records }),
    });

    const data = await response.json();
    if (data.error) {
      console.error(`  생성 오류 (${i}~${i + batch.length}):`, data.error);
      errors += batch.length;
    } else {
      created += (data.records || []).length;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 100));
    process.stdout.write(`  ${created}/${rawData.length} 생성됨 (오류: ${errors})\r`);
  }

  console.log(`\n  ✅ ${created}개 생성, ${errors}개 오류`);
  return { created, errors };
}

// ===== 메인 =====

async function main() {
  console.log('🔄 BAS 데이터 마이그레이션: Supabase raw_data → Airtable (ad-level)');
  console.log('='.repeat(60));

  // 1. Supabase에서 데이터 조회
  const rawData = await fetchSupabaseRawData();

  if (rawData.length === 0) {
    console.log('⚠️ Supabase에 BAS 데이터가 없습니다.');
    process.exit(0);
  }

  // 데이터 요약
  const dates = rawData.map(r => r.date).sort();
  const adIds = new Set(rawData.map(r => r.ad_id).filter(Boolean));
  console.log(`\n📊 데이터 요약:`);
  console.log(`  기간: ${dates[0]} ~ ${dates[dates.length - 1]}`);
  console.log(`  레코드: ${rawData.length}개`);
  console.log(`  고유 광고(ad_id): ${adIds.size}개`);

  // 2. Airtable 기존 데이터 삭제
  await deleteAllAirtableRecords();

  // 3. Airtable에 ad-level 데이터 생성
  const result = await createAirtableRecords(rawData);

  console.log('\n' + '='.repeat(60));
  console.log('✅ 마이그레이션 완료');
  console.log(`  생성: ${result.created}개`);
  console.log(`  오류: ${result.errors}개`);
}

main().catch(e => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
