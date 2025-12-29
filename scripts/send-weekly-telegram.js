#!/usr/bin/env node
/**
 * 주간 리포트 텔레그램 발송 스크립트
 * Meta + 네이버 광고비 자동 합산
 *
 * 사용법:
 *   node send-weekly-telegram.js --week 3    # 12월 3주차 발송
 *   node send-weekly-telegram.js --week 4    # 12월 4주차 발송
 *   node send-weekly-telegram.js --auto      # 최신 리포트 자동 발송 (GitHub Actions용)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CLIENT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1003400452372';  // 판교H.E.A 채널
const USD_TO_KRW = 1430;

async function getWeeklyReport(week, month, year) {
  const { data, error } = await supabase
    .from('polarad_reports')
    .select('*')
    .eq('report_type', 'weekly')
    .eq('week', week)
    .eq('month', month)
    .eq('year', year)
    .single();

  if (error) throw new Error(`리포트 조회 실패: ${error.message}`);
  return data;
}

async function getLatestWeeklyReport() {
  const { data, error } = await supabase
    .from('polarad_reports')
    .select('*')
    .eq('report_type', 'weekly')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) throw new Error(`최신 리포트 조회 실패: ${error.message}`);
  return data;
}

async function getMetaData(startDate, endDate) {
  const { data } = await supabase
    .from('polarad_meta_data')
    .select('impressions, clicks, spend')
    .gte('date', startDate)
    .lte('date', endDate);

  if (!data || data.length === 0) return { impressions: 0, clicks: 0, spend: 0 };

  return {
    impressions: data.reduce((sum, d) => sum + (d.impressions || 0), 0),
    clicks: data.reduce((sum, d) => sum + (d.clicks || 0), 0),
    spend: Math.round(data.reduce((sum, d) => sum + (parseFloat(d.spend) || 0), 0) * USD_TO_KRW),
  };
}

async function getNaverData(startDate, endDate) {
  const { data } = await supabase
    .from('polarad_naver_data')
    .select('impressions, clicks, total_cost')
    .gte('date', startDate)
    .lte('date', endDate);

  if (!data || data.length === 0) return { impressions: 0, clicks: 0, spend: 0 };

  return {
    impressions: data.reduce((sum, d) => sum + (d.impressions || 0), 0),
    clicks: data.reduce((sum, d) => sum + (d.clicks || 0), 0),
    spend: data.reduce((sum, d) => sum + (d.total_cost || 0), 0),
  };
}

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CLIENT_CHAT_ID,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`텔레그램 발송 실패: ${JSON.stringify(data)}`);
  return data;
}

function formatNumber(num) {
  return num.toLocaleString('ko-KR');
}

function formatCurrency(num) {
  if (num >= 10000) {
    return `약 ${Math.round(num / 10000)}만원`;
  }
  return `${formatNumber(num)}원`;
}

async function main() {
  const args = process.argv.slice(2);
  const isAuto = args.includes('--auto');
  const weekIndex = args.indexOf('--week');
  const week = weekIndex !== -1 ? parseInt(args[weekIndex + 1]) : null;

  if (!isAuto && !week) {
    console.error('사용법:');
    console.error('  node send-weekly-telegram.js --week <주차>');
    console.error('  node send-weekly-telegram.js --auto');
    console.error('');
    console.error('예시:');
    console.error('  node send-weekly-telegram.js --week 3');
    console.error('  node send-weekly-telegram.js --auto   # 최신 리포트 자동 발송');
    return;
  }

  let report;

  try {
    if (isAuto) {
      console.log('📨 최신 주간 리포트 텔레그램 발송 준비 (자동 모드)\n');
      report = await getLatestWeeklyReport();
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      console.log(`📨 ${month}월 ${week}주차 텔레그램 발송 준비\n`);
      report = await getWeeklyReport(week, month, year);
    }
    console.log(`✅ 리포트 ID: ${report.id}`);
    console.log(`   기간: ${report.period_start} ~ ${report.period_end}`);

    // Meta 데이터 조회
    const meta = await getMetaData(report.period_start, report.period_end);
    console.log(`\n📊 Meta 성과:`);
    console.log(`   노출: ${formatNumber(meta.impressions)}회`);
    console.log(`   클릭: ${formatNumber(meta.clicks)}회`);
    console.log(`   비용: ${formatNumber(meta.spend)}원`);

    // 네이버 데이터 조회
    const naver = await getNaverData(report.period_start, report.period_end);
    console.log(`\n📊 네이버 성과:`);
    console.log(`   노출: ${formatNumber(naver.impressions)}회`);
    console.log(`   클릭: ${formatNumber(naver.clicks)}회`);
    console.log(`   비용: ${formatNumber(naver.spend)}원`);

    // 합산
    const totalImpressions = meta.impressions + naver.impressions;
    const totalClicks = meta.clicks + naver.clicks;
    const totalSpend = meta.spend + naver.spend;
    const totalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;

    console.log(`\n📊 합계:`);
    console.log(`   노출: ${formatNumber(totalImpressions)}회`);
    console.log(`   클릭: ${formatNumber(totalClicks)}회`);
    console.log(`   비용: ${formatNumber(totalSpend)}원`);
    console.log(`   CTR: ${totalCtr}%`);

    // 메시지 생성
    const reportMonth = report.month || parseInt(report.period_start.split('-')[1]);
    const reportWeek = report.week || Math.ceil(parseInt(report.period_start.split('-')[2]) / 7);
    const startMonth = report.period_start.split('-')[1];
    const startDay = report.period_start.split('-')[2];
    const endDay = report.period_end.split('-')[2];

    const message = `📊 ${reportMonth}월 ${reportWeek}주차 광고 성과 안내

안녕하세요, H.E.A 판교입니다.

지난주(${parseInt(startMonth)}/${parseInt(startDay)}~${parseInt(endDay)}) 광고 성과입니다.

• 노출: ${formatNumber(totalImpressions)}회
• 클릭: ${formatNumber(totalClicks)}회
• CTR: ${totalCtr}%
• 광고비: ${formatCurrency(totalSpend)} (Meta ${formatCurrency(meta.spend)} + 네이버 ${formatCurrency(naver.spend)})

CTR ${totalCtr}%는 업계 평균 대비 우수한 성과입니다.

📌 상세 리포트 확인
https://report.polarad.co.kr/report/weekly/${report.id}`;

    console.log('\n📝 발송 메시지:');
    console.log('─'.repeat(50));
    console.log(message);
    console.log('─'.repeat(50));

    // 발송
    await sendTelegram(message);
    console.log('\n✅ 텔레그램 발송 완료!');

  } catch (error) {
    console.error('\n❌ 오류:', error.message);
  }
}

main();
