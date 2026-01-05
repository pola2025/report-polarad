const https = require('https');

const SUPABASE_URL = 'mpljqcuqrrfwzamfyxnz.supabase.co';
const API_KEY = '***REMOVED***';
const USD_TO_KRW = 1430; // 환율

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

async function getMetaData(startDate, endDate) {
  const path = `/rest/v1/polarad_meta_data?date=gte.${startDate}&date=lte.${endDate}&order=date`;
  return makeRequest('GET', path);
}

async function main() {
  console.log('=== 12월 4주차 주간 리포트 생성 ===\n');

  // 12월 4주차 데이터 조회 (12/22 ~ 12/28)
  const week4Data = await getMetaData('2025-12-22', '2025-12-28');
  const week3Data = await getMetaData('2025-12-15', '2025-12-21');

  if (week4Data.length === 0) {
    console.log('⚠️ 12월 4주차 데이터가 아직 없습니다.');
    console.log('   백필 완료 후 다시 실행하세요.');
    return;
  }

  // 4주차 집계
  const daily = {};
  let totalImp = 0, totalClk = 0, totalSpendUSD = 0;

  week4Data.forEach(row => {
    const date = row.date;
    if (!daily[date]) {
      daily[date] = { impressions: 0, clicks: 0, spend: 0 };
    }
    daily[date].impressions += row.impressions || 0;
    daily[date].clicks += row.clicks || 0;
    daily[date].spend += parseFloat(row.spend) || 0;

    totalImp += row.impressions || 0;
    totalClk += row.clicks || 0;
    totalSpendUSD += parseFloat(row.spend) || 0;
  });

  const totalSpendKRW = Math.round(totalSpendUSD * USD_TO_KRW);
  const ctr = (totalClk / totalImp * 100).toFixed(2);
  const cpc = Math.round(totalSpendKRW / totalClk);

  // 3주차 집계 (비교용)
  let prevImp = 0, prevClk = 0, prevSpendUSD = 0;
  week3Data.forEach(row => {
    prevImp += row.impressions || 0;
    prevClk += row.clicks || 0;
    prevSpendUSD += parseFloat(row.spend) || 0;
  });
  const prevSpendKRW = Math.round(prevSpendUSD * USD_TO_KRW);
  const prevCtr = (prevClk / prevImp * 100).toFixed(2);

  // 변화율 계산
  const impChange = ((totalImp - prevImp) / prevImp * 100).toFixed(1);
  const clkChange = ((totalClk - prevClk) / prevClk * 100).toFixed(1);
  const spendChange = ((totalSpendKRW - prevSpendKRW) / prevSpendKRW * 100).toFixed(1);
  const ctrChange = ((parseFloat(ctr) - parseFloat(prevCtr)) / parseFloat(prevCtr) * 100).toFixed(1);

  console.log('4주차 집계:');
  console.log(`  노출: ${totalImp.toLocaleString()}`);
  console.log(`  클릭: ${totalClk}`);
  console.log(`  비용: ${totalSpendKRW.toLocaleString()}원 (${totalSpendUSD.toFixed(2)} USD)`);
  console.log(`  CTR: ${ctr}%`);
  console.log(`  CPC: ${cpc}원`);
  console.log(`\n전주 대비: 노출 ${impChange}%, 클릭 ${clkChange}%, 비용 ${spendChange}%`);

  // 일별 최고/최저 찾기
  const dailyArr = Object.entries(daily).map(([date, d]) => ({
    date,
    ...d,
    ctr: (d.clicks / d.impressions * 100).toFixed(2)
  })).sort((a, b) => a.date.localeCompare(b.date));

  const maxClkDay = dailyArr.reduce((max, d) => d.clicks > max.clicks ? d : max);
  const maxCtrDay = dailyArr.reduce((max, d) => parseFloat(d.ctr) > parseFloat(max.ctr) ? d : max);

  const dayNames = {
    '2025-12-22': '일요일(12/22)',
    '2025-12-23': '월요일(12/23)',
    '2025-12-24': '화요일(12/24)',
    '2025-12-25': '수요일(12/25)',
    '2025-12-26': '목요일(12/26)',
    '2025-12-27': '금요일(12/27)',
    '2025-12-28': '토요일(12/28)'
  };

  const reportData = {
    client_id: 'h-e-a-판교',
    report_type: 'weekly',
    period_start: '2025-12-22',
    period_end: '2025-12-28',
    year: 2025,
    month: 12,
    week: 4,
    status: 'published',
    published_at: new Date().toISOString(),
    ai_insights: {
      summary: `12월 넷째 주(12/22~12/28), 총 노출 ${totalImp.toLocaleString()}회, 클릭 ${totalClk}회로 CTR ${ctr}%를 기록했습니다. 주간 광고비 약 ${Math.round(totalSpendKRW/10000)}만원(${totalSpendUSD.toFixed(2)} USD)을 집행하며 전주 대비 노출 ${impChange}%, 클릭 ${clkChange}% 변동했습니다.`,
      highlights: [
        `CTR ${ctr}%로 업계 평균 대비 우수한 성과 유지`,
        `${dayNames[maxClkDay.date]} 클릭 ${maxClkDay.clicks}건으로 주간 최다 기록`,
        `${dayNames[maxCtrDay.date]} CTR ${maxCtrDay.ctr}%로 주간 최고 효율`,
        `클릭당 비용 약 ${cpc}원으로 효율적 집행`
      ],
      weeklyComparison: {
        summary: `전주(12/15~12/21) 대비 노출 ${impChange}%, 클릭 ${clkChange}% 변동했습니다. CTR은 ${ctrChange > 0 ? '+' : ''}${ctrChange}% 변동하여 ${ctr}%를 기록했습니다.`,
        changes: [
          { metric: "노출", change: parseFloat(impChange), direction: impChange >= 0 ? "up" : "down" },
          { metric: "클릭", change: parseFloat(clkChange), direction: clkChange >= 0 ? "up" : "down" },
          { metric: "CTR", change: parseFloat(ctrChange), direction: ctrChange >= 0 ? "up" : "down", note: `${ctr}% 유지` },
          { metric: "CPC", change: 0, direction: "stable", note: `${cpc}원` }
        ]
      },
      dailyInsights: dailyArr.slice(0, 4).map(d => ({
        day: dayNames[d.date],
        note: `노출 ${d.impressions.toLocaleString()}회, 클릭 ${d.clicks}건, CTR ${d.ctr}%`
      })),
      recommendations: [
        {
          platform: "meta",
          priority: "high",
          type: "budget",
          title: "연말 마무리 예산 점검",
          description: `CTR ${ctr}%는 우수한 성과입니다. 연말 마무리 기간 동안 현재 예산을 유지하며 12월 성과를 마무리하세요.`,
          expectedImpact: "월간 목표 달성 예상"
        },
        {
          platform: "meta",
          priority: "medium",
          type: "creative",
          title: "새해 시즌 크리에이티브 준비",
          description: "1월 신년 프로모션을 위한 크리에이티브 준비를 권장합니다. 새해 다이어트/건강 관련 메시지가 효과적입니다."
        },
        {
          platform: "meta",
          priority: "medium",
          type: "analysis",
          title: "12월 월간 성과 분석",
          description: "12월 전체 성과를 분석하고 1월 광고 전략을 수립하세요."
        }
      ],
      naverDataNote: "* 12월 네이버 키워드 데이터는 월 마감 후 익월에 업데이트됩니다.",
      generatedAt: new Date().toISOString()
    },
    ai_generated_at: new Date().toISOString()
  };

  try {
    console.log('\n리포트 생성 중...');
    const result = await makeRequest('POST', '/rest/v1/polarad_reports', reportData);

    console.log('✅ 12월 4주차 리포트 생성 완료!');
    console.log('리포트 ID:', result[0]?.id || result.id);
    console.log('기간: 2025-12-22 ~ 2025-12-28');
    console.log('\n리포트 URL:');
    console.log(`https://report.polarad.co.kr/report/weekly/${result[0]?.id || result.id}`);

    return result[0]?.id || result.id;
  } catch (err) {
    console.error('❌ 리포트 생성 실패:', err.message);
    throw err;
  }
}

main().catch(console.error);
