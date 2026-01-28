#!/usr/bin/env node
/**
 * HEA 판교 1월 7~17일 백필 스크립트
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const baseId = 'appJlOqnadLsMJQYw';
const tableId = 'tbl8ftclEFG5ypohX';
const USD_TO_KRW = 1490;

function getActionValue(actions, actionType) {
  if (!actions || !Array.isArray(actions)) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseInt(action.value) || 0 : 0;
}

async function findExistingRecord(date, source, device, campaignName) {
  const formula = `AND({date}='${date}', {source}='${source}', {device}='${device}', {campaign_name}='${campaignName || ''}')`;
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();
  return data.records?.[0] || null;
}

async function createRecord(fields) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  const data = await res.json();
  if (data.error) throw new Error(`Airtable 생성 오류: ${data.error.message}`);
  return data;
}

async function backfill() {
  console.log('=== HEA 판교 1월 7~17일 백필 시작 ===\n');

  const { data: client, error } = await supabase
    .from('polarad_clients')
    .select('meta_ad_account_id, meta_access_token')
    .eq('slug', 'hea-pangyo')
    .single();

  if (error) {
    console.error('Supabase 에러:', error);
    return;
  }

  // 캠페인 레벨 + 디바이스 breakdown
  const fields = 'date_start,campaign_id,campaign_name,impressions,clicks,spend,actions,video_p100_watched_actions,video_avg_time_watched_actions';
  const url = `https://graph.facebook.com/v21.0/act_${client.meta_ad_account_id}/insights?` +
    `fields=${fields}` +
    `&breakdowns=device_platform` +
    `&time_range={"since":"2026-01-07","until":"2026-01-17"}` +
    `&time_increment=1` +
    `&level=campaign` +
    `&limit=500` +
    `&access_token=${client.meta_access_token}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.error('Meta API 에러:', data.error.message);
    return;
  }

  console.log('Meta API 레코드:', data.data?.length || 0);

  let created = 0, skipped = 0;

  for (const row of data.data || []) {
    const date = row.date_start;
    const device = row.device_platform || 'unknown';
    const campaignName = row.campaign_name || '';

    // 중복 체크
    const existing = await findExistingRecord(date, 'meta', device, campaignName);
    if (existing) {
      skipped++;
      continue;
    }

    // KRW로 변환
    const spendKRW = Math.round((parseFloat(row.spend) || 0) * USD_TO_KRW);

    const record = {
      date,
      source: 'meta',
      device,
      campaign_name: campaignName,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      spend: spendKRW,
      leads: getActionValue(row.actions, 'lead'),
      video_views: parseInt(row.video_p100_watched_actions?.[0]?.value) || 0,
      avg_watch_time: parseFloat(row.video_avg_time_watched_actions?.[0]?.value) || 0,
      is_backfill: true
    };

    await createRecord(record);
    created++;
    console.log('✅', date, device, campaignName.substring(0, 30), 'spend:', spendKRW);

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n=== 완료 ===');
  console.log('생성:', created, '스킵:', skipped);
}

backfill().catch(console.error);
