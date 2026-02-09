#!/usr/bin/env node
/**
 * BAS(비즈액터스쿨) 주간/월간 리포트 생성 스크립트
 * Airtable에서 광고 데이터를 집계하여 Supabase telegram_reports에 저장
 *
 * 사용법:
 *   node create-bas-report.js --weekly                    # 지난주 주간 리포트
 *   node create-bas-report.js --weekly --start 2026-01-19 # 특정 주 시작일
 *   node create-bas-report.js --monthly --year 2026 --month 1  # 월간 리포트
 *   node create-bas-report.js --backfill --from 2026-01-19 --to 2026-02-08  # 기간 백필
 *   node create-bas-report.js --force                     # 기존 리포트 덮어쓰기
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../dashboard/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY;
const BAS_BASE_ID = process.env.AIRTABLE_BAS_BASE_ID || 'appjo0o2LUEzIqH87';
const BAS_TABLE_ID = process.env.AIRTABLE_BAS_TABLE_ID || 'tblfuy6knQK82AGp4';

// BAS client UUID in Supabase
const BAS_CLIENT_ID = '79e35fc6-a817-4ccc-9d5d-9a93c1ad4515';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKFILL_CHAT_ID = '-1003394139746';

// ─── Airtable 조회 ───────────────────────────────────────────────

async function fetchAirtableRecords(startDate, endDate) {
  const records = [];
  let offset = '';

  const nextDay = new Date(endDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];

  do {
    const formula = encodeURIComponent(
      `AND({date}>='${startDate}', {date}<'${nextDayStr}', {source}='meta')`
    );
    let url = `https://api.airtable.com/v0/${BAS_BASE_ID}/${BAS_TABLE_ID}?filterByFormula=${formula}&pageSize=100`;
    if (offset) url += `&offset=${offset}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(`Airtable 오류: ${JSON.stringify(data.error)}`);
    }
    if (data.records) records.push(...data.records);
    offset = data.offset || '';
  } while (offset);

  return records;
}

// ─── 데이터 집계 ─────────────────────────────────────────────────

function aggregateData(records) {
  // 일별 집계
  const dailyMap = {};
  // 광고별 집계
  const adMap = {};
  // 캠페인별 집계
  const campaignMap = {};

  for (const rec of records) {
    const f = rec.fields;
    const date = f.date;
    const adId = f.ad_id || '';
    const campaignName = f.campaign_name || '';
    const impressions = f.impressions || 0;
    const clicks = f.clicks || 0;
    const spend = parseFloat(f.spend) || 0;
    const leads = f.leads || 0;
    const videoViews = f.video_views || 0;
    const avgWatchTime = parseFloat(f.avg_watch_time) || 0;

    // 일별
    if (!dailyMap[date]) {
      dailyMap[date] = { date, impressions: 0, clicks: 0, spend: 0, leads: 0, videoViews: 0, avgWatchTime: 0 };
    }
    dailyMap[date].impressions += impressions;
    dailyMap[date].clicks += clicks;
    dailyMap[date].spend += spend;
    dailyMap[date].leads += leads;
    dailyMap[date].videoViews += videoViews;

    // 광고별 (ad_id 기준)
    if (adId) {
      if (!adMap[adId]) {
        adMap[adId] = { ad_id: adId, ad_name: '', impressions: 0, clicks: 0, spend: 0, leads: 0 };
      }
      adMap[adId].impressions += impressions;
      adMap[adId].clicks += clicks;
      adMap[adId].spend += spend;
      adMap[adId].leads += leads;
      // ad_name: campaign_name에서 "광고명 (캠페인명)" 형식에서 광고명 추출
      if (!adMap[adId].ad_name && campaignName) {
        const match = campaignName.match(/^(.+?)\s*\(/);
        adMap[adId].ad_name = match ? match[1].trim() : campaignName;
      }
    }

    // 캠페인별
    // campaign_name: "광고명 (캠페인명)" → 캠페인명 추출
    const campMatch = campaignName.match(/\((.+?)\)$/);
    const campName = campMatch ? campMatch[1] : campaignName;
    if (campName) {
      if (!campaignMap[campName]) {
        campaignMap[campName] = { campaign_name: campName, impressions: 0, clicks: 0, spend: 0, leads: 0 };
      }
      campaignMap[campName].impressions += impressions;
      campaignMap[campName].clicks += clicks;
      campaignMap[campName].spend += spend;
      campaignMap[campName].leads += leads;
    }
  }

  const dailyStats = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  const totalImpressions = dailyStats.reduce((s, d) => s + d.impressions, 0);
  const totalClicks = dailyStats.reduce((s, d) => s + d.clicks, 0);
  const totalSpend = dailyStats.reduce((s, d) => s + d.spend, 0);
  const totalLeads = dailyStats.reduce((s, d) => s + d.leads, 0);

  // 일별에 CPL 추가
  for (const d of dailyStats) {
    d.cpl = d.leads > 0 ? Math.round((d.spend / d.leads) * 100) / 100 : null;
  }

  // 광고별 정리
  const adPerformance = Object.values(adMap)
    .map(ad => ({
      ...ad,
      spend: Math.round(ad.spend * 100) / 100,
      cpl: ad.leads > 0 ? Math.round((ad.spend / ad.leads) * 100) / 100 : null,
      ctr: ad.impressions > 0 ? Math.round((ad.clicks / ad.impressions) * 10000) / 100 : 0,
      lead_percent: totalLeads > 0 ? Math.round((ad.leads / totalLeads) * 1000) / 10 : 0,
      spend_percent: totalSpend > 0 ? Math.round((ad.spend / totalSpend) * 1000) / 10 : 0,
    }))
    .sort((a, b) => (b.leads || 0) - (a.leads || 0));

  // 캠페인별 정리
  const campaignPerformance = Object.values(campaignMap)
    .map(c => ({
      ...c,
      spend: Math.round(c.spend * 100) / 100,
      cpl: c.leads > 0 ? Math.round((c.spend / c.leads) * 100) / 100 : null,
      lead_percent: totalLeads > 0 ? Math.round((c.leads / totalLeads) * 1000) / 10 : 0,
      spend_percent: totalSpend > 0 ? Math.round((c.spend / totalSpend) * 1000) / 10 : 0,
    }))
    .sort((a, b) => (b.leads || 0) - (a.leads || 0));

  const summary = {
    impressions: totalImpressions,
    clicks: totalClicks,
    spend: Math.round(totalSpend * 100) / 100,
    leads: totalLeads,
    cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : 0,
    ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
    conversion_rate: totalClicks > 0 ? Math.round((totalLeads / totalClicks) * 10000) / 100 : 0,
  };

  return { summary, dailyStats, adPerformance, campaignPerformance };
}

// ─── 변화율 계산 ─────────────────────────────────────────────────

function calcChange(current, previous) {
  if (!previous || previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ─── 리포트 저장 ─────────────────────────────────────────────────

async function saveReport(reportType, weekStart, weekEnd, data, prevData, force) {
  // 기존 리포트 확인
  const { data: existing } = await supabase
    .from('telegram_reports')
    .select('id')
    .eq('client_id', BAS_CLIENT_ID)
    .eq('report_type', reportType)
    .eq('week_start', weekStart)
    .eq('week_end', weekEnd)
    .maybeSingle();

  if (existing && !force) {
    console.log(`   ⚠️ 이미 존재: ${existing.id} (--force로 덮어쓰기)`);
    return existing.id;
  }

  if (existing && force) {
    await supabase.from('telegram_reports').delete().eq('id', existing.id);
    console.log(`   🗑️ 기존 삭제: ${existing.id}`);
  }

  const spendChange = prevData ? calcChange(data.summary.spend, prevData.summary.spend) : 0;
  const leadsChange = prevData ? calcChange(data.summary.leads, prevData.summary.leads) : 0;
  const cplChange = prevData ? calcChange(data.summary.cpl, prevData.summary.cpl) : 0;
  const ctrChange = prevData ? calcChange(data.summary.ctr, prevData.summary.ctr) : 0;

  const typeLabel = reportType === 'monthly' ? '월간' : '주간';
  const messageText = `📊 BAS ${typeLabel} 리포트 (${weekStart} ~ ${weekEnd})\n` +
    `지출: $${data.summary.spend.toLocaleString()} | 리드: ${data.summary.leads}건 | CPL: $${data.summary.cpl}`;

  const record = {
    client_id: BAS_CLIENT_ID,
    report_type: reportType,
    week_start: weekStart,
    week_end: weekEnd,
    message_text: messageText,
    total_spend: data.summary.spend,
    total_leads: data.summary.leads,
    total_impressions: data.summary.impressions,
    total_clicks: data.summary.clicks,
    avg_cpl: data.summary.cpl,
    avg_ctr: data.summary.ctr,
    spend_change: spendChange,
    leads_change: leadsChange,
    cpl_change: cplChange,
    ctr_change: ctrChange,
    ai_insights: null,
    report_data: {
      summary: data.summary,
      comparison: prevData ? {
        prev_cpl: prevData.summary.cpl,
        prev_ctr: prevData.summary.ctr,
        prev_leads: prevData.summary.leads,
        prev_spend: prevData.summary.spend,
        prev_clicks: prevData.summary.clicks,
        prev_impressions: prevData.summary.impressions,
      } : null,
      daily_stats: data.dailyStats,
      ad_performance: data.adPerformance,
      campaign_performance: data.campaignPerformance,
    },
    sent_at: new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('telegram_reports')
    .insert(record)
    .select('id')
    .single();

  if (error) {
    throw new Error(`저장 실패: ${error.message}`);
  }

  return result.id;
}

// ─── 주간 리포트 생성 ────────────────────────────────────────────

async function createWeeklyReport(startDate, force) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const endDateStr = endDate.toISOString().split('T')[0];

  console.log(`\n📊 주간 리포트: ${startDate} ~ ${endDateStr}`);

  // 현재 주 데이터
  const records = await fetchAirtableRecords(startDate, endDateStr);
  if (records.length === 0) {
    console.log('   ⚠️ 데이터 없음 - 스킵');
    return null;
  }

  const data = aggregateData(records);
  console.log(`   리드: ${data.summary.leads}, 지출: $${data.summary.spend}, CPL: $${data.summary.cpl}`);

  // 이전 주 데이터 (변화율 계산용)
  const prevStart = new Date(startDate);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevRecords = await fetchAirtableRecords(
    prevStart.toISOString().split('T')[0],
    prevEnd.toISOString().split('T')[0]
  );
  const prevData = prevRecords.length > 0 ? aggregateData(prevRecords) : null;

  const id = await saveReport('weekly', startDate, endDateStr, data, prevData, force);
  console.log(`   ✅ 저장: ${id}`);
  return id;
}

// ─── 월간 리포트 생성 ────────────────────────────────────────────

async function createMonthlyReport(year, month, force) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0); // 해당 월 마지막 날
  const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  console.log(`\n📊 월간 리포트: ${startDate} ~ ${endDateStr}`);

  const records = await fetchAirtableRecords(startDate, endDateStr);
  if (records.length === 0) {
    console.log('   ⚠️ 데이터 없음 - 스킵');
    return null;
  }

  const data = aggregateData(records);
  console.log(`   리드: ${data.summary.leads}, 지출: $${data.summary.spend}, CPL: $${data.summary.cpl}`);

  // 이전 달 데이터
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const prevEndDate = new Date(prevYear, prevMonth, 0);
  const prevEnd = `${prevEndDate.getFullYear()}-${String(prevEndDate.getMonth() + 1).padStart(2, '0')}-${String(prevEndDate.getDate()).padStart(2, '0')}`;
  const prevRecords = await fetchAirtableRecords(prevStart, prevEnd);
  const prevData = prevRecords.length > 0 ? aggregateData(prevRecords) : null;

  const id = await saveReport('monthly', startDate, endDateStr, data, prevData, force);
  console.log(`   ✅ 저장: ${id}`);
  return id;
}

// ─── 텔레그램 알림 ───────────────────────────────────────────────

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: BACKFILL_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (e) {
    console.error('텔레그램 알림 실패:', e.message);
  }
}

// ─── 메인 함수 ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  if (args.includes('--backfill')) {
    // 기간 백필 모드: 주간 리포트를 월요일 기준으로 생성
    const fromIdx = args.indexOf('--from');
    const toIdx = args.indexOf('--to');
    if (fromIdx === -1 || toIdx === -1) {
      console.error('❌ --backfill 모드는 --from, --to 필수');
      return;
    }

    const fromDate = new Date(args[fromIdx + 1]);
    const toDate = new Date(args[toIdx + 1]);

    console.log(`🔄 BAS 리포트 백필: ${args[fromIdx + 1]} ~ ${args[toIdx + 1]}`);

    // 월요일 기준으로 주간 리포트 생성
    let current = new Date(fromDate);
    // 가장 가까운 월요일로 이동
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 1) {
      const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      current.setDate(current.getDate() + (dayOfWeek === 1 ? 0 : daysToMonday - 7));
      if (current < fromDate) current.setDate(current.getDate() + 7);
    }

    const created = [];
    while (current <= toDate) {
      const startStr = current.toISOString().split('T')[0];
      const id = await createWeeklyReport(startStr, force);
      if (id) created.push(startStr);
      current.setDate(current.getDate() + 7);
    }

    // 해당 기간의 월간 리포트도 생성
    const months = new Set();
    let d = new Date(fromDate);
    while (d <= toDate) {
      months.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
      d.setMonth(d.getMonth() + 1);
    }

    for (const ym of months) {
      const [y, m] = ym.split('-').map(Number);
      const id = await createMonthlyReport(y, m, force);
      if (id) created.push(`${y}년 ${m}월`);
    }

    console.log(`\n🎉 백필 완료: ${created.length}건`);
    await sendTelegram(
      `✅ <b>BAS 리포트 백필 완료</b>\n\n` +
      `📅 기간: ${args[fromIdx + 1]} ~ ${args[toIdx + 1]}\n` +
      `📊 생성: ${created.length}건`
    );

  } else if (args.includes('--monthly')) {
    const yearIdx = args.indexOf('--year');
    const monthIdx = args.indexOf('--month');
    const year = yearIdx !== -1 ? parseInt(args[yearIdx + 1]) : new Date().getFullYear();
    const month = monthIdx !== -1 ? parseInt(args[monthIdx + 1]) : new Date().getMonth() + 1;
    await createMonthlyReport(year, month, force);

  } else if (args.includes('--weekly')) {
    const startIdx = args.indexOf('--start');
    let startDate;
    if (startIdx !== -1) {
      startDate = args[startIdx + 1];
    } else {
      // 지난주 월요일
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - daysToLastMonday - 7);
      startDate = lastMonday.toISOString().split('T')[0];
    }
    await createWeeklyReport(startDate, force);

  } else {
    console.log(`
BAS 리포트 생성 스크립트

사용법:
  node create-bas-report.js --weekly                         # 지난주 주간
  node create-bas-report.js --weekly --start 2026-01-19      # 특정 주
  node create-bas-report.js --monthly --year 2026 --month 1  # 월간
  node create-bas-report.js --backfill --from 2026-01-19 --to 2026-02-08  # 백필
  --force 추가 시 기존 리포트 덮어쓰기
`);
  }
}

main().catch(e => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
