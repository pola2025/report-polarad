/**
 * 백필 로직 테스트 (TDD)
 *
 * 테스트 항목:
 * 1. 환율 변환
 * 2. 데이터 변환
 * 3. Upsert 키 생성
 * 4. 정합성 검증
 */

const assert = require('assert');

// ============================================================
// 구현된 함수 import
// ============================================================

const {
  convertCurrency,
  transformMetaRow,
  generateUpsertKey,
  validateBackfillData
} = require('../lib/backfill-utils');

// ============================================================
// 테스트 케이스
// ============================================================

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// ------------------------------------------------------------
// 환율 변환 테스트
// ------------------------------------------------------------

test('TC-001: USD → KRW 환율 변환 (고정 환율 1490)', () => {
  const result = convertCurrency(10, 'USD', 'KRW');
  assert.strictEqual(result, 14900, 'USD 10 → KRW 14900');
});

test('TC-002: USD → KRW 소수점 처리 (반올림)', () => {
  const result = convertCurrency(10.17, 'USD', 'KRW');
  assert.strictEqual(result, 15153, 'USD 10.17 → KRW 15153 (반올림)');
});

test('TC-003: KRW → KRW 변환 없음', () => {
  const result = convertCurrency(10000, 'KRW', 'KRW');
  assert.strictEqual(result, 10000, 'KRW는 그대로 유지');
});

test('TC-004: 0원 처리', () => {
  const result = convertCurrency(0, 'USD', 'KRW');
  assert.strictEqual(result, 0, '0은 0으로 유지');
});

// ------------------------------------------------------------
// 데이터 변환 테스트
// ------------------------------------------------------------

test('TC-005: Meta API 응답 → Airtable 레코드 변환', () => {
  const metaRow = {
    date_start: '2026-01-15',
    device_platform: 'mobile_app',
    impressions: '1000',
    clicks: '50',
    spend: '10.00',
    actions: [
      { action_type: 'link_click', value: '50' },
      { action_type: 'lead', value: '5' }
    ],
    video_play_actions: [{ value: '100' }],
    video_avg_time_watched_actions: [{ value: '5.5' }],
    ad_id: '123456789',
    ad_name: '테스트 광고',
    campaign_name: '테스트 캠페인'
  };

  const result = transformMetaRow(metaRow, { currency: 'USD' });

  assert.strictEqual(result.date, '2026-01-15');
  assert.strictEqual(result.device, 'mobile_app');
  assert.strictEqual(result.impressions, 1000);
  assert.strictEqual(result.clicks, 50);
  assert.strictEqual(result.spend, 14900); // USD → KRW
  assert.strictEqual(result.leads, 5);
  assert.strictEqual(result.video_views, 100);
  assert.strictEqual(result.avg_watch_time, 5.5);
  assert.strictEqual(result.ad_id, '123456789');
  assert.strictEqual(result.source, 'meta');
});

test('TC-006: 리드 없는 캠페인 처리', () => {
  const metaRow = {
    date_start: '2026-01-20',
    device_platform: 'desktop',
    impressions: '500',
    clicks: '25',
    spend: '5.00',
    actions: [
      { action_type: 'link_click', value: '25' }
      // lead 없음
    ],
    ad_id: '987654321'
  };

  const result = transformMetaRow(metaRow, { currency: 'USD' });

  assert.strictEqual(result.leads, 0, '리드 없으면 0');
});

test('TC-007: 영상 데이터 없는 캠페인 처리', () => {
  const metaRow = {
    date_start: '2026-01-20',
    device_platform: 'mobile_web',
    impressions: '300',
    clicks: '15',
    spend: '3.00',
    ad_id: '111222333'
    // video 관련 필드 없음
  };

  const result = transformMetaRow(metaRow, { currency: 'USD' });

  assert.strictEqual(result.video_views, 0, '영상 데이터 없으면 0');
  assert.strictEqual(result.avg_watch_time, 0, '영상 데이터 없으면 0');
});

test('TC-008: device_platform 소문자 변환', () => {
  const metaRow = {
    date_start: '2026-01-20',
    device_platform: 'MOBILE_APP',
    impressions: '100',
    clicks: '5',
    spend: '1.00',
    ad_id: '444555666'
  };

  const result = transformMetaRow(metaRow, { currency: 'USD' });

  assert.strictEqual(result.device, 'mobile_app', '소문자 변환');
});

// ------------------------------------------------------------
// Upsert 키 생성 테스트
// ------------------------------------------------------------

test('TC-009: Upsert 키 생성 (date + source + device + ad_id)', () => {
  const record = {
    date: '2026-01-15',
    source: 'meta',
    device: 'mobile_app',
    ad_id: '123456789'
  };

  const key = generateUpsertKey(record);

  assert.strictEqual(key, '2026-01-15|meta|mobile_app|123456789');
});

test('TC-010: Upsert 키 - ad_id 없는 경우 (캠페인 레벨)', () => {
  const record = {
    date: '2026-01-15',
    source: 'meta',
    device: 'desktop',
    campaign_name: '테스트 캠페인'
    // ad_id 없음
  };

  const key = generateUpsertKey(record);

  assert.strictEqual(key, '2026-01-15|meta|desktop|테스트 캠페인');
});

// ------------------------------------------------------------
// 정합성 검증 테스트
// ------------------------------------------------------------

test('TC-011: 정합성 검증 - 정상 데이터', () => {
  const records = [
    { date: '2026-01-15', source: 'meta', device: 'mobile_app', spend: 14900, impressions: 1000 },
    { date: '2026-01-16', source: 'meta', device: 'desktop', spend: 7450, impressions: 500 }
  ];

  const result = validateBackfillData(records);

  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.errors.length, 0);
});

test('TC-012: 정합성 검증 - 중복 레코드 탐지', () => {
  const records = [
    { date: '2026-01-15', source: 'meta', device: 'mobile_app', ad_id: '123', spend: 14900 },
    { date: '2026-01-15', source: 'meta', device: 'mobile_app', ad_id: '123', spend: 14900 } // 중복
  ];

  const result = validateBackfillData(records);

  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some(e => e.type === 'duplicate'));
});

test('TC-013: 정합성 검증 - 환율 미적용 의심 (spend < 100)', () => {
  const records = [
    { date: '2026-01-15', source: 'meta', device: 'mobile_app', spend: 10, impressions: 1000 }
  ];

  const result = validateBackfillData(records);

  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some(e => e.type === 'currency_suspect'));
});

test('TC-014: 정합성 검증 - 필수 필드 누락', () => {
  const records = [
    { source: 'meta', device: 'mobile_app', spend: 14900 } // date 없음
  ];

  const result = validateBackfillData(records);

  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some(e => e.type === 'missing_field'));
});

// ============================================================
// 테스트 실행
// ============================================================

async function runTests() {
  console.log('🧪 백필 로직 테스트 시작\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  console.log('='.repeat(60));
  console.log(`\n📊 결과: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n⚠️  일부 테스트 실패');
    process.exit(1);
  } else {
    console.log('\n✅ 모든 테스트 통과!');
  }
}

// 직접 실행 시
if (require.main === module) {
  runTests();
}

module.exports = { tests };
