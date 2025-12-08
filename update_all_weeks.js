const https = require('https');

const SUPABASE_URL = 'mpljqcuqrrfwzamfyxnz.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGpxY3VxcnJmd3phbWZ5eG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ5Njk3NiwiZXhwIjoyMDc5MDcyOTc2fQ.bnVOXhB28UGdiPDHYYwMP8dyKAQ6k9zrjUu7cam4HEY';

function updateReport(reportId, aiInsights) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      ai_insights: aiInsights,
      ai_generated_at: new Date().toISOString()
    });

    const options = {
      hostname: SUPABASE_URL,
      path: `/rest/v1/polarad_reports?id=eq.${reportId}`,
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
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 204) {
          resolve({ success: true });
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    // 11월 3주차 (e9c4ef3c-a800-40da-a413-2180e463e93f)
    console.log('Updating 11월 3주차...');
    await updateReport('e9c4ef3c-a800-40da-a413-2180e463e93f', {
      summary: "11월 셋째 주(11/17~11/23), 총 노출 72,118회, 클릭 1,351회로 CTR 1.87%를 기록했습니다. 주간 광고비 약 31.5만원(210.37 USD)을 집행하며 노출수가 전주 대비 43% 증가했습니다.",
      highlights: [
        "주간 총 노출수 72,118회로 월중 최고치 달성",
        "전주 대비 노출 43% 대폭 증가",
        "영상 조회수 19,018회 기록",
        "주말(토/일) 성과 집중 - 전체 클릭의 34% 차지"
      ],
      weeklyComparison: {
        summary: "전주(11/10~11/16) 대비 노출수가 43% 대폭 증가했으나, CTR은 17.6% 감소했습니다. 노출 확대에 따른 자연스러운 효율 조정으로 판단됩니다.",
        changes: [
          { metric: "노출", change: 43.0, direction: "up", note: "대폭 증가" },
          { metric: "클릭", change: 17.9, direction: "up", note: "" },
          { metric: "CTR", change: -17.6, direction: "down", note: "효율 조정" },
          { metric: "CPC", change: 7.1, direction: "up", note: "" }
        ]
      },
      dailyInsights: [
        { day: "월요일(11/17)", note: "CTR 2.00%로 주간 최고 효율 기록" },
        { day: "금요일(11/21)", note: "노출 7,524회로 주간 최저, 클릭 146건" },
        { day: "토요일(11/22)", note: "노출 11,128회, 클릭 221건으로 주말 상승세 시작" },
        { day: "일요일(11/23)", note: "주간 최고 클릭(234건) 및 노출(11,888회)" }
      ],
      recommendations: [
        {
          platform: "meta",
          priority: "high",
          type: "targeting",
          title: "CTR 회복을 위한 타겟팅 점검",
          description: "노출 증가 대비 CTR이 감소했습니다. 타겟 오디언스 범위가 넓어졌는지 확인하고, 핵심 타겟에 집중하세요.",
          expectedImpact: "CTR 0.3~0.5%p 개선 예상"
        },
        {
          platform: "meta",
          priority: "medium",
          type: "budget",
          title: "주말 집중 예산 배분",
          description: "토/일요일에 전체 성과의 34%가 집중됩니다. 주말 예산을 15% 추가 배분하세요."
        }
      ],
      generatedAt: new Date().toISOString()
    });
    console.log('✅ 11월 3주차 완료');

    // 11월 4주차 (0877d00d-3299-4e4a-8ed6-f471ad763d9e)
    console.log('Updating 11월 4주차...');
    await updateReport('0877d00d-3299-4e4a-8ed6-f471ad763d9e', {
      summary: "11월 넷째 주(11/24~11/30), 총 노출 54,925회, 클릭 1,211회로 CTR 2.20%를 기록했습니다. 주간 광고비 약 31.4만원(209.71 USD)을 집행하며 전주 대비 CTR이 17.7% 개선되었습니다.",
      highlights: [
        "CTR 2.20%로 전주 대비 17.7% 개선",
        "금요일 CTR 2.64%로 주간 최고 효율",
        "클릭당 비용 약 260원 유지",
        "영상 조회수 15,195회 기록"
      ],
      weeklyComparison: {
        summary: "전주(11/17~11/23) 대비 노출은 23.8% 감소했으나, CTR이 17.7% 개선되어 광고 효율이 회복되었습니다. 타겟팅 최적화 효과로 판단됩니다.",
        changes: [
          { metric: "노출", change: -23.8, direction: "down", note: "조정" },
          { metric: "클릭", change: -10.4, direction: "down", note: "" },
          { metric: "CTR", change: 17.7, direction: "up", note: "효율 개선" },
          { metric: "CPC", change: 11.2, direction: "up", note: "" }
        ]
      },
      dailyInsights: [
        { day: "금요일(11/28)", note: "CTR 2.64%로 주간 최고 효율, 클릭 171건" },
        { day: "토요일(11/29)", note: "클릭 138건으로 주간 최저, 주말 하락" },
        { day: "일요일(11/30)", note: "클릭 206건으로 회복, CTR 2.58% 우수" },
        { day: "월요일(11/24)", note: "노출 10,425회로 주간 최고 노출" }
      ],
      recommendations: [
        {
          platform: "meta",
          priority: "high",
          type: "creative",
          title: "12월 연말 크리에이티브 준비",
          description: "12월 연말 시즌에 맞는 송년회/크리스마스 테마 크리에이티브를 준비하세요. 시즌 키워드 반영이 중요합니다.",
          expectedImpact: "CTR 10~15% 추가 개선 예상"
        },
        {
          platform: "meta",
          priority: "medium",
          type: "budget",
          title: "금요일 예산 집중",
          description: "금요일 CTR 2.64%로 최고 효율을 보였습니다. 금요일 저녁 시간대 예산을 증액하세요."
        }
      ],
      generatedAt: new Date().toISOString()
    });
    console.log('✅ 11월 4주차 완료');

    // 12월 1주차 (aef526b7-3326-4cca-ae98-f91d360a1d72)
    console.log('Updating 12월 1주차...');
    await updateReport('aef526b7-3326-4cca-ae98-f91d360a1d72', {
      summary: "12월 첫째 주(12/1~12/7), 총 노출 25,541회, 클릭 578회로 CTR 2.26%를 기록했습니다. 주간 광고비 약 14만원(93.30 USD)을 집행하며 효율적인 캠페인 운영이 지속되고 있습니다.",
      highlights: [
        "CTR 2.26%로 안정적 효율 유지",
        "클릭당 비용 약 242원으로 전주 대비 6.8% 절감",
        "목요일 CTR 2.62%로 주간 최고 효율",
        "영상 조회수 6,624회 기록"
      ],
      weeklyComparison: {
        summary: "전주(11/24~11/30) 대비 노출이 53.5% 감소했으나, 이는 예산 조정에 따른 것으로 CTR은 2.6% 개선되고 CPC는 6.8% 절감되었습니다.",
        changes: [
          { metric: "노출", change: -53.5, direction: "down", note: "예산 조정" },
          { metric: "클릭", change: -52.3, direction: "down", note: "예산 조정" },
          { metric: "CTR", change: 2.6, direction: "up", note: "효율 유지" },
          { metric: "CPC", change: -6.8, direction: "down", note: "비용 절감" }
        ]
      },
      dailyInsights: [
        { day: "월요일(12/1)", note: "클릭 92건으로 주간 최고, 월초 효과" },
        { day: "목요일(12/4)", note: "CTR 2.62%로 주간 최고 효율" },
        { day: "토요일(12/6)", note: "클릭 66건으로 주간 최저" },
        { day: "일요일(12/7)", note: "노출 4,216회로 주간 최고 노출" }
      ],
      recommendations: [
        {
          platform: "meta",
          priority: "high",
          type: "budget",
          title: "연말 성수기 예산 확대",
          description: "연말 송년회/모임 시즌에 맞춰 주간 예산을 20~30% 증액하여 기회를 극대화하세요.",
          expectedImpact: "주간 클릭 50% 이상 증가 예상"
        },
        {
          platform: "meta",
          priority: "medium",
          type: "targeting",
          title: "저녁 시간대 타겟팅 최적화",
          description: "저녁 시간대(17~21시)에 노출이 집중되도록 광고 스케줄을 조정하세요."
        }
      ],
      // 12월 1주차 특별 안내 - 네이버 데이터 미집계
      naverDataNote: "* 12월 네이버 키워드 데이터는 월 마감 후 익월에 업데이트됩니다. 현재 리포트는 Meta 광고 데이터만 반영되어 있습니다.",
      generatedAt: new Date().toISOString()
    });
    console.log('✅ 12월 1주차 완료');

    console.log('\n모든 주차 업데이트 완료!');

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
