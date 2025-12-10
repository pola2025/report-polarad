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
  MetaDailyData,
  MetaWeeklyData,
  MetaMonthlyData,
  MetaKPISummary,
} from '@/types/meta-analytics'

type ViewMode = 'monthly' | 'weekly' | 'daily'

interface MetaPeriodTableProps {
  daily: MetaDailyData[]
  weekly: MetaWeeklyData[]
  monthly: MetaMonthlyData[]
  loading?: boolean
  metricType?: 'lead' | 'video'
  summary?: MetaKPISummary
}

// 모바일 카드 컴포넌트
interface MobileCardProps {
  period: string
  subPeriod?: string
  impressions: number
  clicks: number
  ctr: number
  spend: number
  metric: number
  metricLabel: string
  metricValue: string
  change?: number
  isHighlighted?: boolean
}

function MobileDataCard({ period, subPeriod, impressions, clicks, ctr, spend, metricLabel, metricValue, change, isHighlighted }: MobileCardProps) {
  return (
    <div className={`flex-shrink-0 w-[85%] snap-center ${isHighlighted ? 'bg-[#FFF7E6] border-[#F5A623]' : 'bg-white border-gray-200'} border rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className={`font-semibold ${isHighlighted ? 'text-[#F5A623]' : 'text-gray-900'}`}>{period}</p>
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
          <p className="text-gray-500 text-xs">{metricLabel}</p>
          <p className="font-medium">{metricValue}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-gray-500 text-xs">지출</p>
        <p className={`text-lg font-bold ${isHighlighted ? 'text-[#F5A623]' : 'text-blue-600'}`}>{formatNumber(spend)}원</p>
      </div>
    </div>
  )
}

export function MetaPeriodTable({
  daily,
  weekly,
  monthly,
  loading,
  metricType = 'lead',
  summary,
}: MetaPeriodTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
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
      spend: number
      metricLabel: string
      metricValue: string
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
          spend: m.spend_krw,
          metricLabel: metricType === 'video' ? '영상조회' : '리드',
          metricValue: metricType === 'video' ? formatNumber(m.video_views || 0) : formatNumber(m.leads),
          change: m.spend_change,
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
          spend: w.spend_krw,
          metricLabel: metricType === 'video' ? '영상조회' : '리드',
          metricValue: metricType === 'video' ? formatNumber(w.video_views || 0) : formatNumber(w.leads),
          change: w.spend_change,
        })
      })
    } else {
      daily.forEach(d => {
        cards.push({
          period: d.date,
          impressions: d.impressions,
          clicks: d.clicks,
          ctr: d.ctr,
          spend: d.spend_krw,
          metricLabel: metricType === 'video' ? '영상조회' : '리드',
          metricValue: metricType === 'video' ? formatNumber(d.video_views || 0) : formatNumber(d.leads),
        })
      })
    }

    // 합계 카드 추가
    if (summary && cards.length > 0) {
      cards.unshift({
        period: '전체 합계',
        subPeriod: `${summary.date_range.start} ~ ${summary.date_range.end}`,
        impressions: summary.total_impressions,
        clicks: summary.total_clicks,
        ctr: summary.avg_ctr,
        spend: summary.total_spend_krw,
        metricLabel: metricType === 'video' ? '영상조회' : '리드',
        metricValue: metricType === 'video' ? formatNumber(summary.total_video_views) : formatNumber(summary.total_leads),
        isHighlighted: true,
      })
    }

    return cards
  }

  const mobileCards = getMobileCards()

  // 스크롤 핸들러
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const cardWidth = container.scrollWidth / mobileCards.length
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
            <span>기간별 Meta 광고 성과</span>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'daily' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setViewMode('daily'); setMobileCardIndex(0) }}
              className="text-xs md:text-sm px-2 md:px-3"
            >
              일별
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
              variant={viewMode === 'monthly' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setViewMode('monthly'); setMobileCardIndex(0) }}
              className="text-xs md:text-sm px-2 md:px-3"
            >
              월별
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
                    spend={card.spend}
                    metric={0}
                    metricLabel={card.metricLabel}
                    metricValue={card.metricValue}
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
                        index === mobileCardIndex ? 'bg-[#F5A623]' : 'bg-gray-300'
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
                <th className="px-3 py-2 text-right font-medium text-gray-500">지출(원)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  {metricType === 'video' ? '영상조회' : '리드'}
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  {metricType === 'video' ? '평균시청(초)' : 'CPL'}
                </th>
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
                    <td className="px-3 py-2 text-right font-medium text-blue-600">{formatNumber(m.spend_krw)}원</td>
                    <td className="px-3 py-2 text-right">
                      {metricType === 'video' ? formatNumber(m.video_views || 0) : formatNumber(m.leads)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {metricType === 'video'
                        ? (m.avg_watch_time ? `${m.avg_watch_time.toFixed(1)}초` : '-')
                        : (m.leads > 0 ? `${formatNumber(m.cpl_krw)}원` : '-')}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ChangeIndicator value={m.spend_change} />
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
                        <td className="px-3 py-2 text-right">{formatNumber(w.spend_krw)}원</td>
                        <td className="px-3 py-2 text-right">
                          {metricType === 'video' ? formatNumber(w.video_views || 0) : formatNumber(w.leads)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {metricType === 'video' ? '-' : (w.leads > 0 ? `${formatNumber(w.cpl_krw)}원` : '-')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <ChangeIndicator value={w.spend_change} />
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
                              <td className="px-3 py-1 text-right text-xs">{formatNumber(d.spend_krw)}원</td>
                              <td className="px-3 py-1 text-right text-xs">
                                {metricType === 'video' ? formatNumber(d.video_views || 0) : formatNumber(d.leads)}
                              </td>
                              <td className="px-3 py-1 text-right text-xs">
                                {metricType === 'video'
                                  ? (d.avg_watch_time ? `${d.avg_watch_time.toFixed(1)}` : '-')
                                  : (d.leads > 0 ? `${formatNumber(d.cpl_krw)}원` : '-')}
                              </td>
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
                        <td className="px-3 py-1 text-right text-xs">{formatNumber(d.spend_krw)}원</td>
                        <td className="px-3 py-1 text-right text-xs">
                          {metricType === 'video' ? formatNumber(d.video_views || 0) : formatNumber(d.leads)}
                        </td>
                        <td className="px-3 py-1 text-right text-xs">
                          {metricType === 'video'
                            ? (d.avg_watch_time ? `${d.avg_watch_time.toFixed(1)}` : '-')
                            : (d.leads > 0 ? `${formatNumber(d.cpl_krw)}원` : '-')}
                        </td>
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
                  <td className="px-3 py-2 text-right font-medium">{formatNumber(w.spend_krw)}원</td>
                  <td className="px-3 py-2 text-right">
                    {metricType === 'video' ? formatNumber(w.video_views || 0) : formatNumber(w.leads)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {metricType === 'video' ? '-' : (w.leads > 0 ? `${formatNumber(w.cpl_krw)}원` : '-')}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <ChangeIndicator value={w.spend_change} />
                  </td>
                </tr>
              ))}

              {/* 일별 뷰 - 월별로 그룹화하여 접기/펼치기 */}
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
                    impressions: days.reduce((sum, d) => sum + d.impressions, 0),
                    clicks: days.reduce((sum, d) => sum + d.clicks, 0),
                    spend_krw: days.reduce((sum, d) => sum + d.spend_krw, 0),
                    leads: days.reduce((sum, d) => sum + d.leads, 0),
                    video_views: days.reduce((sum, d) => sum + (d.video_views || 0), 0),
                  }
                }).sort((a, b) => b.month.localeCompare(a.month)) // 최신 월이 위로

                return monthSummaries.map((ms) => (
                  <Fragment key={ms.month}>
                    {/* 월별 헤더 행 (클릭하면 펼침/접힘) */}
                    <tr
                      className="bg-blue-50 hover:bg-blue-100 cursor-pointer"
                      onClick={() => toggleMonth(ms.month)}
                    >
                      <td className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-2">
                          {expandedMonths.has(ms.month) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                          <Calendar className="h-4 w-4 text-blue-600" />
                          {ms.month_label}
                          <span className="text-xs text-gray-400 ml-1">({ms.days.length}일)</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{formatNumber(ms.impressions)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatNumber(ms.clicks)}</td>
                      <td className="px-3 py-2 text-right">
                        {ms.impressions > 0 ? ((ms.clicks / ms.impressions) * 100).toFixed(2) : '0.00'}%
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-blue-600">{formatNumber(ms.spend_krw)}원</td>
                      <td className="px-3 py-2 text-right">
                        {metricType === 'video' ? formatNumber(ms.video_views) : formatNumber(ms.leads)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {metricType === 'video' ? '-' : (ms.leads > 0 ? `${formatNumber(Math.round(ms.spend_krw / ms.leads))}원` : '-')}
                      </td>
                      <td className="px-3 py-2"></td>
                    </tr>
                    {/* 해당 월의 일별 데이터 (펼쳤을 때만 표시) - 최신 날짜가 위로 */}
                    {expandedMonths.has(ms.month) && [...ms.days].sort((a, b) => b.date.localeCompare(a.date)).map((d) => (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td className="px-3 py-1 pl-10 text-gray-500 text-sm">{d.date}</td>
                        <td className="px-3 py-1 text-right text-sm">{formatNumber(d.impressions)}</td>
                        <td className="px-3 py-1 text-right text-sm">{formatNumber(d.clicks)}</td>
                        <td className="px-3 py-1 text-right text-sm">{d.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-1 text-right text-sm">{formatNumber(d.spend_krw)}원</td>
                        <td className="px-3 py-1 text-right text-sm">
                          {metricType === 'video' ? formatNumber(d.video_views || 0) : formatNumber(d.leads)}
                        </td>
                        <td className="px-3 py-1 text-right text-sm">
                          {metricType === 'video'
                            ? (d.avg_watch_time ? `${d.avg_watch_time.toFixed(1)}` : '-')
                            : (d.leads > 0 ? `${formatNumber(d.cpl_krw)}원` : '-')}
                        </td>
                        <td className="px-3 py-1"></td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              })()}

              {/* 전체 합계 행 */}
              {summary && daily.length > 0 && (
                <tr className="bg-[#FFF7E6] font-semibold border-t-2 border-[#F5A623]">
                  <td className="px-3 py-3 font-bold text-[#F5A623]">
                    전체 합계
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      ({summary.date_range.start} ~ {summary.date_range.end})
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-bold">{formatNumber(summary.total_impressions)}</td>
                  <td className="px-3 py-3 text-right font-bold">{formatNumber(summary.total_clicks)}</td>
                  <td className="px-3 py-3 text-right">{summary.avg_ctr.toFixed(2)}%</td>
                  <td className="px-3 py-3 text-right font-bold text-[#F5A623]">{formatNumber(summary.total_spend_krw)}원</td>
                  <td className="px-3 py-3 text-right">
                    {metricType === 'video' ? formatNumber(summary.total_video_views) : formatNumber(summary.total_leads)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {metricType === 'video' ? '-' : (summary.total_leads > 0 ? `${formatNumber(summary.avg_cpl_krw)}원` : '-')}
                  </td>
                  <td className="px-3 py-3"></td>
                </tr>
              )}

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
