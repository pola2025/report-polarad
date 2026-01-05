'use client'

import { useState, Fragment } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  BarChart3,
  Monitor,
  Smartphone,
} from 'lucide-react'

// 브랜드검색 일별 데이터
interface BrandSearchDailyData {
  date: string
  pc_impressions: number
  pc_clicks: number
  mobile_impressions: number
  mobile_clicks: number
  total_impressions: number
  total_clicks: number
}

// 브랜드검색 월별 데이터
interface BrandSearchMonthlyData {
  month: string
  month_label: string
  pc_impressions: number
  pc_clicks: number
  mobile_impressions: number
  mobile_clicks: number
  total_impressions: number
  total_clicks: number
  total_ctr: number
  days: BrandSearchDailyData[]
}

interface BrandSearchTableProps {
  daily: BrandSearchDailyData[]
  monthly: BrandSearchMonthlyData[]
  loading?: boolean
  monthlyBudget?: {
    pc: number      // PC 월 예산 (기본 660000)
    mobile: number  // 모바일 월 예산 (기본 660000)
  }
}

type ViewMode = 'monthly' | 'daily'

export function BrandSearchTable({
  daily,
  monthly,
  loading,
  monthlyBudget = { pc: 660000, mobile: 660000 },
}: BrandSearchTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

  const toggleMonth = (month: string) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(month)) {
      newExpanded.delete(month)
    } else {
      newExpanded.add(month)
    }
    setExpandedMonths(newExpanded)
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

  const totalBudget = monthlyBudget.pc + monthlyBudget.mobile

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg whitespace-nowrap">
            <BarChart3 className="h-5 w-5 flex-shrink-0" />
            <span>네이버 브랜드검색 성과</span>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'daily' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('daily')}
              className="text-xs md:text-sm px-2 md:px-3"
            >
              일별
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('monthly')}
              className="text-xs md:text-sm px-2 md:px-3"
            >
              월별
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 예산 안내 */}
        <div className="text-xs text-gray-500 mb-3 bg-blue-50 px-3 py-2 rounded flex items-center gap-4">
          <span className="font-medium text-blue-700">월 고정 예산:</span>
          <span className="flex items-center gap-1">
            <Monitor className="h-3 w-3" />
            PC {formatNumber(monthlyBudget.pc)}원
          </span>
          <span className="flex items-center gap-1">
            <Smartphone className="h-3 w-3" />
            모바일 {formatNumber(monthlyBudget.mobile)}원
          </span>
          <span className="font-medium">= 총 {formatNumber(totalBudget)}원</span>
        </div>

        {/* 모바일: 간단한 카드 리스트 */}
        <div className="md:hidden space-y-3">
          {viewMode === 'daily' && daily.length > 0 && (
            [...daily].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((d) => (
              <div key={d.date} className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="font-medium text-gray-900 mb-2">{d.date}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Monitor className="h-3 w-3 text-blue-500" />
                    <span className="text-gray-500">PC:</span>
                    <span>{formatNumber(d.pc_impressions)}</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-green-600">{formatNumber(d.pc_clicks)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Smartphone className="h-3 w-3 text-purple-500" />
                    <span className="text-gray-500">모바일:</span>
                    <span>{formatNumber(d.mobile_impressions)}</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-green-600">{formatNumber(d.mobile_clicks)}</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 text-sm">
                  <span className="text-gray-500">합계:</span>
                  <span className="ml-2">노출 {formatNumber(d.total_impressions)}</span>
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="text-green-600">클릭 {formatNumber(d.total_clicks)}</span>
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="text-blue-600">
                    CTR {d.total_impressions > 0 ? ((d.total_clicks / d.total_impressions) * 100).toFixed(2) : '0.00'}%
                  </span>
                </div>
              </div>
            ))
          )}
          {viewMode === 'daily' && daily.length === 0 && (
            <div className="text-center py-8 text-gray-500">데이터가 없습니다.</div>
          )}
        </div>

        {/* 데스크톱: 테이블 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">기간</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  <div className="flex items-center justify-end gap-1">
                    <Monitor className="h-3 w-3" />
                    PC 노출
                  </div>
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">PC 클릭</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  <div className="flex items-center justify-end gap-1">
                    <Smartphone className="h-3 w-3" />
                    모바일 노출
                  </div>
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">모바일 클릭</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">총 노출</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">총 클릭</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* 월별 뷰 */}
              {viewMode === 'monthly' && [...monthly].sort((a, b) => b.month.localeCompare(a.month)).map((m) => (
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
                    <td className="px-3 py-2 text-right">{formatNumber(m.pc_impressions)}</td>
                    <td className="px-3 py-2 text-right text-green-600">{formatNumber(m.pc_clicks)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(m.mobile_impressions)}</td>
                    <td className="px-3 py-2 text-right text-green-600">{formatNumber(m.mobile_clicks)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatNumber(m.total_impressions)}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">{formatNumber(m.total_clicks)}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{m.total_ctr.toFixed(2)}%</td>
                  </tr>
                  {/* 월 내 일별 데이터 */}
                  {expandedMonths.has(m.month) && m.days?.map((d) => (
                    <tr key={d.date} className="hover:bg-gray-50">
                      <td className="px-3 py-1 pl-10 text-gray-500 text-xs">{d.date}</td>
                      <td className="px-3 py-1 text-right text-xs">{formatNumber(d.pc_impressions)}</td>
                      <td className="px-3 py-1 text-right text-xs text-green-600">{formatNumber(d.pc_clicks)}</td>
                      <td className="px-3 py-1 text-right text-xs">{formatNumber(d.mobile_impressions)}</td>
                      <td className="px-3 py-1 text-right text-xs text-green-600">{formatNumber(d.mobile_clicks)}</td>
                      <td className="px-3 py-1 text-right text-xs">{formatNumber(d.total_impressions)}</td>
                      <td className="px-3 py-1 text-right text-xs text-green-600">{formatNumber(d.total_clicks)}</td>
                      <td className="px-3 py-1 text-right text-xs text-blue-600">
                        {d.total_impressions > 0 ? ((d.total_clicks / d.total_impressions) * 100).toFixed(2) : '0.00'}%
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}

              {/* 일별 뷰 - 월별로 그룹화 */}
              {viewMode === 'daily' && (() => {
                // 일별 데이터를 월별로 그룹화
                const dailyByMonth = daily.reduce((acc, d) => {
                  const month = d.date.substring(0, 7)
                  if (!acc[month]) acc[month] = []
                  acc[month].push(d)
                  return acc
                }, {} as Record<string, typeof daily>)

                // 월별 합계 계산
                const monthSummaries = Object.entries(dailyByMonth).map(([month, days]) => {
                  const [year, m] = month.split('-')
                  return {
                    month,
                    month_label: `${year}년 ${parseInt(m)}월`,
                    days,
                    pc_impressions: days.reduce((sum, d) => sum + d.pc_impressions, 0),
                    pc_clicks: days.reduce((sum, d) => sum + d.pc_clicks, 0),
                    mobile_impressions: days.reduce((sum, d) => sum + d.mobile_impressions, 0),
                    mobile_clicks: days.reduce((sum, d) => sum + d.mobile_clicks, 0),
                    total_impressions: days.reduce((sum, d) => sum + d.total_impressions, 0),
                    total_clicks: days.reduce((sum, d) => sum + d.total_clicks, 0),
                  }
                }).sort((a, b) => b.month.localeCompare(a.month))

                return monthSummaries.map((ms) => (
                  <Fragment key={ms.month}>
                    <tr
                      className="bg-green-50 hover:bg-green-100 cursor-pointer"
                      onClick={() => toggleMonth(ms.month)}
                    >
                      <td className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-2">
                          {expandedMonths.has(ms.month) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                          <Calendar className="h-4 w-4 text-green-600" />
                          {ms.month_label}
                          <span className="text-xs text-gray-400 ml-1">({ms.days.length}일)</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{formatNumber(ms.pc_impressions)}</td>
                      <td className="px-3 py-2 text-right font-medium text-green-600">{formatNumber(ms.pc_clicks)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatNumber(ms.mobile_impressions)}</td>
                      <td className="px-3 py-2 text-right font-medium text-green-600">{formatNumber(ms.mobile_clicks)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatNumber(ms.total_impressions)}</td>
                      <td className="px-3 py-2 text-right font-medium text-green-600">{formatNumber(ms.total_clicks)}</td>
                      <td className="px-3 py-2 text-right font-medium text-blue-600">
                        {ms.total_impressions > 0 ? ((ms.total_clicks / ms.total_impressions) * 100).toFixed(2) : '0.00'}%
                      </td>
                    </tr>
                    {/* 해당 월의 일별 데이터 */}
                    {expandedMonths.has(ms.month) && [...ms.days].sort((a, b) => b.date.localeCompare(a.date)).map((d) => (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td className="px-3 py-1 pl-10 text-gray-500 text-sm">{d.date}</td>
                        <td className="px-3 py-1 text-right text-sm">{formatNumber(d.pc_impressions)}</td>
                        <td className="px-3 py-1 text-right text-sm text-green-600">{formatNumber(d.pc_clicks)}</td>
                        <td className="px-3 py-1 text-right text-sm">{formatNumber(d.mobile_impressions)}</td>
                        <td className="px-3 py-1 text-right text-sm text-green-600">{formatNumber(d.mobile_clicks)}</td>
                        <td className="px-3 py-1 text-right text-sm">{formatNumber(d.total_impressions)}</td>
                        <td className="px-3 py-1 text-right text-sm text-green-600">{formatNumber(d.total_clicks)}</td>
                        <td className="px-3 py-1 text-right text-sm text-blue-600">
                          {d.total_impressions > 0 ? ((d.total_clicks / d.total_impressions) * 100).toFixed(2) : '0.00'}%
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              })()}

              {/* 데이터 없음 */}
              {((viewMode === 'monthly' && monthly.length === 0) ||
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
