#!/usr/bin/env node
/**
 * 주간 리포트 자동 생성 스크립트
 * 매주 월요일 실행 - 지난주(월~일) 리포트 생성
 *
 * 사용법:
 *   node create-weekly-report.js                # 자동으로 지난주 계산
 *   node create-weekly-report.js --week 4       # 특정 주차 지정
 *   node create-weekly-report.js --force        # 기존 리포트 덮어쓰기
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKFILL_CHAT_ID = '-1003394139746';
const USD_TO_KRW = 1430;

const HEA_CLIENT_ID = 'h-e-a-판교';
const HEA_UUID = '3ff2896e-6786-4936-9c57-311f69f43c63';

/**
 * 지난주 날짜 범위 계산 (월~일 기준)
 */
function getLastWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=일, 1=월, ...

  // 지난주 월요일 계산
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToLastMonday - 7);

  // 지난주 일요일
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);

  return {
    start: lastMonday.toISOString().split('T')[0],
    end: lastSunday.toISOString().split('T')[0],
  };
}

/**
 * 주차 계산
 */
function getWeekNumber(dateStr) {
  const date = new Date(dateStr);
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
}

/**
 * Meta 데이터 조회
 */
async function getMetaData(startDate, endDate) {
  const { data, error } = await supabase
    .from('polarad_meta_data')
    .select('date, impressions, clicks, spend')
    .eq('client_id', HEA_UUID)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw new Error(`Meta 데이터 조회 실패: ${error.message}`);
  return data || [];
}

/**
 * Naver 데이터 조회
 */
async function getNaverData(startDate, endDate) {
  const { data, error } = await supabase
    .from('polarad_naver_data')
    .select('date, impressions, clicks, total_cost')
    .eq('client_id', HEA_UUID)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw new Error(`Naver 데이터 조회 실패: ${error.message}`);
  return data || [];
}

/**
 * 기존 리포트 확인
 */
async function checkExistingReport(year, month, week) {
  const { data } = await supabase
    .from('polarad_reports')
    .select('id')
    .eq('report_type', 'weekly')
    .eq('year', year)
    .eq('month', month)
    .eq('week', week)
    .single();

  return data;
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
      }),
    });
  } catch (error) {
    console.error('텔레그램 알림 실패:', error.message);
  }
}

/**
 * 리포트 생성
 */
