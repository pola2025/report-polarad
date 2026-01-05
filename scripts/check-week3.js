require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getWeekData() {
  // 12월 3주차 (12/15~12/21) 데이터 조회
  const { data, error } = await supabase
    .from('polarad_meta_data')
    .select('*')
    .gte('date', '2025-12-15')
    .lte('date', '2025-12-21')
    .order('date');

  if (error) {
    console.error('오류:', error.message);
    return;
  }

  console.log('=== 12월 3주차 Meta 데이터 (12/15~12/21) ===\n');

  // 일별 집계
  const daily = {};
  let totalImp = 0, totalClk = 0, totalSpend = 0;

  data.forEach(row => {
    if (!daily[row.date]) {
      daily[row.date] = { impressions: 0, clicks: 0, spend: 0 };
    }
    daily[row.date].impressions += row.impressions || 0;
    daily[row.date].clicks += row.clicks || 0;
    daily[row.date].spend += parseFloat(row.spend) || 0;

    totalImp += row.impressions || 0;
    totalClk += row.clicks || 0;
    totalSpend += parseFloat(row.spend) || 0;
  });

  console.log('일별 데이터:');
  Object.entries(daily).sort().forEach(([date, d]) => {
    const ctr = d.impressions > 0 ? (d.clicks / d.impressions * 100).toFixed(2) : 0;
    console.log(`${date}: 노출 ${d.impressions.toLocaleString()}, 클릭 ${d.clicks}, 비용 ${Math.round(d.spend).toLocaleString()}원, CTR ${ctr}%`);
  });

  console.log('\n주간 합계:');
  console.log('  노출:', totalImp.toLocaleString());
  console.log('  클릭:', totalClk);
  console.log('  비용:', Math.round(totalSpend).toLocaleString() + '원');
  console.log('  CTR:', (totalImp > 0 ? (totalClk / totalImp * 100).toFixed(2) : 0) + '%');
  console.log('  CPC:', (totalClk > 0 ? Math.round(totalSpend / totalClk) : 0) + '원');

  // 전주 데이터 비교 (12/8~12/14)
  const { data: prevWeek } = await supabase
    .from('polarad_meta_data')
    .select('impressions, clicks, spend')
    .gte('date', '2025-12-08')
    .lte('date', '2025-12-14');

  let prevImp = 0, prevClk = 0, prevSpend = 0;
  prevWeek?.forEach(row => {
    prevImp += row.impressions || 0;
    prevClk += row.clicks || 0;
    prevSpend += parseFloat(row.spend) || 0;
  });

  console.log('\n전주 대비:');
  console.log('  노출:', ((totalImp - prevImp) / prevImp * 100).toFixed(1) + '%');
  console.log('  클릭:', ((totalClk - prevClk) / prevClk * 100).toFixed(1) + '%');
  console.log('  비용:', ((totalSpend - prevSpend) / prevSpend * 100).toFixed(1) + '%');

  return { daily, totalImp, totalClk, totalSpend, prevImp, prevClk, prevSpend };
}

getWeekData().catch(console.error);
