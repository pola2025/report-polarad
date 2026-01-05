const https = require('https');

const SUPABASE_URL = 'mpljqcuqrrfwzamfyxnz.supabase.co';
const API_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY';

function fetchData(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: path,
      method: 'GET',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== 12월 2주차 (12/8~12/14) 데이터 분석 ===\n');

  const clientId = '3ff2896e-6786-4936-9c57-311f69f43c63';
  const startDate = '2025-12-08';
  const endDate = '2025-12-14';

  // Meta 데이터 조회
  const metaData = await fetchData(
    `/rest/v1/polarad_meta_data?client_id=eq.${clientId}&date=gte.${startDate}&date=lte.${endDate}&order=date.asc`
  );

  console.log(`Meta 데이터 행 수: ${metaData.length}\n`);

  // 일별 집계
  const daily = {};
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  for (const row of metaData) {
    const date = row.date;
    if (!daily[date]) {
      daily[date] = { impressions: 0, clicks: 0, spend: 0, video_views: 0 };
    }
    daily[date].impressions += row.impressions || 0;
    daily[date].clicks += row.clicks || 0;
    daily[date].spend += parseFloat(row.spend) || 0;
    daily[date].video_views += row.video_views || 0;
  }

  // 일별 출력
  console.log('--- 일별 성과 ---');
  let total = { impressions: 0, clicks: 0, spend: 0, video_views: 0 };
  const dailyResults = [];

  for (const date of Object.keys(daily).sort()) {
    const d = daily[date];
    const dayOfWeek = dayNames[new Date(date).getDay()];
    const ctr = d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0;

    console.log(`${date} (${dayOfWeek}): 노출 ${d.impressions.toLocaleString()}, 클릭 ${d.clicks.toLocaleString()}, CTR ${ctr.toFixed(2)}%, 광고비 $${d.spend.toFixed(2)}`);

    dailyResults.push({
      date,
      dayOfWeek,
      ...d,
      ctr
    });

    total.impressions += d.impressions;
    total.clicks += d.clicks;
    total.spend += d.spend;
    total.video_views += d.video_views;
  }

  // 주간 합계
  const weekCtr = total.impressions > 0 ? (total.clicks / total.impressions * 100) : 0;
  const weekCpc = total.clicks > 0 ? (total.spend / total.clicks) : 0;

  console.log('\n--- 주간 합계 ---');
  console.log(`총 노출: ${total.impressions.toLocaleString()}회`);
  console.log(`총 클릭: ${total.clicks.toLocaleString()}회`);
  console.log(`CTR: ${weekCtr.toFixed(2)}%`);
  console.log(`총 광고비: $${total.spend.toFixed(2)} (약 ${Math.round(total.spend * 1500).toLocaleString()}원)`);
  console.log(`CPC: $${weekCpc.toFixed(4)} (약 ${Math.round(weekCpc * 1500)}원)`);
  console.log(`영상 조회수: ${total.video_views.toLocaleString()}회`);

  // 전주 (12월 1주차) 데이터 비교
  const prevWeekData = await fetchData(
    `/rest/v1/polarad_meta_data?client_id=eq.${clientId}&date=gte.2025-12-01&date=lte.2025-12-07&order=date.asc`
  );

  let prevTotal = { impressions: 0, clicks: 0, spend: 0, video_views: 0 };
  for (const row of prevWeekData) {
    prevTotal.impressions += row.impressions || 0;
    prevTotal.clicks += row.clicks || 0;
    prevTotal.spend += parseFloat(row.spend) || 0;
    prevTotal.video_views += row.video_views || 0;
  }

  const prevCtr = prevTotal.impressions > 0 ? (prevTotal.clicks / prevTotal.impressions * 100) : 0;
  const prevCpc = prevTotal.clicks > 0 ? (prevTotal.spend / prevTotal.clicks) : 0;

  console.log('\n--- 전주(12월 1주차) 대비 변화 ---');
  const impChange = prevTotal.impressions > 0 ? ((total.impressions - prevTotal.impressions) / prevTotal.impressions * 100) : 0;
  const clickChange = prevTotal.clicks > 0 ? ((total.clicks - prevTotal.clicks) / prevTotal.clicks * 100) : 0;
  const ctrChange = prevCtr > 0 ? ((weekCtr - prevCtr) / prevCtr * 100) : 0;
  const cpcChange = prevCpc > 0 ? ((weekCpc - prevCpc) / prevCpc * 100) : 0;

  console.log(`노출: ${impChange >= 0 ? '+' : ''}${impChange.toFixed(1)}%`);
  console.log(`클릭: ${clickChange >= 0 ? '+' : ''}${clickChange.toFixed(1)}%`);
  console.log(`CTR: ${ctrChange >= 0 ? '+' : ''}${ctrChange.toFixed(1)}%`);
  console.log(`CPC: ${cpcChange >= 0 ? '+' : ''}${cpcChange.toFixed(1)}%`);

  // 최고/최저 성과일 분석
  console.log('\n--- 성과 분석 ---');

  const bestCtrDay = dailyResults.reduce((a, b) => a.ctr > b.ctr ? a : b);
  const bestClickDay = dailyResults.reduce((a, b) => a.clicks > b.clicks ? a : b);
  const bestImpDay = dailyResults.reduce((a, b) => a.impressions > b.impressions ? a : b);
  const worstClickDay = dailyResults.reduce((a, b) => a.clicks < b.clicks ? a : b);

  console.log(`최고 CTR: ${bestCtrDay.dayOfWeek}요일(${bestCtrDay.date}) - ${bestCtrDay.ctr.toFixed(2)}%`);
  console.log(`최다 클릭: ${bestClickDay.dayOfWeek}요일(${bestClickDay.date}) - ${bestClickDay.clicks}회`);
  console.log(`최다 노출: ${bestImpDay.dayOfWeek}요일(${bestImpDay.date}) - ${bestImpDay.impressions.toLocaleString()}회`);
  console.log(`최저 클릭: ${worstClickDay.dayOfWeek}요일(${worstClickDay.date}) - ${worstClickDay.clicks}회`);

  // 리포트 생성에 필요한 데이터 출력
  console.log('\n=== 리포트 생성용 요약 데이터 ===');
  console.log(JSON.stringify({
    period: { start: startDate, end: endDate },
    total,
    weekCtr,
    weekCpc,
    comparison: { impChange, clickChange, ctrChange, cpcChange },
    highlights: {
      bestCtrDay,
      bestClickDay,
      bestImpDay,
      worstClickDay
    }
  }, null, 2));
}

main().catch(console.error);
