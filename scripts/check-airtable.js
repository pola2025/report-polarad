#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;

const TABLES = {
  'H.E.A 판교': {
    baseId: 'appJlOqnadLsMJQYw',
    tableId: 'tbl8ftclEFG5ypohX',
  },
  '나라똔': {
    baseId: 'appN2KzUoORRrb8X9',
    tableId: 'tblmC9Ft2ioXKXsrL',
  },
};

async function checkTable(name, baseId, tableId) {
  console.log(`\n=== ${name} ===`);
  console.log(`Base: ${baseId}, Table: ${tableId}`);

  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?maxRecords=3`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
    },
  });

  const data = await response.json();

  if (data.error) {
    console.error('Error:', data.error);
    return;
  }

  console.log(`레코드 수: ${data.records?.length || 0}`);

  if (data.records?.length > 0) {
    console.log('\n첫 레코드 필드:');
    const fields = data.records[0].fields;
    Object.keys(fields).forEach(key => {
      console.log(`  - ${key}: ${JSON.stringify(fields[key]).substring(0, 50)}`);
    });
  }
}

async function checkJanData() {
  const { baseId, tableId } = TABLES['H.E.A 판교'];
  const formula = encodeURIComponent("AND({source}='meta', {date}>='2026-01-01')");
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${formula}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  const data = await res.json();

  console.log('=== Airtable Meta 데이터 (2026-01) ===');
  console.log('레코드 수:', data.records?.length || 0);

  if (data.records?.length > 0) {
    data.records.forEach(r => {
      const f = r.fields;
      console.log(`${f.date} | ${f.device || 'n/a'} | campaign: '${f.campaign_name || ''}' | video_views: ${f.video_views || 0} | avg_watch_time: ${f.avg_watch_time || 0}`);
    });

    const totals = data.records.reduce((acc, r) => {
      acc.impressions += r.fields.impressions || 0;
      acc.clicks += r.fields.clicks || 0;
      acc.spend += r.fields.spend || 0;
      acc.video_views += r.fields.video_views || 0;
      acc.avg_watch_time += r.fields.avg_watch_time || 0;
      return acc;
    }, { impressions: 0, clicks: 0, spend: 0, video_views: 0, avg_watch_time: 0 });

    console.log('\n=== 합계 ===');
    console.log('노출:', totals.impressions);
    console.log('클릭:', totals.clicks);
    console.log('지출:', totals.spend);
    console.log('영상조회:', totals.video_views);
    console.log('평균시청시간:', totals.avg_watch_time);
  }
}

async function main() {
  await checkJanData();
}

main().catch(console.error);
