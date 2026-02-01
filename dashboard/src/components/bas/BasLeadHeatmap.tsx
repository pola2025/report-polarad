'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Grid3X3, Info } from 'lucide-react'
import type { DailyLeadWithMeta } from '@/types/bas-leads'

interface BasLeadHeatmapProps {
  daily: DailyLeadWithMeta[]
}

interface HeatmapCell {
  date: string
  dayOfWeek: number // 0=월, 1=화, ..., 6=일
  dayLabel: string
  count: number
  spend?: number
  impressions?: number
}

interface WeekRow {
  weekLabel: string
  cells: (HeatmapCell | null)[] // 7 slots (월~일)
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

// 리드 건수 기반 블루 그라디언트
function cellColor(count: number, max: number): string {
  if (count === 0) return 'bg-gray-100 text-gray-300'
  const ratio = count / (max || 1)
  if (ratio >= 0.8) return 'bg-blue-700 text-white'
  if (ratio >= 0.6) return 'bg-blue-500 text-white'
  if (ratio >= 0.4) return 'bg-blue-400 text-white'
  if (ratio >= 0.2) return 'bg-blue-300 text-blue-900'
  return 'bg-blue-100 text-blue-800'
}

export function BasLeadHeatmap({ daily }: BasLeadHeatmapProps) {
  const { weeks, dayAverages, maxCount } = useMemo(() => {
    const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length === 0) return { weeks: [], dayAverages: [], maxCount: 0 }

    const dayBuckets: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    const weekMap = new Map<string, (HeatmapCell | null)[]>()

    sorted.forEach((d) => {
      const date = new Date(d.date + 'T00:00:00')
      const jsDay = date.getDay() // 0=일, 1=월, ...
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1 // 월=0, ..., 일=6

      // ISO 주차 계산
      const startOfYear = new Date(date.getFullYear(), 0, 1)
      const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
      const weekNum = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7)

      const cell: HeatmapCell = {
        date: d.date,
        dayOfWeek: dayIdx,
        dayLabel: `${d.date.slice(5)} (${DAY_HEADERS[dayIdx]})`,
        count: d.count,
        spend: d.spend,
        impressions: d.impressions,
      }

      const wKey = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
      if (!weekMap.has(wKey)) {
        weekMap.set(wKey, Array(7).fill(null))
      }
      weekMap.get(wKey)![dayIdx] = cell

      if (d.count > 0) {
        dayBuckets[dayIdx].push(d.count)
      }
    })

    const weekRows: WeekRow[] = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, cells]) => {
        // 주 라벨: 해당 주의 첫 번째 유효 셀 날짜에서 추출
        const firstCell = cells.find(c => c !== null)
        const label = firstCell ? firstCell.date.slice(5, 10) : ''
        return { weekLabel: label, cells }
      })

    const avgByDay = DAY_HEADERS.map((_, idx) => {
      const vals = dayBuckets[idx]
      if (vals.length === 0) return 0
      return vals.reduce((a, b) => a + b, 0) / vals.length
    })

    const allCounts = sorted.map(d => d.count).filter(v => v > 0)
    const mx = allCounts.length > 0 ? Math.max(...allCounts) : 0

    return { weeks: weekRows, dayAverages: avgByDay, maxCount: mx }
  }, [daily])

  const insightText = useMemo(() => {
    if (dayAverages.length === 0 || dayAverages.every(v => v === 0)) return ''

    const weekdayAvgs = dayAverages.slice(0, 5).filter(v => v > 0)
    const weekendAvgs = dayAverages.slice(5).filter(v => v > 0)
    const weekdayMean = weekdayAvgs.length > 0 ? weekdayAvgs.reduce((a, b) => a + b, 0) / weekdayAvgs.length : 0
    const weekendMean = weekendAvgs.length > 0 ? weekendAvgs.reduce((a, b) => a + b, 0) / weekendAvgs.length : 0

    const bestDayIdx = dayAverages.indexOf(Math.max(...dayAverages))
    const worstDayIdx = dayAverages.indexOf(Math.min(...dayAverages.filter(v => v > 0)))

    if (weekdayMean > 0 && weekendMean > 0) {
      const diff = Math.abs(((weekendMean - weekdayMean) / weekdayMean) * 100).toFixed(0)
      if (weekendMean > weekdayMean * 1.2) {
        return `주말 평균 리드 ${weekendMean.toFixed(1)}건으로 평일(${weekdayMean.toFixed(1)}건) 대비 ${diff}% 높습니다. ${DAY_HEADERS[bestDayIdx]}요일이 평균 ${dayAverages[bestDayIdx].toFixed(1)}건으로 최고 성과입니다.`
      }
      if (weekdayMean > weekendMean * 1.2) {
        return `평일 평균 리드 ${weekdayMean.toFixed(1)}건으로 주말(${weekendMean.toFixed(1)}건) 대비 ${diff}% 높습니다. ${DAY_HEADERS[bestDayIdx]}요일이 가장 활발합니다.`
      }
    }

    return `${DAY_HEADERS[bestDayIdx]}요일 평균 ${dayAverages[bestDayIdx].toFixed(1)}건으로 가장 많고, ${DAY_HEADERS[worstDayIdx]}요일 ${dayAverages[worstDayIdx].toFixed(1)}건으로 가장 적습니다.`
  }, [dayAverages])

  if (daily.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-6 space-y-4 lg:space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 lg:w-9 lg:h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Grid3X3 className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-sm lg:text-base">리드 접수 히트맵</h3>
          <p className="text-xs text-gray-400 hidden lg:block">요일별 x 주차별 리드 접수 패턴</p>
        </div>
      </div>

      {/* 히트맵 그리드 */}
      <div className="relative">
        {/* 요일 헤더 */}
        <div className="grid gap-1 lg:gap-1.5 mb-1" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
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
            key={`week-${wIdx}`}
            className="grid gap-1 lg:gap-1.5 mb-1 lg:mb-1.5"
            style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}
          >
            <div className="flex items-center justify-end pr-1 text-[10px] lg:text-xs text-gray-400 font-medium">
              {week.weekLabel}
            </div>
            {week.cells.map((cell, dIdx) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${wIdx}-${dIdx}`}
                    className="aspect-square rounded lg:rounded-lg bg-gray-50 flex items-center justify-center"
                  >
                    <span className="text-[8px] lg:text-[9px] text-gray-200">-</span>
                  </div>
                )
              }

              if (cell.count === 0) {
                return (
                  <div
                    key={`zero-${wIdx}-${dIdx}`}
                    className="aspect-square rounded lg:rounded-lg bg-gray-100 flex items-center justify-center"
                  >
                    <span className="text-[8px] lg:text-[9px] text-gray-300">0</span>
                  </div>
                )
              }

              const colorClass = cellColor(cell.count, maxCount)

              return (
                <motion.div
                  key={`cell-${wIdx}-${dIdx}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: wIdx * 0.04 + dIdx * 0.02 }}
                  className={`aspect-square rounded lg:rounded-lg ${colorClass} flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-110 hover:z-10 hover:shadow-lg relative group`}
                >
                  <span className="font-bold text-[9px] lg:text-xs">
                    {cell.count}
                  </span>

                  {/* 툴팁 */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white px-2.5 py-1.5 rounded-lg text-[10px] whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none shadow-lg">
                    <div className="font-medium">{cell.dayLabel}</div>
                    <div className="mt-0.5 space-y-0.5 text-gray-300">
                      <div>리드: {cell.count}건</div>
                      {cell.spend != null && <div>지출: {Math.round(cell.spend).toLocaleString()}원</div>}
                      {cell.impressions != null && <div>노출: {cell.impressions.toLocaleString()}회</div>}
                      {cell.spend != null && cell.count > 0 && (
                        <div>CPL: {Math.round(cell.spend / cell.count).toLocaleString()}원</div>
                      )}
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
          <span className="text-[10px] text-gray-400">적음</span>
          <div className="flex gap-0.5">
            {['bg-blue-100', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-700'].map((c, i) => (
              <div key={i} className={`w-4 lg:w-5 h-2.5 lg:h-3 ${c} rounded`} />
            ))}
          </div>
          <span className="text-[10px] text-gray-400">많음</span>
        </div>
        <div className="text-[10px] text-gray-400">리드 접수 건수 기준</div>
      </div>

      {/* 요일별 평균 */}
      <div className="grid grid-cols-7 gap-1 lg:gap-2">
        {dayAverages.map((avg, idx) => {
          if (avg === 0) return (
            <div key={idx} className="text-center bg-gray-50 rounded-lg py-1.5 lg:py-2 border border-gray-100">
              <div className="text-[9px] lg:text-[10px] text-gray-500">{DAY_HEADERS[idx]}</div>
              <div className="text-[11px] lg:text-sm font-bold text-gray-300">-</div>
            </div>
          )

          const isHigh = avg >= Math.max(...dayAverages) * 0.8
          const colorStyle = isHigh
            ? { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' }
            : { text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-100' }

          return (
            <div key={idx} className={`text-center ${colorStyle.bg} rounded-lg py-1.5 lg:py-2 border ${colorStyle.border}`}>
              <div className="text-[9px] lg:text-[10px] text-gray-500">{DAY_HEADERS[idx]}</div>
              <div className={`text-[11px] lg:text-sm font-bold ${colorStyle.text}`}>
                {avg.toFixed(1)}
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
          className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 lg:p-4 border border-blue-100"
        >
          <div className="flex items-start gap-2 lg:gap-3">
            <div className="w-6 h-6 lg:w-7 lg:h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Info className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-600" />
            </div>
            <div className="text-xs lg:text-sm text-blue-800">
              <span className="font-bold">Auto-Insight:</span> {insightText}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
