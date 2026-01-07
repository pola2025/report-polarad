#!/usr/bin/env node
/**
 * 나라똔 리포트 생성 스크립트
 *
 * 사용법:
 *   node create-naratton-report.js --type monthly --month 12  # 12월 월간 리포트
 *   node create-naratton-report.js --type weekly --start 2026-01-06 --end 2026-01-12  # 주간 리포트
 *   node create-naratton-report.js --force                    # 기존 리포트 덮어쓰기
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKFILL_CHAT_ID = '-1003394139746';

// 나라똔 Airtable 설정
const NARATTON_BASE_ID = process.env.AIRTABLE_NARATTON_BASE_ID;
const NARATTON_TABLE_ID = process.env.AIRTABLE_NARATTON_TABLE_ID;

// 리포트 Airtable 설정
const REPORTS_BASE_ID = process.env.AIRTABLE_REPORTS_BASE_ID || 'appJlOqnadLsMJQYw';
const REPORTS_TABLE_ID = process.env.AIRTABLE_REPORTS_TABLE_ID || 'tbl4BAtILQRH7JQaG';

// 나라똔 클라이언트 정보
const NARATTON_CLIENT_ID = '나라똔';
const NARATTON_SLUG = 'naratton';

/**
 * Airtable에서 나라똔 광고 데이터 조회
 */
async function fetchNarattonData(startDate, endDate, source = null) {
  const endDateObj = new Date(endDate);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const nextDay = endDateObj.toISOString().split('T')[0];

  let formula = `AND({date}>='${startDate}', {date}<'${nextDay}')`;
  if (source) {
    formula = `AND({date}>='${startDate}', {date}<'${nextDay}', {source}='${source}')`;
  }

  const allRecords = [];
  let offset;

  do {
    let url = `https://api.airtable.com/v0/${NARATTON_BASE_ID}/${NARATTON_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=date&sort[0][direction]=asc`;
    if (offset) url += `&offset=${offset}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await response.json();
    if (data.error) {
      console.error('Airtable error:', data.error);
      break;
    }

    const records = (data.records || []).map(r => ({
      date: r.fields.date,
      device: r.fields.device || 'other',
      impressions: r.fields.impressions || 0,
      clicks: r.fields.clicks || 0,
      leads: r.fields.leads || 0,
      spend: r.fields.spend || 0,
      source: r.fields.source || 'meta',
      campaign_name: r.fields.campaign_name || '',
    }));

    allRecords.push(...records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

/**
 * 기존 리포트 확인
 */
async function checkExistingReport(year, month, week, reportType) {
  let formula;
  if (reportType === 'monthly') {
    formula = `AND({client_id}='${NARATTON_CLIENT_ID}', {report_type}='monthly', {year}=${year}, {month}=${month})`;
  } else {
    formula = `AND({client_id}='${NARATTON_CLIENT_ID}', {report_type}='weekly', {year}=${year}, {month}=${month}, {week}=${week})`;
  }

  const url = `https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  });

  const data = await response.json();
  if (data.error || !data.records?.length) return null;

  return {
    id: data.records[0].fields.id,
    airtableId: data.records[0].id,
  };
}

/**
 * 리포트 삭제
 */
async function deleteReport(airtableId) {
  const response = await fetch(`https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}/${airtableId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  });

  const data = await response.json();
  return data.deleted;
}

/**
 * 리포트 생성
 */
async function createReport(reportData) {
  const id = crypto.randomUUID();

  const fields = {
    id,
    client_id: reportData.client_id,
    client_slug: NARATTON_SLUG,
    report_type: reportData.report_type,
    period_start: reportData.period_start,
    period_end: reportData.period_end,
    year: reportData.year,
    month: reportData.month || null,
    week: reportData.week || null,
    status: 'published',
    published_at: new Date().toISOString(),
    ai_insights: JSON.stringify(reportData.ai_insights),
    ai_generated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(`https://api.airtable.com/v0/${REPORTS_BASE_ID}/${REPORTS_TABLE_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  const data = await response.json();
  if (data.error || !data.records?.length) {
    throw new Error(`리포트 생성 실패: ${JSON.stringify(data.error)}`);
  }

  return { id, airtableId: data.records[0].id };
}

/**
 * 텔레그램 알림
 */
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: BACKFILL_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error('텔레그램 알림 실패:', error.message);
  }
}

/**
 * 변화율 계산
 */
function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

/**
 * 월간 리포트 생성
 */
