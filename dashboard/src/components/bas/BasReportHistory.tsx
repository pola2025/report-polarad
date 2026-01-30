'use client'

import { useEffect, useState } from 'react'
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react'

interface ReportData {
  summary?: {
    impressions: number
    clicks: number
    leads: number
    spend: number
    cpl: number
    ctr: number
    conversion_rate: number
  }
  ad_performance?: Array<{
    ad_id: string
    ad_name: string
    leads: number
    spend: number
    cpl: number
    ctr: number
    spend_percent: number
    lead_percent: number
  }>
}

interface Report {
  id: string
  client_id: string
  report_type: 'weekly' | 'monthly'
  week_start: string
  week_end: string
  total_leads: number
  total_spend: number
  avg_cpl: number
  avg_ctr: number
  leads_change: number
  spend_change: number
  cpl_change: number
  sent_at: string
  message_text: string
  ai_insights: string
  report_data: ReportData | null
}

interface BasReportHistoryProps {
  clientSlug: string
}

function ChangeIndicator({ value, invertColor = false }: { value: number; invertColor?: boolean }) {
  if (!value || value === 0) {
    return (
      <span className="text-gray-400 text-xs flex items-center gap-0.5">
        <Minus className="w-3 h-3" /> 0%
      </span>
    )
  }
  const isPositive = value > 0
  const isGood = invertColor ? !isPositive : isPositive
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${isGood ? 'text-green-600' : 'text-red-500'}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPositive ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

export function BasReportHistory({ clientSlug }: BasReportHistoryProps) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'weekly' | 'monthly'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchReports() {
      setLoading(true)
      try {
        const res = await fetch(`/api/meta/reports?clientSlug=${clientSlug}&type=${filterType}&limit=30`)
        if (!res.ok) throw new Error('Failed to fetch reports')
        const data = await res.json()
        setReports(data.reports || [])
      } catch (err) {
        console.error('Report fetch error:', err)
        setReports([])
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [clientSlug, filterType])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">저장된 리포트가 없습니다</p>
        <p className="text-gray-400 text-sm mt-1">
          주간/월간 리포트가 발송되면 여기에 표시됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">유형:</span>
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {(['all', 'weekly', 'monthly'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterType === type
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {type === 'all' ? '전체' : type === 'weekly' ? '주간' : '월간'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{reports.length}건</span>
      </div>

      {/* 리포트 목록 */}
      {reports.map((report) => {
        const isExpanded = expandedId === report.id
        const reportData = report.report_data
        const adPerformance = reportData?.ad_performance

        return (
          <div
            key={report.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-sm"
          >
            {/* 리포트 헤더 */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : report.id)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  report.report_type === 'weekly' ? 'bg-blue-100' : 'bg-purple-100'
                }`}
              >
                <FileText
                  className={`w-4 h-4 ${
                    report.report_type === 'weekly' ? 'text-blue-600' : 'text-purple-600'
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      report.report_type === 'weekly'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {report.report_type === 'weekly' ? '주간' : '월간'}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {report.week_start?.slice(5)} ~ {report.week_end?.slice(5)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>리드 {report.total_leads}건</span>
                  <span>
                    지출 $
                    {report.total_spend?.toLocaleString('en-US', {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span>CPL ${report.avg_cpl?.toFixed(0)}</span>
                </div>
              </div>

              {/* 변화율 */}
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-center">
                  <div className="text-[10px] text-gray-400">리드</div>
                  <ChangeIndicator value={report.leads_change} />
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-gray-400">CPL</div>
                  <ChangeIndicator value={report.cpl_change} invertColor />
                </div>
              </div>

              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>

            {/* 확장된 상세 내용 */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                {/* KPI 요약 */}
                {reportData?.summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">리드</div>
                      <div className="text-lg font-bold text-gray-900">
                        {reportData.summary.leads}건
                      </div>
                      <ChangeIndicator value={report.leads_change} />
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">지출</div>
                      <div className="text-lg font-bold text-gray-900">
                        $
                        {reportData.summary.spend?.toLocaleString('en-US', {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      <ChangeIndicator value={report.spend_change} />
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">CPL</div>
                      <div className="text-lg font-bold text-gray-900">
                        ${reportData.summary.cpl?.toFixed(0)}
                      </div>
                      <ChangeIndicator value={report.cpl_change} invertColor />
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">CTR</div>
                      <div className="text-lg font-bold text-gray-900">
                        {reportData.summary.ctr?.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* 광고별 성과 */}
                {adPerformance && adPerformance.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      광고별 성과
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 pr-2 text-gray-500 font-medium">
                              광고명
                            </th>
                            <th className="text-right py-2 px-2 text-gray-500 font-medium">
                              리드
                            </th>
                            <th className="text-right py-2 px-2 text-gray-500 font-medium">
                              지출
                            </th>
                            <th className="text-right py-2 px-2 text-gray-500 font-medium">
                              CPL
                            </th>
                            <th className="text-right py-2 pl-2 text-gray-500 font-medium">
                              비중
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {adPerformance.slice(0, 10).map((ad, i) => (
                            <tr
                              key={ad.ad_id || i}
                              className="border-b border-gray-50"
                            >
                              <td
                                className="py-2 pr-2 text-gray-700 max-w-[200px] truncate"
                                title={ad.ad_name}
                              >
                                {ad.ad_name}
                              </td>
                              <td className="py-2 px-2 text-right font-medium text-gray-900">
                                {ad.leads}건
                              </td>
                              <td className="py-2 px-2 text-right text-gray-600">
                                $
                                {ad.spend?.toLocaleString('en-US', {
                                  maximumFractionDigits: 0,
                                })}
                              </td>
                              <td
                                className={`py-2 px-2 text-right font-medium ${
                                  ad.cpl > 30
                                    ? 'text-orange-600'
                                    : 'text-green-600'
                                }`}
                              >
                                ${ad.cpl?.toFixed(0)}
                              </td>
                              <td className="py-2 pl-2 text-right text-gray-500">
                                {ad.lead_percent?.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* AI 인사이트 */}
                {report.ai_insights && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-amber-700 mb-1">
                      AI 인사이트
                    </div>
                    <div className="text-xs text-amber-900 whitespace-pre-line leading-relaxed">
                      {report.ai_insights}
                    </div>
                  </div>
                )}

                {/* 발송 시각 */}
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Calendar className="w-3 h-3" />
                  발송:{' '}
                  {report.sent_at
                    ? new Date(report.sent_at).toLocaleString('ko-KR')
                    : '-'}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
