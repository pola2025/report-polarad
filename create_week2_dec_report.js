const https = require('https');

const SUPABASE_URL = 'mpljqcuqrrfwzamfyxnz.supabase.co';
const API_KEY = '***REMOVED***';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: path,
      method: method,
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function main() {
  console.log('=== 12월 2주차 주간 리포트 생성 ===\n');

  const reportData = {
    client_id: 'h-e-a-판교',
    report_type: 'weekly',
    period_start: '2025-12-08',
    period_end: '2025-12-14',
    year: 2025,
    month: 12,
    week: 2,
    status: 'published',
    published_at: new Date().toISOString(),
    ai_insights: {
      summary: "12월 둘째 주(12/8~12/14), 총 노출 30,118회, 클릭 909회로 CTR 3.02%를 기록했습니다. 주간 광고비 약 17.3만원(115.13 USD)을 집행하며 전주 대비 노출 17.9%, 클릭 12.1% 증가했습니다.",
      highlights: [
        "CTR 3.02%로 업계 평균 대비 매우 우수한 성과",
        "전주 대비 노출 17.9%, 클릭 12.1% 증가",
        "일요일 클릭 157건으로 주간 최다 기록",
        "클릭당 비용 약 190원으로 효율적 집행"
      ],
      weeklyComparison: {
        summary: "전주(12/1~12/7) 대비 노출과 클릭이 모두 증가했습니다. CTR은 소폭 감소(-4.9%)했으나 3.02%로 여전히 매우 높은 수준을 유지하고 있습니다.",
        changes: [
          { metric: "노출", change: 17.9, direction: "up", note: "예산 증가 효과" },
          { metric: "클릭", change: 12.1, direction: "up", note: "트래픽 증가" },
          { metric: "CTR", change: -4.9, direction: "down", note: "3.02% 유지" },
          { metric: "CPC", change: 10.1, direction: "up", note: "190원" }
        ]
      },
      dailyInsights: [
        { day: "월요일(12/8)", note: "CTR 3.41%로 주간 최고 효율, 클릭 128건" },
        { day: "목요일(12/11)", note: "노출 4,849회로 주간 최다 노출" },
        { day: "금요일(12/12)", note: "CTR 3.16%, 클릭 135건 기록" },
        { day: "일요일(12/14)", note: "클릭 157건으로 주간 최다 클릭, CTR 3.36%" }
      ],
      recommendations: [
        {
          platform: "meta",
          priority: "high",
          type: "budget",
          title: "연말 성수기 예산 유지/증액",
          description: "현재 CTR 3.02%는 매우 우수한 성과입니다. 크리스마스 시즌을 앞두고 현재 예산을 유지하거나 10-15% 추가 증액을 권장합니다.",
          expectedImpact: "주간 클릭 100회 이상 추가 확보 예상"
        },
        {
          platform: "meta",
          priority: "medium",
          type: "schedule",
          title: "주말 예산 집중",
          description: "일요일에 주간 최다 클릭(157건)을 기록했습니다. 주말 예산을 10% 추가 배분하면 효율적입니다."
        },
        {
          platform: "meta",
          priority: "medium",
          type: "creative",
          title: "크리스마스 시즌 크리에이티브",
          description: "크리스마스/연말 모임 테마의 크리에이티브를 추가하여 시즌 수요를 공략하세요."
        }
      ],
      naverDataNote: "* 12월 네이버 키워드 데이터는 월 마감 후 익월에 업데이트됩니다. 현재 리포트는 Meta 광고 데이터만 반영되어 있습니다.",
      generatedAt: new Date().toISOString()
    },
    ai_generated_at: new Date().toISOString()
  };

  try {
    console.log('리포트 생성 중...');
    const result = await makeRequest('POST', '/rest/v1/polarad_reports', reportData);

    console.log('✅ 12월 2주차 리포트 생성 완료!');
    console.log('리포트 ID:', result[0]?.id || result.id);
    console.log('기간: 2025-12-08 ~ 2025-12-14');
    console.log('\n리포트 URL:');
    console.log(`https://report.polarad.co.kr/report/monthly/${result[0]?.id || result.id}`);

    return result[0]?.id || result.id;
  } catch (err) {
    console.error('❌ 리포트 생성 실패:', err.message);
    throw err;
  }
}

main().catch(console.error);
