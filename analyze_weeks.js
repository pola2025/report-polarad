const https = require('https');

const SUPABASE_URL = 'mpljqcuqrrfwzamfyxnz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGpxY3VxcnJmd3phbWZ5eG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5Njk3NiwiZXhwIjoyMDc5MDcyOTc2fQ.bnVOXhB28UGdiPDHYYwMP8dyKAQ6k9zrjUu7cam4HEY';
const CLIENT_ID = '3ff2896e-6786-4936-9c57-311f69f43c63';

function fetchData(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const path = `/rest/v1/polarad_meta_data?client_id=eq.${CLIENT_ID}&date=gte.${startDate}&date=lte.${endDate}&select=date,impressions,clicks,spend,video_views,avg_watch_time`;

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

function aggregateWeekData(raw) {
  const total = raw.reduce((acc, row) => {
    acc.impressions += row.impressions || 0;
    acc.clicks += row.clicks || 0;
    acc.spend += row.spend || 0;
    acc.video_views += row.video_views || 0;
    if (row.avg_watch_time) {
      acc.avg_watch_time_sum += row.avg_watch_time;
      acc.avg_watch_time_count += 1;
    }
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0, video_views: 0, avg_watch_time_sum: 0, avg_watch_time_count: 0 });

  total.ctr = total.impressions > 0 ? (total.clicks / total.impressions * 100) : 0;
  total.cpc = total.clicks > 0 ? (total.spend / total.clicks) : 0;
  total.avg_watch_time = total.avg_watch_time_count > 0 ? (total.avg_watch_time_sum / total.avg_watch_time_count) : 0;

  return total;
}

function getDailyData(raw) {
  const dailyMap = {};
  raw.forEach(row => {
    if (!dailyMap[row.date]) {
      dailyMap[row.date] = { impressions: 0, clicks: 0, spend: 0, video_views: 0 };
    }
    dailyMap[row.date].impressions += row.impressions || 0;
    dailyMap[row.date].clicks += row.clicks || 0;
    dailyMap[row.date].spend += row.spend || 0;
    dailyMap[row.date].video_views += row.video_views || 0;
  });

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return Object.entries(dailyMap).map(([date, data]) => {
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
}

function calcChanges(current, previous) {
  return {
    impressions: previous.impressions > 0 ? ((current.impressions - previous.impressions) / previous.impressions * 100) : 0,
    clicks: previous.clicks > 0 ? ((current.clicks - previous.clicks) / previous.clicks * 100) : 0,
    spend: previous.spend > 0 ? ((current.spend - previous.spend) / previous.spend * 100) : 0,
    ctr: previous.ctr > 0 ? ((current.ctr - previous.ctr) / previous.ctr * 100) : 0,
    cpc: previous.cpc > 0 ? ((current.cpc - previous.cpc) / previous.cpc * 100) : 0,
    video_views: previous.video_views > 0 ? ((current.video_views - previous.video_views) / previous.video_views * 100) : 0,
  };
}

async function analyzeWeek(weekName, startDate, endDate, prevStartDate, prevEndDate) {
  const [currentRaw, prevRaw] = await Promise.all([
    fetchData(startDate, endDate),
    fetchData(prevStartDate, prevEndDate)
  ]);

  const current = aggregateWeekData(currentRaw);
  const previous = aggregateWeekData(prevRaw);
  const changes = calcChanges(current, previous);
  const dailyData = getDailyData(currentRaw);

  // 최고/최저 성과일
  const bestClickDay = dailyData.reduce((best, cur) => cur.clicks > best.clicks ? cur : best);
  const bestCtrDay = dailyData.reduce((best, cur) => cur.ctr > best.ctr ? cur : best);
  const worstClickDay = dailyData.reduce((worst, cur) => cur.clicks < worst.clicks ? cur : worst);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${weekName} (${startDate} ~ ${endDate})`);
  console.log(`${'='.repeat(60)}`);
  console.log('\n[총합 데이터]');
  console.log(`  노출: ${current.impressions.toLocaleString()}`);
  console.log(`  클릭: ${current.clicks.toLocaleString()}`);
  console.log(`  비용: $${current.spend.toFixed(2)} (약 ₩${Math.round(current.spend * 1500).toLocaleString()})`);
  console.log(`  CTR: ${current.ctr.toFixed(2)}%`);
  console.log(`  CPC: $${current.cpc.toFixed(4)} (약 ₩${Math.round(current.cpc * 1500)})`);
  console.log(`  영상조회: ${current.video_views.toLocaleString()}`);
  console.log(`  평균시청: ${current.avg_watch_time.toFixed(1)}초`);

  console.log('\n[전주 대비 변화율]');
  console.log(`  노출: ${changes.impressions >= 0 ? '+' : ''}${changes.impressions.toFixed(1)}%`);
  console.log(`  클릭: ${changes.clicks >= 0 ? '+' : ''}${changes.clicks.toFixed(1)}%`);
  console.log(`  CTR: ${changes.ctr >= 0 ? '+' : ''}${changes.ctr.toFixed(1)}%`);
  console.log(`  CPC: ${changes.cpc >= 0 ? '+' : ''}${changes.cpc.toFixed(1)}%`);

  console.log('\n[일별 데이터]');
  dailyData.forEach(d => {
    console.log(`  ${d.label}: 노출 ${d.impressions.toLocaleString()}, 클릭 ${d.clicks}, CTR ${d.ctr.toFixed(2)}%`);
  });

  console.log('\n[특이사항]');
  console.log(`  최고 클릭: ${bestClickDay.label} (${bestClickDay.clicks}건)`);
  console.log(`  최고 CTR: ${bestCtrDay.label} (${bestCtrDay.ctr.toFixed(2)}%)`);
  console.log(`  최저 클릭: ${worstClickDay.label} (${worstClickDay.clicks}건)`);

  return {
    weekName,
    startDate,
    endDate,
    current,
    previous,
    changes,
    dailyData,
    bestClickDay,
    bestCtrDay,
    worstClickDay
  };
}

async function main() {
  try {
    // 11월 2주차 (11/10~11/16) - 이미 완료
    // 11월 3주차 (11/17~11/23)
    const week3 = await analyzeWeek('11월 3주차', '2025-11-17', '2025-11-23', '2025-11-10', '2025-11-16');

    // 11월 4주차 (11/24~11/30)
    const week4 = await analyzeWeek('11월 4주차', '2025-11-24', '2025-11-30', '2025-11-17', '2025-11-23');

    // 12월 1주차 (12/1~12/7)
    const week5 = await analyzeWeek('12월 1주차', '2025-12-01', '2025-12-07', '2025-11-24', '2025-11-30');

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
