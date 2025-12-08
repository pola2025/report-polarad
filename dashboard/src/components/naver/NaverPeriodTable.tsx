'use client'

import { useState, Fragment } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
} from 'lucide-react'
import type {
  NaverDailyData,
  NaverWeeklyData,
  NaverMonthlyData,
} from '@/types/naver-analytics'

type ViewMode = 'monthly' | 'weekly' | 'daily'

interface NaverPeriodTableProps {
  daily: NaverDailyData[]
  weekly: NaverWeeklyData[]
  monthly: NaverMonthlyData[]
  loading?: boolean
}

export function NaverPeriodTable({
  daily,
  weekly,
  monthly,
  loading,
}: NaverPeriodTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())

  const toggleMonth = (month: string) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(month)) {
      newExpanded.delete(month)
    } else {
      newExpanded.add(month)
    }
    setExpandedMonths(newExpanded)
  }

  const toggleWeek = (week: string) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(week)) {
      newExpanded.delete(week)
    } else {
      newExpanded.add(week)
    }
    setExpandedWeeks(newExpanded)
  }

  // 변화율 표시
  const ChangeIndicator = ({ value }: { value?: number }) => {
    if (value === undefined || value === 0) return <span className="text-gray-400">-</span>
    const isPositive = value > 0
    return (
      <span className={`flex items-center text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-500">데이터 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            기간별 네이버 광고 성과
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'monthly' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('monthly')}
            >
              월별
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('weekly')}
            >
              주별
            </Button>
            <Button
              variant={viewMode === 'daily' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('daily')}
            >
              일별
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 안내 문구 */}
        <p className="text-xs text-gray-500 mb-3 bg-gray-50 px-3 py-2 rounded">
          ※ 네이버 플레이스 키워드 성과분석 데이터는 클릭이 발생한 날짜만 표시됩니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">기간</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">노출수</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">클릭수</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">CTR</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">평균CPC</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">총비용</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">평균순위</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">변화</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* 월별 뷰 */}
              {viewMode === 'monthly' && monthly.map((m) => (
                <Fragment key={m.month}>
                  <tr
                    className="bg-blue-50 hover:bg-blue-100 cursor-pointer"
                    onClick={() => toggleMonth(m.month)}
                  >
                    <td className="px-3 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        {expandedMonths.has(m.month) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <Calendar className="h-4 w-4 text-blue-600" />
                        {m.month_label}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatNumber(m.impressions)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatNumber(m.clicks)}</td>
                    <td className="px-3 py-2 text-right">{m.ctr.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right">{formatNumber(m.avg_cpc)}원</td>
                    <td className="px-3 py-2 text-right font-medium text-blue-600">{formatNumber(m.total_cost)}원</td>
                    <td className="px-3 py-2 text-right">{m.avg_rank.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center">
                      <ChangeIndicator value={m.cost_change} />
                    </td>
                  </tr>
                  {/* 월 내 주별 데이터 */}
                  {expandedMonths.has(m.month) && m.weeks?.map((w) => (
                    <Fragment key={`${m.month}-${w.week_label}`}>
                      <tr
                        className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleWeek(w.week_label)
                        }}
                      >
                        <td className="px-3 py-2 pl-8">
                          <div className="flex items-center gap-2">
                            {expandedWeeks.has(w.week_label) ? (
                              <ChevronDown className="h-3 w-3 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                            )}
                            <span className="text-gray-600">{w.week_label}</span>
                            <span className="text-xs text-gray-400">
                              ({w.week_start} ~ {w.week_end})
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{formatNumber(w.impressions)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(w.clicks)}</td>
                        <td className="px-3 py-2 text-right">{w.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right">{formatNumber(w.avg_cpc)}원</td>
                        <td className="px-3 py-2 text-right">{formatNumber(w.total_cost)}원</td>
                        <td className="px-3 py-2 text-right">{w.avg_rank.toFixed(1)}</td>
                        <td className="px-3 py-2 text-center">
                          <ChangeIndicator value={w.cost_change} />
                        </td>
                      </tr>
                      {/* 주 내 일별 데이터 */}
                      {expandedWeeks.has(w.week_label) &&
                        daily
                          .filter((d) => d.date >= w.week_start && d.date <= w.week_end)
                          .map((d) => (
                            <tr key={d.date} className="hover:bg-gray-50">
                              <td className="px-3 py-1 pl-14 text-gray-500 text-xs">{d.date}</td>
                              <td className="px-3 py-1 text-right text-xs">{formatNumber(d.impressions)}</td>
                              <td className="px-3 py-1 text-right text-xs">{formatNumber(d.clicks)}</td>
                              <td className="px-3 py-1 text-right text-xs">{d.ctr.toFixed(2)}%</td>
                              <td className="px-3 py-1 text-right text-xs">{formatNumber(d.avg_cpc)}원</td>
                              <td className="px-3 py-1 text-right text-xs">{formatNumber(d.total_cost)}원</td>
                              <td className="px-3 py-1 text-right text-xs">{d.avg_rank.toFixed(1)}</td>
                              <td className="px-3 py-1"></td>
                            </tr>
                          ))}
                    </Fragment>
                  ))}
                  {/* 월 내 일별 데이터 (주별 없이) */}
                  {expandedMonths.has(m.month) && (!m.weeks || m.weeks.length === 0) &&
                    m.days?.map((d) => (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td className="px-3 py-1 pl-8 text-gray-500 text-xs">{d.date}</td>
                        <td className="px-3 py-1 text-right text-xs">{formatNumber(d.impressions)}</td>
                        <td className="px-3 py-1 text-right text-xs">{formatNumber(d.clicks)}</td>
                        <td className="px-3 py-1 text-right text-xs">{d.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-1 text-right text-xs">{formatNumber(d.avg_cpc)}원</td>
                        <td className="px-3 py-1 text-right text-xs">{formatNumber(d.total_cost)}원</td>
                        <td className="px-3 py-1 text-right text-xs">{d.avg_rank.toFixed(1)}</td>
                        <td className="px-3 py-1"></td>
                      </tr>
                    ))}
                </Fragment>
              ))}

              {/* 주별 뷰 */}
              {viewMode === 'weekly' && weekly.map((w) => (
                <tr key={w.week_label} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div>
                      <span className="font-medium">{w.week_label}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        ({w.week_start} ~ {w.week_end})
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(w.impressions)}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(w.clicks)}</td>
                  <td className="px-3 py-2 text-right">{w.ctr.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right">{formatNumber(w.avg_cpc)}원</td>
                  <td className="px-3 py-2 text-right font-medium">{formatNumber(w.total_cost)}원</td>
                  <td className="px-3 py-2 text-right">{w.avg_rank.toFixed(1)}</td>
                  <td className="px-3 py-2 text-center">
                    <ChangeIndicator value={w.cost_change} />
                  </td>
                </tr>
              ))}

              {/* 일별 뷰 */}
              {viewMode === 'daily' && daily.map((d) => (
                <tr key={d.date} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{d.date}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(d.impressions)}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(d.clicks)}</td>
                  <td className="px-3 py-2 text-right">{d.ctr.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right">{formatNumber(d.avg_cpc)}원</td>
                  <td className="px-3 py-2 text-right font-medium">{formatNumber(d.total_cost)}원</td>
                  <td className="px-3 py-2 text-right">{d.avg_rank.toFixed(1)}</td>
                  <td className="px-3 py-2"></td>
                </tr>
              ))}

              {/* 데이터 없음 */}
              {((viewMode === 'monthly' && monthly.length === 0) ||
                (viewMode === 'weekly' && weekly.length === 0) ||
                (viewMode === 'daily' && daily.length === 0)) && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
