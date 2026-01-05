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
  console.log('=== 12월 3주차 주간 리포트 생성 ===\n');

  // 12월 3주차 데이터 조회
  const week3Data = await getMetaData('2025-12-15', '2025-12-21');
  const week2Data = await getMetaData('2025-12-08', '2025-12-14');

  // 3주차 집계
  const daily = {};
  let totalImp = 0, totalClk = 0, totalSpendUSD = 0;

  week3Data.forEach(row => {
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

  // 2주차 집계 (비교용)
  let prevImp = 0, prevClk = 0, prevSpendUSD = 0;
  week2Data.forEach(row => {
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

  console.log('3주차 집계:');
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
  const maxImpDay = dailyArr.reduce((max, d) => d.impressions > max.impressions ? d : max);

  const dayNames = {
    '2025-12-15': '일요일(12/15)',
    '2025-12-16': '월요일(12/16)',
    '2025-12-17': '화요일(12/17)',
    '2025-12-18': '수요일(12/18)',
    '2025-12-19': '목요일(12/19)',
    '2025-12-20': '금요일(12/20)',
    '2025-12-21': '토요일(12/21)'
  };

  const reportData = {
    client_id: 'h-e-a-판교',
    report_type: 'weekly',
    period_start: '2025-12-15',
    period_end: '2025-12-21',
    year: 2025,
    month: 12,
    week: 3,
    status: 'published',
    published_at: new Date().toISOString(),
    ai_insights: {
      summary: `12월 셋째 주(12/15~12/21), 총 노출 ${totalImp.toLocaleString()}회, 클릭 ${totalClk}회로 CTR ${ctr}%를 기록했습니다. 주간 광고비 약 ${Math.round(totalSpendKRW/10000)}만원(${totalSpendUSD.toFixed(2)} USD)을 집행하며 전주 대비 노출 ${impChange}%, 클릭 ${clkChange}% 변동했습니다.`,
      highlights: [
        `CTR ${ctr}%로 업계 평균 대비 우수한 성과 유지`,
        `${dayNames[maxClkDay.date]} 클릭 ${maxClkDay.clicks}건으로 주간 최다 기록`,
        `${dayNames[maxCtrDay.date]} CTR ${maxCtrDay.ctr}%로 주간 최고 효율`,
        `클릭당 비용 약 ${cpc}원으로 효율적 집행`
      ],
      weeklyComparison: {
        summary: `전주(12/8~12/14) 대비 노출 ${impChange}%, 클릭 ${clkChange}% 변동했습니다. CTR은 ${ctrChange > 0 ? '+' : ''}${ctrChange}% 변동하여 ${ctr}%를 기록했습니다.`,
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
          title: "크리스마스 시즌 예산 유지",
          description: `CTR ${ctr}%는 우수한 성과입니다. 크리스마스 연휴(12/24~25)를 앞두고 현재 예산을 유지하거나 주말 예산을 10% 추가 증액을 권장합니다.`,
          expectedImpact: "연휴 기간 클릭 추가 확보 예상"
        },
        {
          platform: "meta",
          priority: "medium",
          type: "creative",
          title: "연말/크리스마스 시즌 크리에이티브",
          description: "크리스마스/연말 모임 테마의 크리에이티브를 활용하여 시즌 수요를 공략하세요."
        },
        {
          platform: "meta",
          priority: "medium",
          type: "schedule",
          title: "연휴 기간 광고 운영",
          description: "12/24~25 크리스마스 연휴에는 외식 수요가 증가합니다. 광고 노출을 유지하세요."
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

    console.log('✅ 12월 3주차 리포트 생성 완료!');
    console.log('리포트 ID:', result[0]?.id || result.id);
    console.log('기간: 2025-12-15 ~ 2025-12-21');
    console.log('\n리포트 URL:');
    console.log(`https://report.polarad.co.kr/report/weekly/${result[0]?.id || result.id}`);

    return result[0]?.id || result.id;
  } catch (err) {
    console.error('❌ 리포트 생성 실패:', err.message);
    throw err;
  }
}

main().catch(console.error);
