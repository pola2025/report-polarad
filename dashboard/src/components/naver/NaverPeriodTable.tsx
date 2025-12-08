'use client'

import { useState, Fragment, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
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

// 모바일 카드 컴포넌트
interface MobileCardProps {
  period: string
  subPeriod?: string
  impressions: number
  clicks: number
  ctr: number
  avgCpc: number
  totalCost: number
  avgRank: number
  change?: number
  isHighlighted?: boolean
}

function MobileDataCard({ period, subPeriod, impressions, clicks, ctr, avgCpc, totalCost, avgRank, change, isHighlighted }: MobileCardProps) {
  return (
    <div className={`flex-shrink-0 w-[85%] snap-center ${isHighlighted ? 'bg-[#E8F5E9] border-green-400' : 'bg-white border-gray-200'} border rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className={`font-semibold ${isHighlighted ? 'text-green-700' : 'text-gray-900'}`}>{period}</p>
          {subPeriod && <p className="text-xs text-gray-500">{subPeriod}</p>}
        </div>
        {change !== undefined && change !== 0 && (
          <div className={`flex items-center text-xs px-2 py-1 rounded-full ${change > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {change > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">노출수</p>
          <p className="font-medium">{formatNumber(impressions)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">클릭수</p>
          <p className="font-medium">{formatNumber(clicks)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">CTR</p>
          <p className="font-medium">{ctr.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">평균 CPC</p>
          <p className="font-medium">{formatNumber(avgCpc)}원</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">평균 순위</p>
          <p className="font-medium">{avgRank.toFixed(1)}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-gray-500 text-xs">총 비용</p>
        <p className={`text-lg font-bold ${isHighlighted ? 'text-green-600' : 'text-green-600'}`}>{formatNumber(totalCost)}원</p>
      </div>
    </div>
  )
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
  const [mobileCardIndex, setMobileCardIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  // 모바일용 데이터 준비
  const getMobileCards = () => {
    const cards: Array<{
      period: string
      subPeriod?: string
      impressions: number
      clicks: number
      ctr: number
      avgCpc: number
      totalCost: number
      avgRank: number
      change?: number
      isHighlighted?: boolean
    }> = []

    if (viewMode === 'monthly') {
      monthly.forEach(m => {
        cards.push({
          period: m.month_label,
          impressions: m.impressions,
          clicks: m.clicks,
          ctr: m.ctr,
          avgCpc: m.avg_cpc,
          totalCost: m.total_cost,
          avgRank: m.avg_rank,
          change: m.cost_change,
        })
      })
    } else if (viewMode === 'weekly') {
      weekly.forEach(w => {
        cards.push({
          period: w.week_label,
          subPeriod: `${w.week_start} ~ ${w.week_end}`,
          impressions: w.impressions,
          clicks: w.clicks,
          ctr: w.ctr,
          avgCpc: w.avg_cpc,
          totalCost: w.total_cost,
          avgRank: w.avg_rank,
          change: w.cost_change,
        })
      })
    } else {
      daily.forEach(d => {
        cards.push({
          period: d.date,
          impressions: d.impressions,
          clicks: d.clicks,
          ctr: d.ctr,
          avgCpc: d.avg_cpc,
          totalCost: d.total_cost,
          avgRank: d.avg_rank,
        })
      })
    }

    return cards
  }

  const mobileCards = getMobileCards()

  // 스크롤 핸들러
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const cardWidth = container.scrollWidth / Math.max(mobileCards.length, 1)
      const newIndex = Math.round(container.scrollLeft / cardWidth)
      setMobileCardIndex(newIndex)
    }
  }

  // 네비게이션 버튼 핸들러
  const scrollToCard = (index: number) => {
    if (scrollContainerRef.current && mobileCards.length > 0) {
      const container = scrollContainerRef.current
      const cardWidth = container.scrollWidth / mobileCards.length
      container.scrollTo({ left: cardWidth * index, behavior: 'smooth' })
      setMobileCardIndex(index)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg whitespace-nowrap">
            <BarChart3 className="h-5 w-5 flex-shrink-0" />
            <span>기간별 네이버 광고 성과</span>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'monthly' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setViewMode('monthly'); setMobileCardIndex(0) }}
              className="text-xs md:text-sm px-2 md:px-3"
            >
              월별
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setViewMode('weekly'); setMobileCardIndex(0) }}
              className="text-xs md:text-sm px-2 md:px-3"
            >
              주별
            </Button>
            <Button
              variant={viewMode === 'daily' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setViewMode('daily'); setMobileCardIndex(0) }}
              className="text-xs md:text-sm px-2 md:px-3"
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

        {/* 모바일: 스와이프 카드 캐러셀 */}
        <div className="md:hidden">
          {mobileCards.length > 0 ? (
            <>
              {/* 캐러셀 컨테이너 */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-2 px-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {mobileCards.map((card, index) => (
                  <MobileDataCard
                    key={index}
                    period={card.period}
                    subPeriod={card.subPeriod}
                    impressions={card.impressions}
                    clicks={card.clicks}
                    ctr={card.ctr}
                    avgCpc={card.avgCpc}
                    totalCost={card.totalCost}
                    avgRank={card.avgRank}
                    change={card.change}
                    isHighlighted={card.isHighlighted}
                  />
                ))}
              </div>

              {/* 네비게이션 컨트롤 */}
              <div className="flex items-center justify-center gap-4 mt-2">
                <button
                  onClick={() => scrollToCard(Math.max(0, mobileCardIndex - 1))}
                  disabled={mobileCardIndex === 0}
                  className="p-1 rounded-full bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>

                {/* 도트 인디케이터 */}
                <div className="flex gap-1.5">
                  {mobileCards.slice(0, Math.min(mobileCards.length, 10)).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToCard(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === mobileCardIndex ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                  {mobileCards.length > 10 && (
                    <span className="text-xs text-gray-400 ml-1">+{mobileCards.length - 10}</span>
                  )}
                </div>

                <button
                  onClick={() => scrollToCard(Math.min(mobileCards.length - 1, mobileCardIndex + 1))}
                  disabled={mobileCardIndex === mobileCards.length - 1}
                  className="p-1 rounded-full bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* 카드 카운터 */}
              <p className="text-center text-xs text-gray-400 mt-2">
                {mobileCardIndex + 1} / {mobileCards.length}
              </p>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">데이터가 없습니다.</div>
          )}
        </div>

        {/* 데스크톱: 기존 테이블 */}
        <div className="hidden md:block overflow-x-auto">
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
