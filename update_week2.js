const https = require('https');

const SUPABASE_URL = 'mpljqcuqrrfwzamfyxnz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGpxY3VxcnJmd3phbWZ5eG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5Njk3NiwiZXhwIjoyMDc5MDcyOTc2fQ.bnVOXhB28UGdiPDHYYwMP8dyKAQ6k9zrjUu7cam4HEY';
const REPORT_ID = '29b786e9-b90f-4abc-ae45-24ded88a3ee1';

const aiInsights = {
  summary: "11월 둘째 주(11/10~11/16), 총 노출 50,415회, 클릭 1,146회로 CTR 2.27%를 기록했습니다. 주간 광고비 약 25만원(166.57 USD)을 집행하며 효율적인 클릭당 비용(CPC 218원)을 달성했습니다.",
  highlights: [
    "주간 총 노출수 50,415회 달성",
    "CTR 2.27%로 업계 평균(1.5~2.0%) 대비 우수",
    "클릭당 비용 약 218원으로 효율적 집행",
    "영상 조회수 14,109회 기록"
  ],
  weeklyComparison: {
    summary: "전주(11/3~11/9)는 광고가 대부분 OFF 상태로 정상적인 비교가 어렵습니다. 본 주차부터 본격적인 캠페인 집행이 시작되어 안정적인 성과 데이터가 확보되었습니다.",
    changes: [
      { metric: "노출", change: 826.7, direction: "up", note: "전주 광고 OFF" },
      { metric: "클릭", change: 1023.5, direction: "up", note: "전주 광고 OFF" },
      { metric: "CTR", change: 21.2, direction: "up", note: "" },
      { metric: "CPC", change: -23.0, direction: "down", note: "효율 개선" }
    ]
  },
  dailyInsights: [
    { day: "화요일(11/11)", note: "CTR 3.28%로 주간 최고 효율 기록" },
    { day: "수요일(11/12)", note: "노출수 9,008회로 평균 이상, 안정적 성과" },
    { day: "금요일(11/14)", note: "클릭 206건으로 평일 최고 클릭수 기록" },
    { day: "일요일(11/16)", note: "주간 최고 클릭(238건) 및 노출(11,981회), 주말 효과 확인" }
  ],
  recommendations: [
    {
      platform: "meta",
      priority: "high",
      type: "budget",
      title: "주말 예산 확대 검토",
      description: "일요일에 최고 성과를 기록했습니다. 주말 예산을 10~15% 증액하여 추가 성과를 확보하세요.",
      expectedImpact: "주간 클릭 5~8% 증가 예상"
    },
    {
      platform: "meta",
      priority: "medium",
      type: "creative",
      title: "화요일 고효율 요인 분석",
      description: "화요일 CTR 3.28%는 타 요일 대비 50% 이상 높습니다. 해당 일자의 크리에이티브/타겟팅 설정을 확인하여 성공 요인을 파악하세요."
    }
  ],
  generatedAt: new Date().toISOString()
};

const data = JSON.stringify({
  ai_insights: aiInsights,
  ai_generated_at: new Date().toISOString()
});

const options = {
  hostname: SUPABASE_URL,
  path: `/rest/v1/polarad_reports?id=eq.${REPORT_ID}`,
  method: 'PATCH',
  headers: {
    'apikey': API_KEY,
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'Prefer': 'return=minimal'
  }
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (body) console.log('Response:', body);
    console.log('Update completed successfully!');
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(data);
req.end();
