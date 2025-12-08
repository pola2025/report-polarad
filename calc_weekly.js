const https = require('https');

const SUPABASE_URL = 'mpljqcuqrrfwzamfyxnz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGpxY3VxcnJmd3phbWZ5eG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5Njk3NiwiZXhwIjoyMDc5MDcyOTc2fQ.bnVOXhB28UGdiPDHYYwMP8dyKAQ6k9zrjUu7cam4HEY';
const CLIENT_ID = '3ff2896e-6786-4936-9c57-311f69f43c63';

function fetchData(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const path = `/rest/v1/polarad_meta_data?client_id=eq.${CLIENT_ID}&date=gte.${startDate}&date=lte.${endDate}&select=date,impressions,clicks,spend,video_views`;

    const options = {
      hostname: SUPABASE_URL,
      path: path,
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  try {
    const [week1_raw, week2_raw] = await Promise.all([
      fetchData('2025-11-03', '2025-11-09'),
      fetchData('2025-11-10', '2025-11-16')
    ]);

    // Week 1 합산
    const week1 = week1_raw.reduce((acc, row) => {
      acc.impressions += row.impressions || 0;
      acc.clicks += row.clicks || 0;
      acc.spend += row.spend || 0;
      acc.video_views += row.video_views || 0;
      return acc;
    }, { impressions: 0, clicks: 0, spend: 0, video_views: 0 });
    week1.ctr = week1.impressions > 0 ? (week1.clicks / week1.impressions * 100) : 0;
    week1.cpc = week1.clicks > 0 ? (week1.spend / week1.clicks) : 0;

    // Week 2 합산
    const week2 = week2_raw.reduce((acc, row) => {
      acc.impressions += row.impressions || 0;
      acc.clicks += row.clicks || 0;
      acc.spend += row.spend || 0;
      acc.video_views += row.video_views || 0;
      return acc;
    }, { impressions: 0, clicks: 0, spend: 0, video_views: 0 });
    week2.ctr = week2.impressions > 0 ? (week2.clicks / week2.impressions * 100) : 0;
    week2.cpc = week2.clicks > 0 ? (week2.spend / week2.clicks) : 0;

    // Week 2 일별 합산
    const dailyMap = {};
    week2_raw.forEach(row => {
      if (!dailyMap[row.date]) {
        dailyMap[row.date] = { impressions: 0, clicks: 0, spend: 0, video_views: 0 };
      }
      dailyMap[row.date].impressions += row.impressions || 0;
      dailyMap[row.date].clicks += row.clicks || 0;
      dailyMap[row.date].spend += row.spend || 0;
      dailyMap[row.date].video_views += row.video_views || 0;
    });

    // 요일 이름
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dailyData = Object.entries(dailyMap).map(([date, data]) => {
      const d = new Date(date);
      const dayName = dayNames[d.getDay()];
      const monthDay = `${d.getMonth()+1}/${d.getDate()}`;
      return {
        date,
        dayName,
        label: `${dayName}요일(${monthDay})`,
        ...data,
        ctr: data.impressions > 0 ? (data.clicks / data.impressions * 100) : 0
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    // 변화율 계산
    const changes = {
      impressions: ((week2.impressions - week1.impressions) / week1.impressions * 100),
      clicks: ((week2.clicks - week1.clicks) / week1.clicks * 100),
      spend: ((week2.spend - week1.spend) / week1.spend * 100),
      ctr: ((week2.ctr - week1.ctr) / week1.ctr * 100),
      cpc: ((week2.cpc - week1.cpc) / week1.cpc * 100),
      video_views: ((week2.video_views - week1.video_views) / week1.video_views * 100),
    };

    console.log('=== 11월 1주차 (11/3~11/9) ===');
    console.log(JSON.stringify(week1, null, 2));

    console.log('\n=== 11월 2주차 (11/10~11/16) ===');
    console.log(JSON.stringify(week2, null, 2));

    console.log('\n=== 변화율 (%) ===');
    console.log(JSON.stringify(changes, null, 2));

    console.log('\n=== 11월 2주차 일별 데이터 ===');
    console.log(JSON.stringify(dailyData, null, 2));

    // 최고/최저 성과일 찾기
    const bestDay = dailyData.reduce((best, cur) => cur.clicks > best.clicks ? cur : best);
    const worstDay = dailyData.reduce((worst, cur) => cur.clicks < worst.clicks ? cur : worst);
    const bestCtrDay = dailyData.reduce((best, cur) => cur.ctr > best.ctr ? cur : best);

    console.log('\n=== 특이사항 분석 ===');
    console.log('최고 클릭일:', bestDay.label, '- 클릭', bestDay.clicks, 'CTR', bestDay.ctr.toFixed(2) + '%');
    console.log('최저 클릭일:', worstDay.label, '- 클릭', worstDay.clicks, 'CTR', worstDay.ctr.toFixed(2) + '%');
    console.log('최고 CTR일:', bestCtrDay.label, '- CTR', bestCtrDay.ctr.toFixed(2) + '%');

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
