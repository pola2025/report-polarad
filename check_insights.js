const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // 11월 2주차 리포트의 AI 인사이트 확인
  const { data, error } = await supabase
    .from('polarad_reports')
    .select('id, report_type, period_start, period_end, ai_insights')
    .eq('report_type', 'weekly')
    .order('period_start', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  data.forEach(r => {
    console.log(`\n=== ${r.period_start} ~ ${r.period_end} (${r.report_type}) ===`);
    console.log('ID:', r.id);
    console.log('AI Insights:', JSON.stringify(r.ai_insights, null, 2));
  });
}

main();