async function createMonthlyReport(year, month, forceOverwrite = false) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  console.log(`\n📊 나라똔 ${year}년 ${month}월 월간 리포트 생성`);
  console.log(`   기간: ${startDate} ~ ${endDate}`);

  // 기존 리포트 확인
  const existing = await checkExistingReport(year, month, null, 'monthly');
  if (existing && !forceOverwrite) {
    console.log(`   ⚠️ 이미 존재하는 리포트: ${existing.id}`);
    return existing.id;
  }

  // 데이터 조회
  const allData = await fetchNarattonData(startDate, endDate);
  console.log(`   📥 조회된 레코드: ${allData.length}건`);

  // Meta 데이터 집계
  const metaData = allData.filter(r => r.source === 'meta');
  const metaTotals = metaData.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      leads: acc.leads + row.leads,
      spend: acc.spend + row.spend,
    }),
    { impressions: 0, clicks: 0, leads: 0, spend: 0 }
  );

  // Naver 데이터 집계 (있다면)
  const naverData = allData.filter(r => r.source !== 'meta');
  const naverTotals = naverData.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      spend: acc.spend + row.spend,
    }),
    { impressions: 0, clicks: 0, spend: 0 }
  );

  const totalImpressions = metaTotals.impressions + naverTotals.impressions;
  const totalClicks = metaTotals.clicks + naverTotals.clicks;
  const totalSpend = metaTotals.spend + naverTotals.spend;
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const cpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0;
  const cpl = metaTotals.leads > 0 ? Math.round(metaTotals.spend / metaTotals.leads) : 0;

  console.log(`\n📈 집계 결과:`);
  console.log(`   Meta: 노출 ${metaTotals.impressions.toLocaleString()}, 클릭 ${metaTotals.clicks}, 전환 ${metaTotals.leads}, 비용 ${metaTotals.spend.toLocaleString()}원`);
  if (naverTotals.impressions > 0) {
    console.log(`   Naver: 노출 ${naverTotals.impressions.toLocaleString()}, 클릭 ${naverTotals.clicks}, 비용 ${naverTotals.spend.toLocaleString()}원`);
  }
  console.log(`   합계: 노출 ${totalImpressions.toLocaleString()}, 클릭 ${totalClicks}, CTR ${ctr}%`);

  if (totalImpressions === 0) {
    console.log(`   ❌ 데이터가 없어 리포트 생성 중단`);
    await sendTelegram(
      `⚠️ <b>나라똔 월간 리포트 생성 실패</b>\n\n` +
      `📅 기간: ${startDate} ~ ${endDate}\n` +
      `사유: 해당 기간 데이터 없음`
    );
    return null;
  }

  // 일별 데이터 분석
  const daily = {};
  metaData.forEach((row) => {
    if (!daily[row.date]) daily[row.date] = { impressions: 0, clicks: 0, leads: 0, spend: 0 };
    daily[row.date].impressions += row.impressions;
    daily[row.date].clicks += row.clicks;
    daily[row.date].leads += row.leads;
    daily[row.date].spend += row.spend;
  });

  const dailyArr = Object.entries(daily)
    .map(([date, d]) => ({
      date,
      ...d,
      ctr: d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0.00',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 요일별 분석
  const dayOfWeekStats = { 0: { name: '일', clicks: 0, leads: 0 }, 1: { name: '월', clicks: 0, leads: 0 }, 2: { name: '화', clicks: 0, leads: 0 }, 3: { name: '수', clicks: 0, leads: 0 }, 4: { name: '목', clicks: 0, leads: 0 }, 5: { name: '금', clicks: 0, leads: 0 }, 6: { name: '토', clicks: 0, leads: 0 } };
  dailyArr.forEach((d) => {
    const dow = new Date(d.date).getDay();
    dayOfWeekStats[dow].clicks += d.clicks;
    dayOfWeekStats[dow].leads += d.leads;
  });

  const weekendClicks = dayOfWeekStats[0].clicks + dayOfWeekStats[6].clicks;
  const weekendLeads = dayOfWeekStats[0].leads + dayOfWeekStats[6].leads;
  const weekendRatio = totalClicks > 0 ? Math.round((weekendClicks / totalClicks) * 100) : 0;

  // 캠페인별 분석
  const campaignStats = {};
  metaData.forEach((row) => {
    const name = row.campaign_name || '기타';
    if (!campaignStats[name]) campaignStats[name] = { impressions: 0, clicks: 0, leads: 0, spend: 0 };
    campaignStats[name].impressions += row.impressions;
    campaignStats[name].clicks += row.clicks;
    campaignStats[name].leads += row.leads;
    campaignStats[name].spend += row.spend;
  });

  const topCampaigns = Object.entries(campaignStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);

  // 리포트 데이터 생성
  const reportData = {
    client_id: NARATTON_CLIENT_ID,
    report_type: 'monthly',
    period_start: startDate,
    period_end: endDate,
    year,
    month,
    week: null,
    ai_insights: {
      summary: `${month}월 총 노출수 ${totalImpressions.toLocaleString()}회, 클릭수 ${totalClicks.toLocaleString()}회, 전환수 ${metaTotals.leads}건으로 CTR ${ctr}%를 달성했습니다.`,
      highlights: [
        `CTR ${ctr}%로 업계 평균 대비 ${parseFloat(ctr) >= 2 ? '우수한' : '양호한'} 성과`,
        metaTotals.leads > 0 ? `총 ${metaTotals.leads}건 전환, CPL ${cpl.toLocaleString()}원` : null,
        `일 평균 ${Math.round(totalImpressions / lastDay).toLocaleString()}회 노출`,
        weekendRatio >= 30 ? `주말 클릭 비중 ${weekendRatio}%` : null,
      ].filter(Boolean),
      generatedAt: new Date().toISOString(),
      metaAnalysis: {
        overallGrade: parseFloat(ctr) >= 2.5 ? 'A' : parseFloat(ctr) >= 2 ? 'B' : 'C',
        ctrAnalysis: `CTR ${ctr}%로 업계 평균(1.5~2.0%) 대비 ${parseFloat(ctr) >= 2 ? '우수한' : '양호한'} 수준입니다.`,
        cpcAnalysis: `CPC 약 ${cpc.toLocaleString()}원으로 ${cpc < 500 ? '매우 효율적인' : cpc < 1000 ? '효율적인' : '적정한'} 클릭 비용을 달성했습니다.`,
        cplAnalysis: metaTotals.leads > 0 ? `CPL ${cpl.toLocaleString()}원으로 전환 비용을 관리하고 있습니다.` : '전환 데이터 수집 중',
        bestPerformance: weekendRatio >= 40 ? '주말 성과 집중' : '평일 성과 집중',
      },
      weekdayInsight: weekendRatio >= 40
        ? `주말(토/일)에 노출과 클릭이 집중되는 패턴입니다. 전체 클릭의 ${weekendRatio}%가 주말에 발생했습니다.`
        : `평일에 노출과 클릭이 집중되는 패턴입니다.`,
      recommendations: [
        {
          type: 'budget',
          title: '다음 달 예산 전략',
          platform: 'meta',
          priority: 'high',
          description: `현재 CTR ${ctr}%는 ${parseFloat(ctr) >= 2 ? '우수한' : '양호한'} 성과입니다. ${metaTotals.leads > 0 ? `CPL ${cpl.toLocaleString()}원을 유지하면서` : ''} 다음 달 예산을 효율적으로 운영하세요.`,
          expectedImpact: '전환 효율 개선 예상',
        },
      ],
      platforms: {
        meta: {
          impressions: metaTotals.impressions,
          clicks: metaTotals.clicks,
          leads: metaTotals.leads,
          spend: metaTotals.spend,
        },
        naver: naverTotals.impressions > 0 ? {
          impressions: naverTotals.impressions,
          clicks: naverTotals.clicks,
          spend: naverTotals.spend,
        } : null,
      },
      topCampaigns,
    },
  };

  // 기존 리포트 삭제 (force 모드)
  if (existing && forceOverwrite) {
    await deleteReport(existing.airtableId);
    console.log(`   🗑️ 기존 리포트 삭제: ${existing.id}`);
  }

  // 리포트 저장
  const result = await createReport(reportData);

  console.log(`\n✅ 월간 리포트 생성 완료!`);
  console.log(`   ID: ${result.id}`);
  console.log(`   URL: https://report.polarad.co.kr/report/monthly/${result.id}`);

  await sendTelegram(
    `✅ <b>나라똔 ${year}년 ${month}월 월간 리포트 생성 완료</b>\n\n` +
    `📅 기간: ${startDate} ~ ${endDate}\n` +
    `📊 노출: ${totalImpressions.toLocaleString()}회\n` +
    `🖱️ 클릭: ${totalClicks.toLocaleString()}회 (CTR ${ctr}%)\n` +
    `🎯 전환: ${metaTotals.leads}건\n` +
    `💰 광고비: 약 ${Math.round(totalSpend / 10000)}만원\n\n` +
    `🔗 https://report.polarad.co.kr/report/monthly/${result.id}`
  );

  return result.id;
}

/**
 * 주간 리포트 생성
 */
async function createWeeklyReport(startDate, endDate, forceOverwrite = false) {
  const year = parseInt(startDate.split('-')[0]);
  const month = parseInt(startDate.split('-')[1]);
  const week = Math.ceil(parseInt(startDate.split('-')[2]) / 7);

  console.log(`\n📊 나라똔 ${year}년 ${month}월 ${week}주차 주간 리포트 생성`);
  console.log(`   기간: ${startDate} ~ ${endDate}`);

  // 기존 리포트 확인
  const existing = await checkExistingReport(year, month, week, 'weekly');
  if (existing && !forceOverwrite) {
    console.log(`   ⚠️ 이미 존재하는 리포트: ${existing.id}`);
    return existing.id;
  }

  // 데이터 조회
  const allData = await fetchNarattonData(startDate, endDate);
  console.log(`   📥 조회된 레코드: ${allData.length}건`);

  // Meta 데이터 집계
  const metaData = allData.filter(r => r.source === 'meta');
  const metaTotals = metaData.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      leads: acc.leads + row.leads,
      spend: acc.spend + row.spend,
    }),
    { impressions: 0, clicks: 0, leads: 0, spend: 0 }
  );

  // Naver 데이터 집계
  const naverData = allData.filter(r => r.source !== 'meta');
  const naverTotals = naverData.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      spend: acc.spend + row.spend,
    }),
    { impressions: 0, clicks: 0, spend: 0 }
  );

  const totalImpressions = metaTotals.impressions + naverTotals.impressions;
  const totalClicks = metaTotals.clicks + naverTotals.clicks;
  const totalSpend = metaTotals.spend + naverTotals.spend;
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const cpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0;

  console.log(`\n📈 집계 결과:`);
  console.log(`   Meta: 노출 ${metaTotals.impressions.toLocaleString()}, 클릭 ${metaTotals.clicks}, 전환 ${metaTotals.leads}, 비용 ${metaTotals.spend.toLocaleString()}원`);
  console.log(`   합계: 노출 ${totalImpressions.toLocaleString()}, 클릭 ${totalClicks}, CTR ${ctr}%`);

  if (totalImpressions === 0) {
    console.log(`   ❌ 데이터가 없어 리포트 생성 중단`);
    await sendTelegram(
      `⚠️ <b>나라똔 주간 리포트 생성 실패</b>\n\n` +
      `📅 기간: ${startDate} ~ ${endDate}\n` +
      `사유: 해당 기간 데이터 없음`
    );
    return null;
  }

  // 일별 데이터 분석
  const daily = {};
  metaData.forEach((row) => {
    if (!daily[row.date]) daily[row.date] = { impressions: 0, clicks: 0, leads: 0, spend: 0 };
    daily[row.date].impressions += row.impressions;
    daily[row.date].clicks += row.clicks;
    daily[row.date].leads += row.leads;
    daily[row.date].spend += row.spend;
  });

  const dailyArr = Object.entries(daily)
    .map(([date, d]) => ({
      date,
      ...d,
      ctr: d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0.00',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const maxClkDay = dailyArr.length > 0 ? dailyArr.reduce((max, d) => (d.clicks > max.clicks ? d : max)) : null;
  const maxLeadDay = dailyArr.length > 0 ? dailyArr.reduce((max, d) => (d.leads > max.leads ? d : max)) : null;

  // 리포트 데이터 생성
  const reportData = {
    client_id: NARATTON_CLIENT_ID,
    report_type: 'weekly',
    period_start: startDate,
    period_end: endDate,
    year,
    month,
    week,
    ai_insights: {
      summary: `${month}월 ${week}주차(${startDate.slice(5)}~${endDate.slice(5)}), 총 노출 ${totalImpressions.toLocaleString()}회, 클릭 ${totalClicks}회, 전환 ${metaTotals.leads}건으로 CTR ${ctr}%를 기록했습니다.`,
      highlights: [
        `CTR ${ctr}%로 업계 평균 대비 우수한 성과 유지`,
        maxClkDay ? `${maxClkDay.date} 클릭 ${maxClkDay.clicks}건으로 주간 최다` : null,
        maxLeadDay && maxLeadDay.leads > 0 ? `${maxLeadDay.date} 전환 ${maxLeadDay.leads}건으로 주간 최다` : null,
        `클릭당 비용 약 ${cpc.toLocaleString()}원으로 효율적 집행`,
      ].filter(Boolean),
      platforms: {
        meta: {
          impressions: metaTotals.impressions,
          clicks: metaTotals.clicks,
          leads: metaTotals.leads,
          spend: metaTotals.spend,
        },
        naver: naverTotals.impressions > 0 ? {
          impressions: naverTotals.impressions,
          clicks: naverTotals.clicks,
          spend: naverTotals.spend,
        } : null,
      },
      recommendations: [
        {
          platform: 'meta',
          priority: 'high',
          type: 'optimization',
          title: '현재 성과 유지',
          description: `CTR ${ctr}%는 우수한 성과입니다. 현재 전략을 유지하면서 전환 최적화에 집중하세요.`,
        },
      ],
      generatedAt: new Date().toISOString(),
    },
  };

  // 기존 리포트 삭제 (force 모드)
  if (existing && forceOverwrite) {
    await deleteReport(existing.airtableId);
    console.log(`   🗑️ 기존 리포트 삭제: ${existing.id}`);
  }

  // 리포트 저장
  const result = await createReport(reportData);

  console.log(`\n✅ 주간 리포트 생성 완료!`);
  console.log(`   ID: ${result.id}`);
  console.log(`   URL: https://report.polarad.co.kr/report/weekly/${result.id}`);

  await sendTelegram(
    `✅ <b>나라똔 주간 리포트 생성 완료</b>\n\n` +
    `📅 ${month}월 ${week}주차 (${startDate} ~ ${endDate})\n` +
    `📊 노출: ${totalImpressions.toLocaleString()}회\n` +
    `🖱️ 클릭: ${totalClicks}회 (CTR ${ctr}%)\n` +
    `🎯 전환: ${metaTotals.leads}건\n` +
    `💰 광고비: 약 ${Math.round(totalSpend / 10000)}만원\n\n` +
    `🔗 https://report.polarad.co.kr/report/weekly/${result.id}`
  );

  return result.id;
}

/**
 * 메인 함수
 */
async function main() {
  console.log('🚀 나라똔 리포트 생성 스크립트\n');

  const args = process.argv.slice(2);
  const forceOverwrite = args.includes('--force');

  let reportType = 'monthly';
  if (args.includes('--type')) {
    const typeIndex = args.indexOf('--type');
    reportType = args[typeIndex + 1];
  }

  try {
    if (reportType === 'monthly') {
      let year = new Date().getFullYear();
      let month = new Date().getMonth(); // 지난달 기본

      if (month === 0) {
        month = 12;
        year -= 1;
      }

      if (args.includes('--year')) {
        const yearIndex = args.indexOf('--year');
        year = parseInt(args[yearIndex + 1]);
      }

      if (args.includes('--month')) {
        const monthIndex = args.indexOf('--month');
        month = parseInt(args[monthIndex + 1]);
      }

      const reportId = await createMonthlyReport(year, month, forceOverwrite);
      if (reportId) {
        console.log(`\n🎉 완료! 리포트 ID: ${reportId}`);
      }
    } else if (reportType === 'weekly') {
      let startDate, endDate;

      if (args.includes('--start')) {
        const startIndex = args.indexOf('--start');
        startDate = args[startIndex + 1];
      }

      if (args.includes('--end')) {
        const endIndex = args.indexOf('--end');
        endDate = args[endIndex + 1];
      }

      if (!startDate) {
        // 기본: 지난주 (월~일)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - daysToLastMonday - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);

        startDate = lastMonday.toISOString().split('T')[0];
        endDate = lastSunday.toISOString().split('T')[0];
      }

      if (!endDate) {
        const end = new Date(startDate);
        end.setDate(end.getDate() + 6);
        endDate = end.toISOString().split('T')[0];
      }

      const reportId = await createWeeklyReport(startDate, endDate, forceOverwrite);
      if (reportId) {
        console.log(`\n🎉 완료! 리포트 ID: ${reportId}`);
      }
    }
  } catch (error) {
    console.error(`\n❌ 오류 발생: ${error.message}`);
    console.error(error.stack);

    await sendTelegram(
      `❌ <b>나라똔 리포트 생성 실패</b>\n\n` +
      `오류: ${error.message}`
    );

    process.exit(1);
  }
}

main();
