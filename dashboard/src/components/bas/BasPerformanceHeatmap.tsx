'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Grid3X3, Info } from 'lucide-react'
import type { MetaDailyData } from '@/types/meta-analytics'

interface BasPerformanceHeatmapProps {
  daily: MetaDailyData[]
}

type MetricType = 'cpl' | 'leads' | 'ctr' | 'spend'

interface HeatmapCell {
  date: string
  dayOfWeek: number // 0=일, 1=월, ..., 6=토
  dayLabel: string
  value: number
  leads: number
  spend: number
  cpl: number
  ctr: number
}

interface WeekRow {
  weekLabel: string
  cells: (HeatmapCell | null)[] // 7 slots (월~일)
}

const METRIC_CONFIG: Record<MetricType, {
  label: string
  format: (v: number) => string
  colorFn: (v: number, min: number, max: number) => string
  invertScale: boolean
  unit: string
}> = {
  cpl: {
    label: 'CPL (리드당 비용)',
    format: (v) => `$${v.toFixed(0)}`,
    invertScale: true, // 녹=좋음=낮음, 적=나쁨=높음
    unit: '$',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    colorFn: (v, _min, _max) => {
      if (v === 0) return 'bg-gray-100 text-gray-300'
      if (v <= 12) return 'bg-green-100 text-green-800'
      if (v <= 15) return 'bg-green-200 text-green-800'
      if (v <= 18) return 'bg-green-300 text-green-800'
      if (v <= 20) return 'bg-amber-100 text-amber-700'
      if (v <= 23) return 'bg-amber-200 text-amber-800'
      if (v <= 26) return 'bg-red-200 text-red-700'
      if (v <= 30) return 'bg-red-300 text-red-800'
      return 'bg-red-400 text-white'
    },
  },
  leads: {
    label: '리드 수',
    format: (v) => `${v}`,
    invertScale: false, // 녹=좋음=많음, 적=나쁨=적음
    unit: '건',
    colorFn: (v, min, max) => {
      if (v === 0) return 'bg-gray-100 text-gray-300'
      const range = max - min || 1
      const ratio = (v - min) / range
      if (ratio >= 0.75) return 'bg-green-300 text-green-800'
      if (ratio >= 0.5) return 'bg-green-200 text-green-800'
      if (ratio >= 0.25) return 'bg-amber-200 text-amber-800'
      return 'bg-red-200 text-red-700'
    },
  },
  ctr: {
    label: 'CTR',
    format: (v) => `${v.toFixed(1)}%`,
    invertScale: false,
    unit: '%',
    colorFn: (v, min, max) => {
      if (v === 0) return 'bg-gray-100 text-gray-300'
      const range = max - min || 1
      const ratio = (v - min) / range
      if (ratio >= 0.75) return 'bg-green-300 text-green-800'
      if (ratio >= 0.5) return 'bg-green-200 text-green-800'
      if (ratio >= 0.25) return 'bg-amber-200 text-amber-800'
      return 'bg-red-200 text-red-700'
    },
  },
  spend: {
    label: '지출',
    format: (v) => `$${v.toFixed(0)}`,
    invertScale: false,
    unit: '$',
    colorFn: (v, min, max) => {
      if (v === 0) return 'bg-gray-100 text-gray-300'
      const range = max - min || 1
      const ratio = (v - min) / range
      if (ratio >= 0.75) return 'bg-purple-300 text-purple-800'
      if (ratio >= 0.5) return 'bg-purple-200 text-purple-800'
      if (ratio >= 0.25) return 'bg-blue-200 text-blue-800'
      return 'bg-blue-100 text-blue-700'
    },
  },
}

const DAY_HEADERS = ['월', '화', '수', '목', '금', '토', '일']
const DAY_HEADER_COLORS = [
  'text-gray-500',
  'text-gray-500',
  'text-gray-500',
  'text-gray-500',
  'text-gray-500',
  'text-blue-500',
  'text-red-500',
]

