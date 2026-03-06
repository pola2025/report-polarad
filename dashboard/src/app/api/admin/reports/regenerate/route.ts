/**
 * 리포트 AI 인사이트 재생성 API
 * POST /api/admin/reports/regenerate
 *
 * Body: { year: number, month: number, client_id?: string }
 * - 해당 year/month의 모든 리포트를 찾아서 AI 인사이트를 재생성
 * - 네이버 데이터 포함하여 최신 Airtable 데이터 기반으로 업데이트
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchAirtableData,
  getReports,
  updateReport,
  type AirtableAdRecord,
} from "@/lib/airtable";
import { isAdminRequest } from "@/lib/admin-auth";

export const maxDuration = 120;

// ─── Aggregate (HEA - Meta + Naver) ──────────────────────────

function aggregateHEA(records: AirtableAdRecord[]) {
  const metaRecords = records.filter((r) => r.source === "meta");
  const naverRecords = records.filter((r) => r.source !== "meta");

  const metaTotals = {
    impressions: metaRecords.reduce((s, r) => s + r.impressions, 0),
    clicks: metaRecords.reduce((s, r) => s + r.clicks, 0),
    spend: metaRecords.reduce((s, r) => s + r.spend, 0),
    videoViews: metaRecords.reduce((s, r) => s + (r.video_views || 0), 0),
    avgWatchTime:
      metaRecords.length > 0
        ? metaRecords.reduce((s, r) => s + (r.avg_watch_time || 0), 0) /
            metaRecords.filter((r) => r.avg_watch_time).length || 0
        : 0,
  };

  const naverTotals = {
    impressions: naverRecords.reduce((s, r) => s + r.impressions, 0),
    clicks: naverRecords.reduce((s, r) => s + r.clicks, 0),
    cost: naverRecords.reduce((s, r) => s + r.spend, 0),
  };

  const keywordStats: Record<
    string,
    { impressions: number; clicks: number; cost: number }
  > = {};
  naverRecords.forEach((r) => {
    const kw = r.keywords || r.campaign_name || "unknown";
    if (!keywordStats[kw])
      keywordStats[kw] = { impressions: 0, clicks: 0, cost: 0 };
    keywordStats[kw].impressions += r.impressions;
    keywordStats[kw].clicks += r.clicks;
    keywordStats[kw].cost += r.spend;
  });

  const topKeywords = Object.entries(keywordStats)
    .map(([keyword, stats]) => ({ keyword, ...stats }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);

  const totalImpressions = metaTotals.impressions + naverTotals.impressions;
  const totalClicks = metaTotals.clicks + naverTotals.clicks;
  const totalSpend = metaTotals.spend + naverTotals.cost;
  const ctr =
    totalImpressions > 0
      ? ((totalClicks / totalImpressions) * 100).toFixed(2)
      : "0.00";
  const cpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0;

  const dailyMap: Record<
    string,
    { impressions: number; clicks: number; spend: number }
  > = {};
  metaRecords.forEach((r) => {
    if (!dailyMap[r.date])
      dailyMap[r.date] = { impressions: 0, clicks: 0, spend: 0 };
    dailyMap[r.date].impressions += r.impressions;
    dailyMap[r.date].clicks += r.clicks;
    dailyMap[r.date].spend += r.spend;
  });

  const dailyStats = Object.entries(dailyMap)
    .map(([date, d]) => ({
      date,
      ...d,
      ctr:
        d.impressions > 0
          ? ((d.clicks / d.impressions) * 100).toFixed(2)
          : "0.00",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    metaTotals,
    naverTotals,
    totalImpressions,
    totalClicks,
    totalSpend,
    ctr,
    cpc,
    dailyStats,
    topKeywords,
  };
}

// ─── Aggregate (Naratton - Meta only) ────────────────────────

function aggregateNaratton(records: AirtableAdRecord[]) {
  const metaRecords = records.filter((r) => r.source === "meta");

  const totalImpressions = metaRecords.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = metaRecords.reduce((s, r) => s + r.clicks, 0);
  const totalSpend = metaRecords.reduce((s, r) => s + r.spend, 0);
  const totalLeads = metaRecords.reduce((s, r) => s + (r.leads || 0), 0);

  const campaignMap: Record<
    string,
    {
      campaign_name: string;
      impressions: number;
      clicks: number;
      spend: number;
      leads: number;
    }
  > = {};
  metaRecords.forEach((r) => {
    const name = r.campaign_name || "unknown";
    if (!campaignMap[name])
      campaignMap[name] = {
        campaign_name: name,
        impressions: 0,
        clicks: 0,
        spend: 0,
        leads: 0,
      };
    campaignMap[name].impressions += r.impressions;
    campaignMap[name].clicks += r.clicks;
    campaignMap[name].spend += r.spend;
    campaignMap[name].leads += r.leads || 0;
  });

  const campaignPerformance = Object.values(campaignMap)
    .map((c) => ({
      ...c,
      cpl: c.leads > 0 ? Math.round(c.spend / c.leads) : null,
      ctr:
        c.impressions > 0
          ? Math.round((c.clicks / c.impressions) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => (b.leads || 0) - (a.leads || 0));

  const dailyMap: Record<
    string,
    { impressions: number; clicks: number; spend: number; leads: number }
  > = {};
  metaRecords.forEach((r) => {
    if (!dailyMap[r.date])
      dailyMap[r.date] = { impressions: 0, clicks: 0, spend: 0, leads: 0 };
    dailyMap[r.date].impressions += r.impressions;
    dailyMap[r.date].clicks += r.clicks;
    dailyMap[r.date].spend += r.spend;
    dailyMap[r.date].leads += r.leads || 0;
  });

  const dailyStats = Object.entries(dailyMap)
    .map(([date, d]) => ({
      date,
      ...d,
      ctr:
        d.impressions > 0
          ? ((d.clicks / d.impressions) * 100).toFixed(2)
          : "0.00",
      cpl: d.leads > 0 ? Math.round(d.spend / d.leads) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const ctr =
    totalImpressions > 0
      ? ((totalClicks / totalImpressions) * 100).toFixed(2)
      : "0.00";
  const cpl = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0;
  const cpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0;

  return {
    totalImpressions,
    totalClicks,
    totalSpend,
    totalLeads,
    ctr,
    cpl,
    cpc,
    dailyStats,
    campaignPerformance,
  };
}

// ─── Helpers ─────────────────────────────────────────────────

function calcChange(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function getClientSlug(clientId: string): string | null {
  if (clientId === "h-e-a-\uD310\uAD50") return "hea-pangyo";
  if (clientId === "\uB098\uB77C\uB618") return "naratton";
  return null;
}

function getPrevPeriod(
  periodStart: string,
  periodEnd: string,
  reportType: string,
) {
  if (reportType === "weekly") {
    const d = new Date(periodStart);
    d.setDate(d.getDate() - 7);
    const prevEnd = new Date(periodStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    return {
      start: d.toISOString().split("T")[0],
      end: prevEnd.toISOString().split("T")[0],
    };
  }
  const year = parseInt(periodStart.split("-")[0]);
  const month = parseInt(periodStart.split("-")[1]);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const endDate = new Date(prevYear, prevMonth, 0);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end };
}

// ─── AI (Gemini) ─────────────────────────────────────────────

async function generateHEAInsight(
  reportType: string,
  startDate: string,
  endDate: string,
  data: ReturnType<typeof aggregateHEA>,
  prevData: ReturnType<typeof aggregateHEA> | null,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const typeLabel = reportType === "monthly" ? "월간" : "주간";
  const dailyLines = data.dailyStats
    .map(
      (d) =>
        `  ${d.date}: 노출 ${d.impressions.toLocaleString()}, 클릭 ${d.clicks}, 비용 ${d.spend.toLocaleString()}원, CTR ${d.ctr}%`,
    )
    .join("\n");
  const naverLines = data.topKeywords
    .map(
      (k) =>
        `  ${k.keyword}: 노출 ${k.impressions.toLocaleString()}, 클릭 ${k.clicks}, 비용 ${k.cost.toLocaleString()}원`,
    )
    .join("\n");

  let comparisonText = "";
  if (prevData) {
    const impChange = calcChange(
      data.totalImpressions,
      prevData.totalImpressions,
    );
    const clkChange = calcChange(data.totalClicks, prevData.totalClicks);
    const spendChange = calcChange(data.totalSpend, prevData.totalSpend);
    comparisonText = `\n## 이전 기간 비교\n- 노출: ${impChange > 0 ? "+" : ""}${impChange}%, 클릭: ${clkChange > 0 ? "+" : ""}${clkChange}%, 비용: ${spendChange > 0 ? "+" : ""}${spendChange}%`;
  }

  const prompt = `당신은 Meta/Naver 광고 성과 분석 전문가입니다. H.E.A 판교(식당, 트래픽 캠페인) ${typeLabel} 리포트 데이터를 분석해주세요.

## 리포트 정보
- 고객사: H.E.A 판교 (식당, 트래픽 목적)
- 기간: ${startDate} ~ ${endDate}
- 주요 지표: 노출, 클릭, CTR, CPC, 영상조회수 (리드 아님!)

## 종합 성과
- Meta: 노출 ${data.metaTotals.impressions.toLocaleString()}회, 클릭 ${data.metaTotals.clicks}회, 비용 ${data.metaTotals.spend.toLocaleString()}원
- 영상 조회수: ${data.metaTotals.videoViews.toLocaleString()}회
- Naver: 노출 ${data.naverTotals.impressions.toLocaleString()}회, 클릭 ${data.naverTotals.clicks}회, 비용 ${data.naverTotals.cost.toLocaleString()}원
- 합계: 노출 ${data.totalImpressions.toLocaleString()}회, 클릭 ${data.totalClicks}회, CTR ${data.ctr}%, CPC ${data.cpc.toLocaleString()}원
${comparisonText}

## 일별 Meta 성과
${dailyLines || "(없음)"}

## Naver 상위 키워드
${naverLines || "(없음)"}

---
마크다운 텍스트로 분석하세요 (JSON 아닌 순수 텍스트):

### 📊 성과 종합 분석
(3~4문장 요약, 이전 기간 대비 변화 포함)

### 💡 핵심 인사이트
(번호 리스트 5~6개, 구체적 수치 포함)

### 🎯 즉시 실행 가능한 액션
(번호 리스트 2~3개, 제목 + 설명)

모든 금액은 원(₩). 구체적 수치 필수. 리드 관련 분석 금지 (이 클라이언트는 트래픽 캠페인).`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );
    const result = await res.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

async function generateNarattonInsight(
  reportType: string,
  startDate: string,
  endDate: string,
  data: ReturnType<typeof aggregateNaratton>,
  prevData: ReturnType<typeof aggregateNaratton> | null,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const typeLabel = reportType === "monthly" ? "월간" : "주간";
  const dailyLines = data.dailyStats
    .map(
      (d) =>
        `  ${d.date}: 노출 ${d.impressions.toLocaleString()}, 클릭 ${d.clicks}, 리드 ${d.leads}, 비용 ${d.spend.toLocaleString()}원, CPL ${d.cpl ? d.cpl.toLocaleString() + "원" : "N/A"}`,
    )
    .join("\n");
  const campaignLines = data.campaignPerformance
    .slice(0, 10)
    .map(
      (c) =>
        `  ${c.campaign_name}: 리드 ${c.leads}, 비용 ${c.spend.toLocaleString()}원, CPL ${c.cpl ? c.cpl.toLocaleString() + "원" : "N/A"}, CTR ${c.ctr}%`,
    )
    .join("\n");

  let comparisonText = "";
  if (prevData) {
    const impChange = calcChange(
      data.totalImpressions,
      prevData.totalImpressions,
    );
    const leadChange = calcChange(data.totalLeads, prevData.totalLeads);
    const spendChange = calcChange(data.totalSpend, prevData.totalSpend);
    const cplChange = calcChange(data.cpl, prevData.cpl);
    comparisonText = `\n## 이전 기간 비교\n- 노출: ${impChange > 0 ? "+" : ""}${impChange}%, 리드: ${leadChange > 0 ? "+" : ""}${leadChange}%, 비용: ${spendChange > 0 ? "+" : ""}${spendChange}%, CPL: ${cplChange > 0 ? "+" : ""}${cplChange}%`;
  }

  const prompt = `당신은 Meta 광고 성과 분석 전문가입니다. 나라똔(쇼핑몰, 리드 수집 캠페인) ${typeLabel} 리포트 데이터를 분석해주세요.

## 리포트 정보
- 고객사: 나라똔 (쇼핑몰, 리드 수집형)
- 기간: ${startDate} ~ ${endDate}
- 주요 지표: 리드(leads), CPL(리드당비용), 노출, 클릭, CTR

## 종합 성과
- 노출: ${data.totalImpressions.toLocaleString()}회, 클릭: ${data.totalClicks.toLocaleString()}회
- 리드: ${data.totalLeads}건, 비용: ${data.totalSpend.toLocaleString()}원
- CPL: ${data.cpl.toLocaleString()}원, CTR: ${data.ctr}%, CPC: ${data.cpc.toLocaleString()}원
${comparisonText}

## 일별 성과
${dailyLines || "(없음)"}

## 캠페인별 성과
${campaignLines || "(없음)"}

---
마크다운 텍스트로 분석하세요 (JSON 아닌 순수 텍스트):

### 📊 성과 종합 분석
(3~4문장 요약, 이전 기간 대비 변화 포함)

### 💡 핵심 인사이트
(번호 리스트 5~6개, 구체적 수치 포함)

### 🎯 즉시 실행 가능한 액션
(번호 리스트 2~3개, 제목 + 설명)

모든 금액은 원(₩). 구체적 수치 필수.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );
    const result = await res.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { year, month, client_id, client_slug } = body;

    if (!year || !month) {
      return NextResponse.json(
        { error: "year and month are required" },
        { status: 400 },
      );
    }

    // slug → client_id 변환
    let resolvedClientId = client_id;
    if (!resolvedClientId && client_slug) {
      const slugMap: Record<string, string> = {
        "hea-pangyo": "h-e-a-\uD310\uAD50",
        naratton: "\uB098\uB77C\uB618",
      };
      resolvedClientId = slugMap[client_slug];
    }

    // 1. Find reports for this period
    const reports = await getReports({
      year,
      month,
      clientId: resolvedClientId || undefined,
    });

    if (reports.length === 0) {
      return NextResponse.json(
        { error: "No reports found", year, month },
        { status: 404 },
      );
    }

    console.log(
      `Found ${reports.length} reports for ${year}-${String(month).padStart(2, "0")}`,
    );

    const results = [];

    for (const report of reports) {
      const clientSlug = getClientSlug(report.client_id);
      if (!clientSlug) {
        results.push({
          id: report.id,
          client_id: report.client_id,
          action: "skipped",
          reason: "unknown client",
        });
        continue;
      }

      // 2. Fetch fresh data from Airtable
      const records = await fetchAirtableData(
        clientSlug,
        report.period_start,
        report.period_end,
      );
      if (records.length === 0) {
        results.push({
          id: report.id,
          client_id: report.client_id,
          action: "skipped",
          reason: "no data",
        });
        continue;
      }

      // 3. Get previous period data
      const prev = getPrevPeriod(
        report.period_start,
        report.period_end,
        report.report_type,
      );
      const prevRecords = await fetchAirtableData(
        clientSlug,
        prev.start,
        prev.end,
      );

      // 4. Aggregate & generate AI
      let aiInsights: Record<string, unknown>;

      if (report.client_id === "h-e-a-\uD310\uAD50") {
        const data = aggregateHEA(records);
        const prevData =
          prevRecords.length > 0 ? aggregateHEA(prevRecords) : null;
        const aiText = await generateHEAInsight(
          report.report_type,
          report.period_start,
          report.period_end,
          data,
          prevData,
        );

        const impChange = prevData
          ? calcChange(data.totalImpressions, prevData.totalImpressions)
          : 0;
        const clkChange = prevData
          ? calcChange(data.totalClicks, prevData.totalClicks)
          : 0;
        const spendChange = prevData
          ? calcChange(data.totalSpend, prevData.totalSpend)
          : 0;
        const week = report.week;
        const periodLabel =
          report.report_type === "monthly"
            ? `${month}월`
            : `${month}월 ${week}주차(${report.period_start.slice(5)}~${report.period_end.slice(5)})`;

        const maxClkDay =
          data.dailyStats.length > 0
            ? data.dailyStats.reduce((max, d) =>
                d.clicks > max.clicks ? d : max,
              )
            : null;
        const maxCtrDay =
          data.dailyStats.length > 0
            ? data.dailyStats.reduce((max, d) =>
                parseFloat(d.ctr) > parseFloat(max.ctr) ? d : max,
              )
            : null;

        aiInsights = {
          summary: aiText
            ? `AI 생성 인사이트 포함. ${periodLabel}, 총 노출 ${data.totalImpressions.toLocaleString()}회, 클릭 ${data.totalClicks.toLocaleString()}회, CTR ${data.ctr}%.`
            : `${periodLabel}, 총 노출 ${data.totalImpressions.toLocaleString()}회, 클릭 ${data.totalClicks.toLocaleString()}회로 CTR ${data.ctr}%를 기록했습니다.`,
          aiGeneratedText: aiText || null,
          highlights: [
            `CTR ${data.ctr}%로 업계 평균 대비 ${parseFloat(data.ctr) >= 2 ? "우수한" : "양호한"} 성과`,
            maxClkDay
              ? `${maxClkDay.date} 클릭 ${maxClkDay.clicks}건으로 기간 내 최다`
              : null,
            maxCtrDay
              ? `${maxCtrDay.date} CTR ${maxCtrDay.ctr}%로 기간 내 최고 효율`
              : null,
            data.metaTotals.videoViews > 0
              ? `영상 조회수 ${data.metaTotals.videoViews.toLocaleString()}회`
              : null,
            `클릭당 비용 약 ${data.cpc.toLocaleString()}원으로 효율적 집행`,
          ].filter((v): v is string => v !== null),
          platforms: {
            meta: {
              impressions: data.metaTotals.impressions,
              clicks: data.metaTotals.clicks,
              spend: data.metaTotals.spend,
              videoViews: data.metaTotals.videoViews,
            },
            naver: {
              impressions: data.naverTotals.impressions,
              clicks: data.naverTotals.clicks,
              spend: data.naverTotals.cost,
              topKeywords: data.topKeywords,
            },
          },
          comparison: prevData
            ? {
                impressions: {
                  current: data.totalImpressions,
                  previous: prevData.totalImpressions,
                  change: impChange,
                },
                clicks: {
                  current: data.totalClicks,
                  previous: prevData.totalClicks,
                  change: clkChange,
                },
                spend: {
                  current: data.totalSpend,
                  previous: prevData.totalSpend,
                  change: spendChange,
                },
              }
            : null,
          recommendations: [
            {
              type: "budget",
              platform: "meta",
              priority: "high",
              title: "현재 성과 유지",
              description: `CTR ${data.ctr}%는 ${parseFloat(data.ctr) >= 2 ? "우수한" : "양호한"} 성과입니다.`,
            },
          ],
          generatedAt: new Date().toISOString(),
        };

        results.push({
          id: report.id,
          client_id: report.client_id,
          report_type: report.report_type,
          period: `${report.period_start} ~ ${report.period_end}`,
          action: "regenerated",
          hasAI: !!aiText,
          naverData: {
            impressions: data.naverTotals.impressions,
            clicks: data.naverTotals.clicks,
            cost: data.naverTotals.cost,
          },
        });
      } else if (report.client_id === "\uB098\uB77C\uB618") {
        const data = aggregateNaratton(records);
        const prevData =
          prevRecords.length > 0 ? aggregateNaratton(prevRecords) : null;
        const aiText = await generateNarattonInsight(
          report.report_type,
          report.period_start,
          report.period_end,
          data,
          prevData,
        );

        const impChange = prevData
          ? calcChange(data.totalImpressions, prevData.totalImpressions)
          : 0;
        const leadChange = prevData
          ? calcChange(data.totalLeads, prevData.totalLeads)
          : 0;
        const spendChange = prevData
          ? calcChange(data.totalSpend, prevData.totalSpend)
          : 0;
        const cplChange = prevData ? calcChange(data.cpl, prevData.cpl) : 0;
        const week = report.week;
        const periodLabel =
          report.report_type === "monthly"
            ? `${month}월`
            : `${month}월 ${week}주차(${report.period_start.slice(5)}~${report.period_end.slice(5)})`;

        const maxLeadDay =
          data.dailyStats.length > 0
            ? data.dailyStats.reduce((max, d) =>
                d.leads > max.leads ? d : max,
              )
            : null;
        const bestCplCampaign = data.campaignPerformance.find(
          (c) => c.cpl !== null && c.leads > 0,
        );

        aiInsights = {
          summary: aiText
            ? `AI 생성 인사이트 포함. ${periodLabel}, 총 리드 ${data.totalLeads}건, CPL ${data.cpl.toLocaleString()}원, 지출 ${data.totalSpend.toLocaleString()}원.`
            : `${periodLabel}, 총 리드 ${data.totalLeads}건, CPL ${data.cpl.toLocaleString()}원, 지출 ${data.totalSpend.toLocaleString()}원.`,
          aiGeneratedText: aiText || null,
          highlights: [
            `리드 ${data.totalLeads}건, CPL ${data.cpl.toLocaleString()}원`,
            maxLeadDay
              ? `${maxLeadDay.date} 리드 ${maxLeadDay.leads}건으로 기간 내 최다`
              : null,
            bestCplCampaign
              ? `${bestCplCampaign.campaign_name} 캠페인 CPL ${bestCplCampaign.cpl?.toLocaleString()}원으로 최우수`
              : null,
            `CTR ${data.ctr}%, CPC ${data.cpc.toLocaleString()}원`,
            prevData
              ? `전 기간 대비 리드 ${leadChange > 0 ? "+" : ""}${leadChange}%, CPL ${cplChange > 0 ? "+" : ""}${cplChange}%`
              : null,
          ].filter((v): v is string => v !== null),
          platforms: {
            meta: {
              impressions: data.totalImpressions,
              clicks: data.totalClicks,
              spend: data.totalSpend,
              leads: data.totalLeads,
              cpl: data.cpl,
            },
          },
          comparison: prevData
            ? {
                impressions: {
                  current: data.totalImpressions,
                  previous: prevData.totalImpressions,
                  change: impChange,
                },
                clicks: {
                  current: data.totalClicks,
                  previous: prevData.totalClicks,
                  change: calcChange(data.totalClicks, prevData.totalClicks),
                },
                spend: {
                  current: data.totalSpend,
                  previous: prevData.totalSpend,
                  change: spendChange,
                },
                leads: {
                  current: data.totalLeads,
                  previous: prevData.totalLeads,
                  change: leadChange,
                },
                cpl: {
                  current: data.cpl,
                  previous: prevData.cpl,
                  change: cplChange,
                },
              }
            : null,
          campaignPerformance: data.campaignPerformance.slice(0, 5),
          recommendations: [
            {
              type: "budget",
              platform: "meta",
              priority: "high",
              title: "리드 효율 분석",
              description: `CPL ${data.cpl.toLocaleString()}원으로 ${data.cpl <= 10000 ? "우수한" : "양호한"} 효율을 보이고 있습니다.`,
            },
          ],
          generatedAt: new Date().toISOString(),
        };

        results.push({
          id: report.id,
          client_id: report.client_id,
          report_type: report.report_type,
          period: `${report.period_start} ~ ${report.period_end}`,
          action: "regenerated",
          hasAI: !!aiText,
        });
      } else {
        results.push({
          id: report.id,
          client_id: report.client_id,
          action: "skipped",
          reason: "unsupported client",
        });
        continue;
      }

      // 5. Update report
      await updateReport(report.id, {
        ai_insights: aiInsights,
        ai_generated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Report regeneration error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
