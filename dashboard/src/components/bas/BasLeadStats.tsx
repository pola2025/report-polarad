'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Calendar,
} from 'lucide-react'
import type { BasLeadTrends, CampaignPerformance } from '@/types/bas-leads'
import { BasLeadHeatmap } from './BasLeadHeatmap'

// KST 기준 n일전 날짜
function daysAgoStr(n: number): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  kst.setDate(kst.getDate() - n)
  return kst.toISOString().split('T')[0]
}

function todayStr(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

type QuickPreset = '7d' | '30d' | '90d'

export function BasLeadStats() {
  const [trends, setTrends] = useState<BasLeadTrends | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCampaigns, setShowCampaigns] = useState(false)

  // 날짜 필터 state (로컬 관리, URL params X)
  const [activePreset, setActivePreset] = useState<QuickPreset>('30d')
  const [startDate, setStartDate] = useState(daysAgoStr(29))
  const [endDate, setEndDate] = useState(todayStr())
  const [draftStart, setDraftStart] = useState(daysAgoStr(29))
  const [draftEnd, setDraftEnd] = useState(todayStr())

  const fetchTrends = useCallback(async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bas/leads/trends?startDate=${start}&endDate=${end}`)
      const data = await res.json()
      if (!data.error) setTrends(data)
    } catch (e) {
      console.error('Failed to fetch trends:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // 초기 로딩
  useEffect(() => {
    fetchTrends(startDate, endDate)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (preset: QuickPreset) => {
    const days = preset === '7d' ? 6 : preset === '30d' ? 29 : 89
    const newStart = daysAgoStr(days)
    const newEnd = todayStr()
    setActivePreset(preset)
    setStartDate(newStart)
    setEndDate(newEnd)
    setDraftStart(newStart)
    setDraftEnd(newEnd)
    fetchTrends(newStart, newEnd)
  }

  const applyCustomRange = () => {
    setActivePreset(
      draftStart === daysAgoStr(6) && draftEnd === todayStr() ? '7d'
      : draftStart === daysAgoStr(29) && draftEnd === todayStr() ? '30d'
      : draftStart === daysAgoStr(89) && draftEnd === todayStr() ? '90d'
      : '30d' // fallback
    )
    setStartDate(draftStart)
    setEndDate(draftEnd)
    fetchTrends(draftStart, draftEnd)
  }

  const isDirty = draftStart !== startDate || draftEnd !== endDate

  if (loading && !trends) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">통계 불러오는 중...</span>
        </div>
      </div>
    )
  }

  if (!trends) return null

  const periodLabel = activePreset === '7d' ? '최근 7일'
    : activePreset === '30d' ? '최근 30일'
    : activePreset === '90d' ? '최근 90일'
    : `${startDate} ~ ${endDate}`

  return (
    <div className="space-y-4">
      {/* 날짜 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
          {/* 퀵 프리셋 */}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-500 flex-shrink-0">기간:</span>
            <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
              {(['7d', '30d', '90d'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activePreset === preset && !isDirty
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {preset === '7d' ? '7일' : preset === '30d' ? '30일' : '90일'}
                </button>
              ))}
            </div>
          </div>

          {/* 커스텀 날짜 */}
          <div className="flex items-center gap-1 w-full sm:w-auto">
            <input
              type="date"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="flex-1 sm:flex-none px-2 py-1.5 text-xs border border-gray-200 rounded-md min-w-0"
            />
            <span className="text-xs text-gray-400 flex-shrink-0">~</span>
            <input
              type="date"
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="flex-1 sm:flex-none px-2 py-1.5 text-xs border border-gray-200 rounded-md min-w-0"
            />
            <button
              onClick={applyCustomRange}
              disabled={!isDirty}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex-shrink-0 ${
                isDirty
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Search className="h-3 w-3" />
              조회
            </button>
          </div>
        </div>
      </div>

      {/* KPI 변화율 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ChangeCard
          label="최근 7일"
          value={trends.weekly_change.current_week}
          prev={trends.weekly_change.previous_week}
          rate={trends.weekly_change.change_rate}
          unit="건"
        />
        <ChangeCard
          label="최근 30일"
          value={trends.monthly_change.current_week}
          prev={trends.monthly_change.previous_week}
          rate={trends.monthly_change.change_rate}
          unit="건"
        />
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">일평균 접수</p>
          <p className="text-xl font-bold text-gray-900">
            {trends.avg_daily}<span className="text-sm font-normal text-gray-400 ml-1">건/일</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">유효 리드</p>
          <p className="text-xl font-bold text-gray-900">
            {trends.total_valid.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">건</span>
          </p>
        </div>
      </div>

      {/* 일별 접수 추이 차트 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">일별 접수 추이 ({periodLabel})</h3>
          {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
        </div>
        <DailyChart daily={trends.daily} />
      </div>

      {/* 리드 히트맵 */}
      {trends.daily_enriched && trends.daily_enriched.length > 0 && (
        <BasLeadHeatmap daily={trends.daily_enriched} />
      )}

      {/* 캠페인 성과 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setShowCampaigns(!showCampaigns)}
          className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              캠페인 성과 ({trends.campaigns.length}개)
            </h3>
          </div>
          {showCampaigns
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>
        {showCampaigns && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <CampaignTable campaigns={trends.campaigns} />
          </div>
        )}
      </div>
    </div>
  )
}

// === 변화율 카드 ===
function ChangeCard({
  label,
  value,
  prev,
  rate,
  unit,
}: {
  label: string
  value: number
  prev: number
  rate: number
  unit: string
}) {
  const isUp = rate > 0
  const isDown = rate < 0
  const isFlat = rate === 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-xl font-bold text-gray-900">
          {value}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
        </p>
      </div>
      <div className="flex items-center gap-1 mt-1.5">
        {isUp && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />}
        {isDown && <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
        {isFlat && <Minus className="w-3.5 h-3.5 text-gray-400" />}
        <span className={`text-xs font-medium ${
          isUp ? 'text-emerald-600' : isDown ? 'text-red-600' : 'text-gray-400'
        }`}>
          {isUp ? '+' : ''}{rate}%
        </span>
        <span className="text-xs text-gray-400">
          vs 이전 ({prev}{unit})
        </span>
      </div>
    </div>
  )
}

// === 일별 바 차트 (고정 px 높이, 색상 계층화) ===
function DailyChart({ daily }: { daily: BasLeadTrends['daily'] }) {
  const maxCount = Math.max(...daily.map(d => d.count), 1)
  const CHART_H = 160 // 차트 영역 고정 높이 px
  const BAR_MIN = 20  // 1건 이상일 때 최소 바 높이 px

  // 건수 기반 색상 (진한색=많은날, 옅은색=적은날)
  function barColor(count: number, isToday: boolean, isWeekend: boolean): string {
    if (isToday) return 'bg-blue-500'
    if (count === 0) return 'bg-gray-100'
    const ratio = count / maxCount
    if (isWeekend) {
      return ratio > 0.6 ? 'bg-blue-400' : ratio > 0.3 ? 'bg-blue-300' : 'bg-blue-200'
    }
    return ratio > 0.6 ? 'bg-blue-600' : ratio > 0.3 ? 'bg-blue-400' : 'bg-blue-300'
  }

  return (
    <div className="space-y-2">
      {/* Y축 최대값 표시 */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">최대 {maxCount}건</span>
        <span className="text-[10px] text-gray-400">
          합계 {daily.reduce((s, d) => s + d.count, 0)}건 / {daily.length}일
        </span>
      </div>

      {/* 차트 */}
      <div className="relative" style={{ height: `${CHART_H}px` }}>
        {/* 가로 기준선 */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2].map(i => (
            <div key={i} className="border-t border-dashed border-gray-100 w-full" />
          ))}
        </div>

        {/* 바 영역 */}
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {daily.map((d, i) => {
            const barH = d.count > 0
              ? Math.max(BAR_MIN, Math.round((d.count / maxCount) * (CHART_H - 20)))
              : 4
            const isToday = i === daily.length - 1
            const isWeekend = [0, 6].includes(new Date(d.date + 'T00:00:00').getDay())
            const dayNames = ['일','월','화','수','목','금','토']
            const dayName = dayNames[new Date(d.date + 'T00:00:00').getDay()]

            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center justify-end group cursor-pointer relative"
                style={{ height: '100%' }}
              >
                {/* 숫자 라벨 - 항상 표시 (0은 제외) */}
                {d.count > 0 && (
                  <span className={`text-[10px] font-semibold mb-0.5 ${
                    isToday ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {d.count}
                  </span>
                )}

                {/* 바 */}
                <div
                  className={`w-full rounded-t transition-all ${barColor(d.count, isToday, isWeekend)} group-hover:brightness-75`}
                  style={{ height: `${barH}px` }}
                />

                {/* 툴팁 */}
                <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 pointer-events-none">
                  <div className="bg-gray-900 text-white text-[10px] rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                    <p className="font-medium">{d.date.slice(5)} ({dayName})</p>
                    <p className="mt-0.5">{d.count}건 접수</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* X축 라벨 */}
      <div className="flex items-center gap-[3px]">
        {daily.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % 7 === 0 || i === daily.length - 1 ? (
              <span className="text-[10px] text-gray-400">
                {d.date.slice(5)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

// === 캠페인 성과 테이블 ===
function CampaignTable({ campaigns }: { campaigns: CampaignPerformance[] }) {
  // 미지정 제외한 상위 캠페인
  const sorted = campaigns.filter(c => c.campaign !== '(미지정)')

  if (sorted.length === 0) {
    return <p className="text-sm text-gray-400">캠페인 데이터가 없습니다.</p>
  }

  const maxTotal = Math.max(...sorted.map(c => c.total))

  return (
    <div className="space-y-3">
      {/* 헤더 - 데스크탑만 */}
      <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] text-gray-400 font-medium uppercase tracking-wider px-1">
        <div className="col-span-4">캠페인</div>
        <div className="col-span-2 text-right">접수량</div>
        <div className="col-span-2 text-right">통화율</div>
        <div className="col-span-2 text-right">전환율</div>
        <div className="col-span-1 text-right">7일</div>
        <div className="col-span-1 text-center">추세</div>
      </div>

      {sorted.map(c => (
        <div key={c.campaign} className="group">
          {/* 모바일 */}
          <div className="sm:hidden space-y-1.5 border border-gray-100 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-900 truncate max-w-[200px]">
                {c.campaign}
              </span>
              <TrendIcon trend={c.trend} />
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-gray-600">{c.total}건</span>
              <span className="text-blue-600">통화 {c.call_rate}%</span>
              <span className="text-emerald-600">전환 {c.conversion_rate}%</span>
              <span className="text-gray-400">7일: {c.recent_7d}</span>
            </div>
            {/* 비율 바 */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all"
                style={{ width: `${(c.total / maxTotal) * 100}%` }}
              />
            </div>
          </div>

          {/* 데스크탑 */}
          <div className="hidden sm:grid grid-cols-12 gap-2 items-center px-1 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="col-span-4 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-gray-900 truncate block" title={c.campaign}>
                  {c.campaign}
                </span>
                {/* 비율 바 */}
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-blue-300 rounded-full"
                    style={{ width: `${(c.total / maxTotal) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="col-span-2 text-right">
              <span className="text-xs font-semibold text-gray-900">{c.total}</span>
            </div>
            <div className="col-span-2 text-right">
              <span className={`text-xs font-medium ${c.call_rate >= 50 ? 'text-blue-600' : 'text-gray-500'}`}>
                {c.call_rate}%
              </span>
            </div>
            <div className="col-span-2 text-right">
              <span className={`text-xs font-medium ${
                c.conversion_rate >= 5 ? 'text-emerald-600' :
                c.conversion_rate > 0 ? 'text-amber-600' : 'text-gray-400'
              }`}>
                {c.conversion_rate}%
              </span>
            </div>
            <div className="col-span-1 text-right">
              <span className="text-xs text-gray-500">{c.recent_7d}</span>
            </div>
            <div className="col-span-1 flex justify-center">
              <TrendIcon trend={c.trend} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  return <Minus className="w-3.5 h-3.5 text-gray-300" />
}