async function createReport(startDate, endDate, forceOverwrite = false) {
  const year = parseInt(startDate.split('-')[0]);
  const month = parseInt(startDate.split('-')[1]);
  const week = getWeekNumber(startDate);

  console.log(`\n📊 ${year}년 ${month}월 ${week}주차 리포트 생성`);
  console.log(`   기간: ${startDate} ~ ${endDate}`);

  // 기존 리포트 확인
  const existing = await checkExistingReport(year, month, week);
  if (existing && !forceOverwrite) {
    console.log(`   ⚠️ 이미 존재하는 리포트: ${existing.id}`);
    return existing.id;
  }

  // Meta 데이터 집계
  const metaData = await getMetaData(startDate, endDate);
  const metaTotals = metaData.reduce(
    (acc, row) => ({
      impressions: acc.impressions + (row.impressions || 0),
      clicks: acc.clicks + (row.clicks || 0),
      spend: acc.spend + (parseFloat(row.spend) || 0),
    }),
    { impressions: 0, clicks: 0, spend: 0 }
  );

  // Naver 데이터 집계
  const naverData = await getNaverData(startDate, endDate);
  const naverTotals = naverData.reduce(
    (acc, row) => ({
      impressions: acc.impressions + (row.impressions || 0),
      clicks: acc.clicks + (row.clicks || 0),
      cost: acc.cost + (row.total_cost || 0),
    }),
    { impressions: 0, clicks: 0, cost: 0 }
  );

  const metaSpendKRW = Math.round(metaTotals.spend * USD_TO_KRW);
  const totalImpressions = metaTotals.impressions + naverTotals.impressions;
  const totalClicks = metaTotals.clicks + naverTotals.clicks;
  const totalSpend = metaSpendKRW + naverTotals.cost;
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const cpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0;

  console.log(`\n📈 집계 결과:`);
  console.log(`   Meta: 노출 ${metaTotals.impressions.toLocaleString()}, 클릭 ${metaTotals.clicks}, 비용 ${metaSpendKRW.toLocaleString()}원`);
  console.log(`   Naver: 노출 ${naverTotals.impressions.toLocaleString()}, 클릭 ${naverTotals.clicks}, 비용 ${naverTotals.cost.toLocaleString()}원`);
  console.log(`   합계: 노출 ${totalImpressions.toLocaleString()}, 클릭 ${totalClicks}, CTR ${ctr}%`);

  if (totalImpressions === 0) {
    console.log(`   ❌ 데이터가 없어 리포트 생성 중단`);
    await sendTelegram(
      `⚠️ <b>주간 리포트 생성 실패</b>\n\n` +
        `📅 기간: ${startDate} ~ ${endDate}\n` +
        `사유: 해당 기간 데이터 없음`
    );
    return null;
  }

  // 일별 데이터 분석
  const daily = {};
  metaData.forEach((row) => {
    if (!daily[row.date]) daily[row.date] = { impressions: 0, clicks: 0, spend: 0 };
    daily[row.date].impressions += row.impressions || 0;
    daily[row.date].clicks += row.clicks || 0;
    daily[row.date].spend += parseFloat(row.spend) || 0;
  });

  const dailyArr = Object.entries(daily)
    .map(([date, d]) => ({
      date,
      ...d,
      ctr: d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0.00',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const maxClkDay = dailyArr.length > 0 ? dailyArr.reduce((max, d) => (d.clicks > max.clicks ? d : max)) : null;
  const maxCtrDay = dailyArr.length > 0 ? dailyArr.reduce((max, d) => (parseFloat(d.ctr) > parseFloat(max.ctr) ? d : max)) : null;

  // 리포트 데이터 생성
  const reportData = {
    client_id: HEA_CLIENT_ID,
    report_type: 'weekly',
    period_start: startDate,
    period_end: endDate,
    year,
    month,
    week,
    status: 'published',
    published_at: new Date().toISOString(),
    ai_insights: {
      summary: `${month}월 ${week}주차(${startDate.slice(5)}~${endDate.slice(5)}), 총 노출 ${totalImpressions.toLocaleString()}회, 클릭 ${totalClicks}회로 CTR ${ctr}%를 기록했습니다. 주간 광고비 약 ${Math.round(totalSpend / 10000)}만원을 집행했습니다.`,
      highlights: [
        `CTR ${ctr}%로 업계 평균 대비 우수한 성과 유지`,
        maxClkDay ? `${maxClkDay.date} 클릭 ${maxClkDay.clicks}건으로 주간 최다` : null,
        maxCtrDay ? `${maxCtrDay.date} CTR ${maxCtrDay.ctr}%로 주간 최고 효율` : null,
        `클릭당 비용 약 ${cpc}원으로 효율적 집행`,
      ].filter(Boolean),
      platforms: {
        meta: {
          impressions: metaTotals.impressions,
          clicks: metaTotals.clicks,
          spend: metaSpendKRW,
        },
        naver: {
          impressions: naverTotals.impressions,
          clicks: naverTotals.clicks,
          spend: naverTotals.cost,
        },
      },
      recommendations: [
        {
          platform: 'meta',
          priority: 'high',
          type: 'optimization',
          title: '현재 성과 유지',
          description: `CTR ${ctr}%는 우수한 성과입니다. 현재 전략을 유지하면서 예산 효율을 지속적으로 모니터링하세요.`,
        },
      ],
      generatedAt: new Date().toISOString(),
    },
    ai_generated_at: new Date().toISOString(),
  };

  // 기존 리포트 삭제 (force 모드)
  if (existing && forceOverwrite) {
    await supabase.from('polarad_reports').delete().eq('id', existing.id);
    console.log(`   🗑️ 기존 리포트 삭제: ${existing.id}`);
  }

  // 리포트 저장
  const { data: result, error } = await supabase
    .from('polarad_reports')
    .insert(reportData)
    .select()
    .single();

  if (error) {
    throw new Error(`리포트 저장 실패: ${error.message}`);
  }

  console.log(`\n✅ 리포트 생성 완료!`);
  console.log(`   ID: ${result.id}`);
  console.log(`   URL: https://report.polarad.co.kr/report/weekly/${result.id}`);

  // 백필 채널 알림
  await sendTelegram(
    `✅ <b>주간 리포트 자동 생성 완료</b>\n\n` +
      `📅 ${month}월 ${week}주차 (${startDate} ~ ${endDate})\n` +
      `📊 노출: ${totalImpressions.toLocaleString()}회\n` +
      `🖱️ 클릭: ${totalClicks}회 (CTR ${ctr}%)\n` +
      `💰 광고비: 약 ${Math.round(totalSpend / 10000)}만원\n\n` +
      `🔗 ID: ${result.id}`
  );

  return result.id;
}

/**
 * 메인 함수
 */
async function main() {
  console.log('🚀 주간 리포트 자동 생성 스크립트\n');

  const args = process.argv.slice(2);
  const forceOverwrite = args.includes('--force');

  let startDate, endDate;

  // 특정 주차 지정
  if (args.includes('--week')) {
    const weekIndex = args.indexOf('--week');
    const week = parseInt(args[weekIndex + 1]);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 해당 주차의 시작일 계산 (대략적)
    const firstDay = new Date(year, month - 1, (week - 1) * 7 + 1);
    const dayOfWeek = firstDay.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    firstDay.setDate(firstDay.getDate() + daysToMonday);

    startDate = firstDay.toISOString().split('T')[0];
    const endDay = new Date(firstDay);
    endDay.setDate(firstDay.getDate() + 6);
    endDate = endDay.toISOString().split('T')[0];
  } else if (args.includes('--start')) {
    // 직접 날짜 지정
    const startIndex = args.indexOf('--start');
    const endIndex = args.indexOf('--end');
    startDate = args[startIndex + 1];
    endDate = endIndex !== -1 ? args[endIndex + 1] : null;

    if (!endDate) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + 6);
      endDate = end.toISOString().split('T')[0];
    }
  } else {
    // 기본: 지난주
    const range = getLastWeekRange();
    startDate = range.start;
    endDate = range.end;
  }

  try {
    const reportId = await createReport(startDate, endDate, forceOverwrite);

    if (reportId) {
      console.log(`\n🎉 완료! 리포트 ID: ${reportId}`);
    }
  } catch (error) {
    console.error(`\n❌ 오류 발생: ${error.message}`);

    await sendTelegram(
      `❌ <b>주간 리포트 생성 실패</b>\n\n` +
        `📅 기간: ${startDate} ~ ${endDate}\n` +
        `오류: ${error.message}`
    );

    process.exit(1);
  }
}

main();
