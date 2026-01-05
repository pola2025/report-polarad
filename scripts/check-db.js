#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CLIENTS = {
  '나라똔': 'c2f60730-f8c1-4361-b9fc-3b44725c3955',
  'H.E.A 판교': '3ff2896e-6786-4936-9c57-311f69f43c63',
};

async function check() {
  for (const [name, clientId] of Object.entries(CLIENTS)) {
    console.log(`\n=== ${name} (${clientId}) ===`);

    const { data, error } = await supabase
      .from('polarad_brand_search_data')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', '2025-12-01')
      .order('date', { ascending: true });

    if (error) {
      console.error('Error:', error.message);
      continue;
    }

    if (data.length === 0) {
      console.log('데이터 없음');
      continue;
    }

    console.log(`레코드 수: ${data.length}`);

    // 12월 합계
    const dec = data.filter(r => r.date.startsWith('2025-12'));
    const decTotal = dec.reduce((acc, r) => ({ imp: acc.imp + r.impressions, click: acc.click + r.clicks }), { imp: 0, click: 0 });
    console.log(`12월: 노출 ${decTotal.imp}, 클릭 ${decTotal.click}`);

    // 1월 합계
    const jan = data.filter(r => r.date.startsWith('2026-01'));
    const janTotal = jan.reduce((acc, r) => ({ imp: acc.imp + r.impressions, click: acc.click + r.clicks }), { imp: 0, click: 0 });
    console.log(`1월: 노출 ${janTotal.imp}, 클릭 ${janTotal.click}`);
  }
}

check();
