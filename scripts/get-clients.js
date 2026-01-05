#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getClients() {
  const { data, error } = await supabase
    .from('polarad_clients')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== 현재 클라이언트 목록 ===\n');
  data.forEach(c => {
    console.log(`클라이언트: ${c.client_name}`);
    console.log(`  - id: ${c.id}`);
    console.log(`  - slug: ${c.slug}`);
    console.log(`  - client_type: ${c.client_type}`);
    console.log(`  - naver_type: ${c.naver_type}`);
    console.log(`  - naver_enabled: ${c.naver_enabled}`);
    console.log(`  - naver_fixed_budget: ${c.naver_fixed_budget}`);
    console.log(`  - is_active: ${c.is_active}`);
    console.log(`  - status: ${c.status}`);
    console.log('');
  });
}

getClients();
