import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNarattonMeta() {
  // 나라똔 client UUID
  const clientId = '84d5eddd-2bb2-4d7c-9411-8cad789dd5e2';

  const { data, error } = await supabase
    .from('polarad_meta_data')
    .select('date_start, spend, impressions, clicks, leads')
    .eq('client_id', clientId)
    .gte('date_start', '2024-12-06')
    .lte('date_start', '2024-12-17')
    .order('date_start');

  if (error) {
    console.error('❌ 에러:', error);
    return;
  }

  console.log(`\n📊 나라똔 Meta 데이터 (12/6 ~ 12/17):`);
  console.log(`총 ${data.length}건`);

  if (data.length === 0) {
    console.log('⚠️  데이터 없음!');
  } else {
    console.table(data);
  }
}

checkNarattonMeta();
