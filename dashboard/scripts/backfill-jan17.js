#!/usr/bin/env node
/**
 * HEA 판교 1월 17일만 백필
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const baseId = 'appJlOqnadLsMJQYw';
const tableId = 'tbl8ftclEFG5ypohX';
const USD_TO_KRW = 1490;

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
  console.log('=== HEA 판교 1월 17일 백필 ===\n');

  const { data: client, error } = await supabase
    .from('polarad_clients')
    .select('meta_ad_account_id, meta_access_token')
    .eq('slug', 'hea-pangyo')
    .single();

  if (error) {
    console.error('Supabase 에러:', error);
    return;
  }

  const fields = 'date_start,impressions,clicks,spend';
  const url = `https://graph.facebook.com/v21.0/act_${client.meta_ad_account_id}/insights?` +
    `fields=${fields}` +
    `&breakdowns=device_platform` +
    `&time_range={"since":"2026-01-17","until":"2026-01-17"}` +
    `&time_increment=1` +
    `&level=account` +
    `&access_token=${client.meta_access_token}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.error('Meta API 에러:', data.error.message);
    return;
  }

  console.log('Meta API 레코드:', data.data?.length || 0);

  let created = 0;

  for (const row of data.data || []) {
    const date = row.date_start;
    const device = row.device_platform || 'unknown';
    const spendKRW = Math.round((parseFloat(row.spend) || 0) * USD_TO_KRW);

    const record = {
      date,
      source: 'meta',
      device,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      spend: spendKRW
    };

    await createRecord(record);
    created++;
    console.log('✅', date, device, '노출:', row.impressions, '클릭:', row.clicks, 'spend:', spendKRW);

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n=== 완료 ===');
  console.log('생성:', created);
}

backfill().catch(console.error);
