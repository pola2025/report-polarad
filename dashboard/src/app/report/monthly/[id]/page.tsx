'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ReportHeader,
  KPISection,
  NaverKeywordsSection,
  MetaCampaignsSection,
  AIInsightsSection,
  AdminCommentSection,
  DailyPerformanceSection,
  DailyTrendChart,
  WeekdayHeatmap,
  ChannelComparisonSection,
  DateHeatmap,
} from '@/components/report'
import { Card } from '@/components/ui/card'
import type { MonthlyReportData, ReportComment } from '@/types/report'

export default function MonthlyReportPage() {
  const params = useParams()
  const reportId = params.id as string

  const [data, setData] = useState<MonthlyReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // 관리자 모드 확인 (쿠키 기반)
    fetch('/api/auth/admin/verify')
      .then(res => setIsAdmin(res.ok))
      .catch(() => setIsAdmin(false))

    // 리포트 데이터 로드
    async function loadReport() {
      try {
        const response = await fetch(`/api/reports/monthly/${reportId}`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '리포트를 불러올 수 없습니다.')
        }

        const result = await response.json()
        setData(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    loadReport()
  }, [reportId])

  const handleCommentUpdate = (comment: ReportComment) => {
    if (data) {
      setData({
        ...data,
        report: {
          ...data.report,
          comment,
        },
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">리포트를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <div className="text-4xl mb-4">😢</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">오류 발생</h2>
          <p className="text-gray-600">{error}</p>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <div className="text-4xl mb-4">📭</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">리포트 없음</h2>
          <p className="text-gray-600">요청하신 리포트를 찾을 수 없습니다.</p>
        </Card>
      </div>
    )
  }

  const { report, meta, naver } = data

  // KPI 데이터 계산 (API에서 이미 KRW로 변환됨)
  const totalImpressions = meta.daily.reduce((sum, d) => sum + d.impressions, 0)
  const totalClicks = meta.daily.reduce((sum, d) => sum + d.clicks, 0)
  const totalSpend = meta.daily.reduce((sum, d) => sum + d.spend, 0) // 이미 KRW
  // 잠재고객 리드 (Meta API) - 빨간색
  const totalMetaLeads = meta.actualLeads ?? meta.daily.reduce((sum, d) => sum + d.leads, 0)
  // 트래픽 리드 (홈페이지) - 녹색
  const totalHomepageLeads = meta.homepageLeads ?? 0
  const totalLeads = totalMetaLeads + totalHomepageLeads
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0

  const kpiData = {
    impressions: totalImpressions,
    clicks: totalClicks,
    spend: totalSpend,
    ctr: avgCtr,
    cpc: avgCpc,
    leads: totalMetaLeads,  // 잠재고객 리드 (빨간색)
    homepageLeads: totalHomepageLeads,  // 트래픽 리드 (녹색)
    cpl: avgCpl,
    videoViews: meta.videoViews || 0,
    avgWatchTime: meta.avgWatchTime || 0,
    budgetUsage: 92,
    prevPeriod: report.summary_data?.meta?.prevPeriod,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 관리자 배너 */}
        {isAdmin && (
          <div className="mb-4 p-3 bg-orange-100 border border-orange-200 rounded-lg text-sm text-orange-800">
            🔐 관리자 모드로 보고 있습니다. 코멘트 작성/수정이 가능합니다.
          </div>
        )}

        {/* 헤더 */}
        <ReportHeader
          clientName={report.client?.client_name || '클라이언트'}
          clientSlug={report.client?.slug || undefined}
          reportType={report.report_type}
          year={report.year}
          month={report.month || undefined}
          week={report.week || undefined}
          periodStart={report.period_start}
          periodEnd={report.period_end}
          createdAt={report.created_at}
        />

        {/* 핵심 성과 요약 */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
            <span>📊</span>
            <span>핵심 성과 요약</span>
          </div>
          <div className="rounded-lg p-5 mb-4 bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-blue-500">
            <p className="text-gray-700 leading-relaxed">
              {report.report_type === 'weekly' ? '이번 주' : '이번 달'} <strong>총 광고비 {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(totalSpend)}</strong>으로
              <strong> CTR {avgCtr.toFixed(2)}%</strong>를 기록했습니다.
              {/* H.E.A 판교(video)는 리드 표시 안함 */}
              {report.client?.meta_metric_type !== 'video' && totalLeads > 0 && (
                <> 총 <strong>{totalLeads}건</strong>의 리드를 획득했습니다.</>
              )}
            </p>
          </div>
        </Card>

        {/* KPI 섹션 */}
        <KPISection data={kpiData} metricType={report.client?.meta_metric_type} />

        {/* 채널별 성과 비교 - 월간 리포트에서만 표시 */}
        {report.report_type === 'monthly' && (meta.campaigns.length > 0 || naver.keywords.length > 0) && (
          <ChannelComparisonSection
            metaCampaigns={meta.campaigns}
            naverKeywords={naver.keywords}
            usdToKrw={1}
            videoViews={meta.videoViews}
            avgWatchTime={meta.avgWatchTime}
          />
        )}

        {/* 일별 추이 차트 - 월간 리포트에서만 표시 */}
        {report.report_type === 'monthly' && meta.daily.length > 0 && (
          <DailyTrendChart
            daily={meta.daily}
            usdToKrw={1}
            showLeads={report.client?.meta_metric_type !== 'video'}
            showClicks={true}
            channel="meta"
          />
        )}

        {/* 요일별 성과 히트맵 - 월간 리포트에서만 표시 */}
        {report.report_type === 'monthly' && meta.daily.length > 0 && (
          <WeekdayHeatmap daily={meta.daily} usdToKrw={1} metricType={report.client?.meta_metric_type} />
        )}

        {/* 날짜별 성과 패턴 - 월간 리포트에서만 표시 */}
        {report.report_type === 'monthly' && meta.daily.length > 0 && (
          <DateHeatmap daily={meta.daily} usdToKrw={1} metricType={report.client?.meta_metric_type} />
        )}

        {/* 일별 성과 추이 섹션 - 주간 리포트에서만 표시 */}
        {report.report_type === 'weekly' && meta.daily.length > 0 && (
          <DailyPerformanceSection daily={meta.daily} usdToKrw={1} metricType={report.client?.meta_metric_type} />
        )}

        {/* Meta 캠페인 섹션 */}
        {meta.campaigns.length > 0 && (
          <MetaCampaignsSection campaigns={meta.campaigns} metricType={report.client?.meta_metric_type} />
        )}

        {/* 네이버 키워드 섹션 */}
        {naver.keywords.length > 0 && (
          <NaverKeywordsSection keywords={naver.keywords} />
        )}

        {/* 담당자 코멘트 섹션 */}
        <AdminCommentSection
          comment={report.comment || null}
          reportId={report.id}
          isAdmin={isAdmin}
          onCommentUpdate={handleCommentUpdate}
        />

        {/* AI 인사이트 섹션 */}
        <AIInsightsSection
          insights={report.ai_insights}
          isAdmin={isAdmin}
          analysisData={{
            reportType: report.report_type,
            period: {
              start: report.period_start,
              end: report.period_end,
              year: report.year,
              month: report.month ?? undefined,
              week: report.week ?? undefined,
            },
            meta: {
              impressions: totalImpressions,
              clicks: totalClicks,
              leads: totalLeads,
              spend: totalSpend, // 이미 KRW
              ctr: avgCtr,
              cpc: avgCpc,
              cpl: avgCpl,
              videoViews: meta.videoViews,
              avgWatchTime: meta.avgWatchTime,
              campaigns: meta.campaigns,
              daily: meta.daily,
            },
            naver: {
              impressions: naver.keywords.reduce((sum, k) => sum + k.impressions, 0),
              clicks: naver.keywords.reduce((sum, k) => sum + k.clicks, 0),
              spend: naver.keywords.reduce((sum, k) => sum + k.totalCost, 0),
              ctr: naver.keywords.length > 0
                ? naver.keywords.reduce((sum, k) => sum + k.ctr, 0) / naver.keywords.length
                : 0,
              avgCpc: naver.keywords.length > 0
                ? naver.keywords.reduce((sum, k) => sum + k.avgCpc, 0) / naver.keywords.length
                : 0,
              keywords: naver.keywords,
            },
            clientName: report.client?.client_name,
            metricType: report.client?.meta_metric_type === 'video' ? 'video' : 'lead',
          }}
        />

        {/* 푸터 */}
        <footer className="text-center py-6 text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-orange-500 font-semibold">POLARAD</span>
            <span>광고 성과 리포트</span>
          </div>
          <p>© 2025 Polarad. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}