export function BasPerformanceHeatmap({ daily }: BasPerformanceHeatmapProps) {
  const [metric, setMetric] = useState<MetricType>('cpl')
  const [, setHoveredCell] = useState<HeatmapCell | null>(null)

  const config = METRIC_CONFIG[metric]

  // 데이터를 주차×요일 그리드로 변환
  const { weeks, dayAverages, minVal, maxVal } = useMemo(() => {
    const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length === 0) return { weeks: [], dayAverages: [], minVal: 0, maxVal: 0 }

    // 요일별 집계
    const dayBuckets: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

    // 주차별 그룹핑
    const weekMap = new Map<string, (HeatmapCell | null)[]>()

    sorted.forEach((d) => {
      const date = new Date(d.date)
      const jsDay = date.getDay() // 0=일, 1=월, ...
      // 월~일 인덱스로 변환 (월=0, 화=1, ..., 일=6)
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1

      // 월요일 기준 주차 계산 (일요일은 앞 주에 포함)
      const adjusted = new Date(date.getTime())
      if (adjusted.getDay() === 0) adjusted.setDate(adjusted.getDate() - 1)
      const startOfYear = new Date(adjusted.getFullYear(), 0, 1)
      const dayOfYear = Math.floor((adjusted.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
      const weekNum = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7)
      const weekKey = `W${weekNum}`

      const getValue = (item: MetaDailyData): number => {
        switch (metric) {
          case 'cpl': return item.leads > 0 ? item.spend / item.leads : 0
          case 'leads': return item.leads
          case 'ctr': return item.ctr
          case 'spend': return item.spend
        }
      }

      const val = getValue(d)
      const cell: HeatmapCell = {
        date: d.date,
        dayOfWeek: dayIdx,
        dayLabel: `${d.date.slice(5)} (${DAY_HEADERS[dayIdx]})`,
        value: val,
        leads: d.leads,
        spend: d.spend,
        cpl: d.leads > 0 ? d.spend / d.leads : 0,
        ctr: d.ctr,
      }

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, Array(7).fill(null))
      }
      weekMap.get(weekKey)![dayIdx] = cell

      if (val > 0) {
        dayBuckets[dayIdx].push(val)
      }
    })

    const weekRows: WeekRow[] = Array.from(weekMap.entries()).map(([label, cells]) => ({
      weekLabel: label,
      cells,
    }))

    // 요일별 평균
    const avgByDay = DAY_HEADERS.map((_, idx) => {
      const vals = dayBuckets[idx]
      if (vals.length === 0) return 0
      return vals.reduce((a, b) => a + b, 0) / vals.length
    })

    // min/max 계산 (0 제외)
    const allValues = sorted
      .map((d) => {
        switch (metric) {
          case 'cpl': return d.leads > 0 ? d.spend / d.leads : 0
          case 'leads': return d.leads
          case 'ctr': return d.ctr
          case 'spend': return d.spend
        }
      })
      .filter((v) => v > 0)

    return {
      weeks: weekRows,
      dayAverages: avgByDay,
      minVal: allValues.length > 0 ? Math.min(...allValues) : 0,
      maxVal: allValues.length > 0 ? Math.max(...allValues) : 0,
    }
  }, [daily, metric])

  // Auto-Insight 생성
  const insightText = useMemo(() => {
    if (dayAverages.length === 0) return ''

    const weekdayAvgs = dayAverages.slice(0, 5).filter((v) => v > 0)
    const weekendAvgs = dayAverages.slice(5).filter((v) => v > 0)
    const weekdayMean = weekdayAvgs.length > 0 ? weekdayAvgs.reduce((a, b) => a + b, 0) / weekdayAvgs.length : 0
    const weekendMean = weekendAvgs.length > 0 ? weekendAvgs.reduce((a, b) => a + b, 0) / weekendAvgs.length : 0

    if (metric === 'cpl' && weekdayMean > 0 && weekendMean > 0) {
      const diff = ((weekendMean - weekdayMean) / weekdayMean * 100).toFixed(0)
      const bestDayIdx = dayAverages.indexOf(Math.min(...dayAverages.filter((v) => v > 0)))
      const bestDay = DAY_HEADERS[bestDayIdx] || '화'
      const bestVal = dayAverages[bestDayIdx] || 0

      if (weekendMean > weekdayMean) {
        return `주말(토~일) CPL 평균 $${weekendMean.toFixed(1)}로 평일 평균 $${weekdayMean.toFixed(1)} 대비 ${diff}% 높습니다. ${bestDay}요일이 CPL $${bestVal.toFixed(1)}로 가장 효율적입니다. 주말 예산을 50% 축소하고 ${bestDay}~수요일에 집중 배분하면 월 CPL을 약 $3 절감할 수 있습니다.`
      }
      return `주말과 평일 CPL 차이가 크지 않습니다. 전체적으로 균일한 성과를 보이고 있습니다.`
    }

    if (metric === 'leads') {
      const bestDayIdx = dayAverages.indexOf(Math.max(...dayAverages))
      const worstDayIdx = dayAverages.indexOf(Math.min(...dayAverages.filter((v) => v > 0)))
      return `${DAY_HEADERS[bestDayIdx]}요일 평균 리드 ${dayAverages[bestDayIdx].toFixed(1)}건으로 가장 성과가 좋고, ${DAY_HEADERS[worstDayIdx]}요일 ${dayAverages[worstDayIdx].toFixed(1)}건으로 가장 낮습니다.`
    }

    return `선택한 지표(${config.label})의 요일별 패턴을 확인하세요.`
  }, [dayAverages, metric, config.label])

  // 범례 생성
  const legendItems = useMemo(() => {
    if (metric === 'cpl') {
      return {
        leftLabel: '낮음 (좋음)',
        rightLabel: '높음 (나쁨)',
        colors: ['bg-green-100', 'bg-green-200', 'bg-green-300', 'bg-amber-200', 'bg-amber-300', 'bg-red-200', 'bg-red-300', 'bg-red-400'],
        description: 'CPL 기준: 녹 = $0~$15 | 황 = $15~$20 | 적 = $20+',
      }
    }
    if (metric === 'leads') {
      return {
        leftLabel: '적음',
        rightLabel: '많음 (좋음)',
        colors: ['bg-red-200', 'bg-amber-200', 'bg-green-200', 'bg-green-300'],
        description: '상대적 분포 기준',
      }
    }
    if (metric === 'ctr') {
      return {
        leftLabel: '낮음',
        rightLabel: '높음 (좋음)',
        colors: ['bg-red-200', 'bg-amber-200', 'bg-green-200', 'bg-green-300'],
        description: '상대적 분포 기준',
      }
    }
    return {
      leftLabel: '적음',
      rightLabel: '많음',
      colors: ['bg-blue-100', 'bg-blue-200', 'bg-purple-200', 'bg-purple-300'],
      description: '상대적 분포 기준',
    }
  }, [metric])

  if (daily.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-6 space-y-4 lg:space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 lg:w-9 lg:h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Grid3X3 className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm lg:text-base">성과 히트맵</h3>
            <p className="text-xs text-gray-400 hidden lg:block">요일별 x 주차별 성과 패턴 분석</p>
          </div>
        </div>
      </div>

      {/* 지표 전환 버튼 */}
      <div className="flex gap-1.5 lg:gap-2 flex-wrap">
        {(Object.keys(METRIC_CONFIG) as MetricType[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[11px] lg:text-xs font-semibold transition-all ${
              metric === m
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {m === 'cpl' ? 'CPL' : m === 'leads' ? '리드' : m === 'ctr' ? 'CTR' : '지출'}
          </button>
        ))}
      </div>

      {/* 히트맵 그리드 */}
      <div className="relative">
        {/* 요일 헤더 */}
        <div className="grid gap-1 lg:gap-1.5 mb-1" style={{ gridTemplateColumns: '32px repeat(7, 1fr)' }}>
          <div />
          {DAY_HEADERS.map((day, idx) => (
            <div
              key={day}
              className={`text-center text-[10px] lg:text-xs font-medium py-1 ${DAY_HEADER_COLORS[idx]}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 주차별 행 */}
        {weeks.map((week, wIdx) => (
          <div
            key={week.weekLabel}
            className="grid gap-1 lg:gap-1.5 mb-1 lg:mb-1.5"
            style={{ gridTemplateColumns: '32px repeat(7, 1fr)' }}
          >
            <div className="flex items-center justify-end pr-1 text-[10px] lg:text-xs text-gray-400 font-medium">
              {week.weekLabel}
            </div>
            {week.cells.map((cell, dIdx) => {
              if (!cell || cell.value === 0) {
                return (
                  <div
                    key={`${week.weekLabel}-${dIdx}`}
                    className="aspect-square rounded lg:rounded-lg bg-gray-100 flex items-center justify-center"
                  >
                    <span className="text-[8px] lg:text-[9px] text-gray-300">-</span>
                  </div>
                )
              }

              const colorClass = config.colorFn(cell.value, minVal, maxVal)

              return (
                <motion.div
                  key={`${week.weekLabel}-${dIdx}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: wIdx * 0.05 + dIdx * 0.02 }}
                  className={`aspect-square rounded lg:rounded-lg ${colorClass} flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-110 hover:z-10 hover:shadow-lg relative group`}
                  onMouseEnter={() => setHoveredCell(cell)}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  <span className="font-bold text-[8px] lg:text-xs">
                    {config.format(cell.value)}
                  </span>

                  {/* 툴팁 */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white px-2.5 py-1.5 rounded-lg text-[10px] whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none shadow-lg">
                    <div className="font-medium">{cell.dayLabel}</div>
                    <div className="mt-0.5 space-y-0.5 text-gray-300">
                      <div>CPL: ${cell.cpl.toFixed(1)}</div>
                      <div>리드: {cell.leads}건</div>
                      <div>지출: ${cell.spend.toFixed(0)}</div>
                      <div>CTR: {cell.ctr.toFixed(2)}%</div>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                  </div>
                </motion.div>
              )
            })}
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400">{legendItems.leftLabel}</span>
          <div className="flex gap-0.5">
            {legendItems.colors.map((c, i) => (
              <div key={i} className={`w-4 lg:w-5 h-2.5 lg:h-3 ${c} rounded`} />
            ))}
          </div>
          <span className="text-[10px] text-gray-400">{legendItems.rightLabel}</span>
        </div>
        <div className="text-[10px] text-gray-400">{legendItems.description}</div>
      </div>

      {/* 요일별 평균 요약 */}
      <div className="grid grid-cols-7 gap-1 lg:gap-2">
        {dayAverages.map((avg, idx) => {
          if (avg === 0) return (
            <div key={idx} className="text-center bg-gray-50 rounded-lg py-1.5 lg:py-2 border border-gray-100">
              <div className="text-[9px] lg:text-[10px] text-gray-500">{DAY_HEADERS[idx]}</div>
              <div className="text-[11px] lg:text-sm font-bold text-gray-300">-</div>
            </div>
          )

          const avgColor = (() => {
            if (metric === 'cpl') {
              if (avg <= 15) return { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-100' }
              if (avg <= 20) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' }
              return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' }
            }
            return { text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-100' }
          })()

          return (
            <div key={idx} className={`text-center ${avgColor.bg} rounded-lg py-1.5 lg:py-2 border ${avgColor.border}`}>
              <div className="text-[9px] lg:text-[10px] text-gray-500">{DAY_HEADERS[idx]}</div>
              <div className={`text-[11px] lg:text-sm font-bold ${avgColor.text}`}>
                {config.format(avg)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Auto-Insight */}
      {insightText && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-3 lg:p-4 border border-emerald-100"
        >
          <div className="flex items-start gap-2 lg:gap-3">
            <div className="w-6 h-6 lg:w-7 lg:h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Info className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-emerald-600" />
            </div>
            <div className="text-xs lg:text-sm text-emerald-800">
              <span className="font-bold">Auto-Insight:</span> {insightText}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
