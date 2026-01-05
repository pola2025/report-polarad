#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // 리포트 1개만 조회해서 컬럼 확인
  const { data, error } = await supabase
    .from('polarad_reports')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('리포트 컬럼:', Object.keys(data[0]).join(', '));
    console.log('\n샘플 데이터:');
    console.log(JSON.stringify(data[0], null, 2));
  }

  // 전체 리포트 목록
  const { data: all } = await supabase
    .from('polarad_reports')
    .select('id, report_type, period_start, period_end, year, month, week, status, ai_generated_at')
    .order('period_start', { ascending: false });

  console.log('\n\n전체 리포트 목록:');
  if (all) {
    all.forEach(r => {
      const type = r.report_type === 'weekly' ? 'W' : 'M';
      const ai = r.ai_generated_at ? 'AI✅' : 'AI❌';
      const weekStr = r.week ? r.week + '주' : '';
      const month = String(r.month).padStart(2, '0');
      console.log('  ' + type + ' ' + r.year + '-' + month + ' ' + weekStr + ' | ' + r.period_start + ' ~ ' + r.period_end + ' | ' + ai);
    });
  }
}
check();
