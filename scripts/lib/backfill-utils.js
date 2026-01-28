/**
 * 백필 유틸리티 함수
 *
 * - 환율 변환
 * - 데이터 변환
 * - Upsert 키 생성
 * - 정합성 검증
 */

// 고정 환율 (USD → KRW)
const USD_TO_KRW = 1490;

/**
 * 통화 변환
 * @param {number} amount - 금액
 * @param {string} fromCurrency - 원본 통화 (USD, KRW)
 * @param {string} toCurrency - 목표 통화 (기본: KRW)
 * @returns {number} - 변환된 금액 (정수, 반올림)
 */
function convertCurrency(amount, fromCurrency, toCurrency = 'KRW') {
  if (amount === 0) return 0;

  // 같은 통화면 변환 불필요
  if (fromCurrency === toCurrency) {
    return Math.round(amount);
  }

  // USD → KRW
  if (fromCurrency === 'USD' && toCurrency === 'KRW') {
    return Math.round(amount * USD_TO_KRW);
  }

  // 그 외 케이스는 그대로 반환 (필요시 확장)
  return Math.round(amount);
}

/**
 * Meta API 응답 행을 Airtable 레코드로 변환
 * @param {object} row - Meta API 응답의 단일 행
 * @param {object} options - 옵션 { currency, includeLeads }
 * @returns {object} - Airtable 레코드
 */
function transformMetaRow(row, options = {}) {
  const { currency = 'KRW', includeLeads = true } = options;

  // 필드 추출
  const date = row.date_start;
  const device = (row.device_platform || 'unknown').toLowerCase();
  const impressions = parseInt(row.impressions) || 0;
  const clicks = parseInt(row.clicks) || 0;
  const spendRaw = parseFloat(row.spend) || 0;
  const spend = convertCurrency(spendRaw, currency, 'KRW');

  // actions에서 리드 추출
  let leads = 0;
  if (row.actions && Array.isArray(row.actions)) {
    const leadAction = row.actions.find(a => a.action_type === 'lead');
    if (leadAction) {
      leads = parseInt(leadAction.value) || 0;
    }
  }

  // 영상 데이터 추출
  const videoViews = row.video_play_actions?.[0]?.value
    ? parseInt(row.video_play_actions[0].value) : 0;
  const avgWatchTime = row.video_avg_time_watched_actions?.[0]?.value
    ? parseFloat(row.video_avg_time_watched_actions[0].value) : 0;

  // 광고/캠페인 정보
  const adId = row.ad_id || '';
  const adName = row.ad_name || '';
  const campaignName = row.campaign_name || '';

  const record = {
    date,
    device,
    impressions,
    clicks,
    spend,
    source: 'meta',
    ad_id: adId,
    campaign_name: adName ? `${adName}${campaignName ? ` (${campaignName})` : ''}` : campaignName,
    video_views: videoViews,
    avg_watch_time: avgWatchTime,
    is_finalized: false,
  };

  // leads는 옵션에 따라 포함
  if (includeLeads) {
    record.leads = leads;
  }

  return record;
}

/**
 * Upsert 키 생성
 * @param {object} record - 레코드
 * @returns {string} - 유니크 키 (date|source|device|ad_id 또는 campaign_name)
 */
function generateUpsertKey(record) {
  const { date, source, device, ad_id, campaign_name } = record;

  // ad_id가 있으면 광고 레벨
  if (ad_id) {
    return `${date}|${source}|${device}|${ad_id}`;
  }

  // ad_id 없으면 캠페인 레벨
  return `${date}|${source}|${device}|${campaign_name || ''}`;
}

/**
 * 백필 데이터 정합성 검증
 * @param {Array} records - 레코드 배열
 * @returns {object} - { isValid, errors }
 */
function validateBackfillData(records) {
  const errors = [];
  const seenKeys = new Set();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // 1. 필수 필드 검증
    if (!record.date) {
      errors.push({
        type: 'missing_field',
        index: i,
        field: 'date',
        message: `레코드 ${i}: date 필드 누락`
      });
    }

    if (!record.source) {
      errors.push({
        type: 'missing_field',
        index: i,
        field: 'source',
        message: `레코드 ${i}: source 필드 누락`
      });
    }

    // 2. 중복 검증
    const key = generateUpsertKey(record);
    if (seenKeys.has(key)) {
      errors.push({
        type: 'duplicate',
        index: i,
        key,
        message: `레코드 ${i}: 중복 키 발견 - ${key}`
      });
    }
    seenKeys.add(key);

    // 3. 환율 적용 검증 (spend가 너무 작으면 의심)
    // impressions이 100 이상인데 spend가 100 미만이면 환율 미적용 의심
    if (record.impressions >= 100 && record.spend > 0 && record.spend < 100) {
      errors.push({
        type: 'currency_suspect',
        index: i,
        spend: record.spend,
        impressions: record.impressions,
        message: `레코드 ${i}: 환율 미적용 의심 (spend=${record.spend}, impressions=${record.impressions})`
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  USD_TO_KRW,
  convertCurrency,
  transformMetaRow,
  generateUpsertKey,
  validateBackfillData
};
