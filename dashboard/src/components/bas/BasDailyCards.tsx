'use client'

import type { AdAdjustment } from '@/types/ad-adjustments'
import { ADJUSTMENT_TYPE_CONFIG } from '@/types/ad-adjustments'

interface DailyData {
  date: string
  leads: number
  cpl: number
  spend: number
  clicks: number
}

interface BasDailyCardsProps {
  data: DailyData[]
  adjustments?: AdAdjustment[]
}

export function BasDailyCards({ data, adjustments = [] }: BasDailyCardsProps) {
  // 최근 7일만 표시
  const recentData = data.slice(-7)

  if (recentData.length === 0) return null

  // 최고/최저 일 찾기
  const maxLeadsDay = recentData.reduce((max, d) => (d.leads > max.leads ? d : max), recentData[0])
  const minLeadsDay = recentData
    .filter((d) => d.leads > 0)
    .reduce(
      (min, d) => (d.leads < min.leads ? d : min),
      recentData.find((d) => d.leads > 0) || recentData[0]
    )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">일별 성과 카드</h3>
        <span className="text-xs text-gray-500">최근 {recentData.length}일</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3">
        {recentData.map((day) => {
          const isMax = day.date === maxLeadsDay.date
          const isMin = day.date === minLeadsDay.date && day.leads > 0

          const dayAdjs = adjustments.filter((a) => a.date === day.date)

          return (
            <div
              key={day.date}
              className={`p-3 rounded-lg border transition-colors relative ${
                isMax
                  ? 'border-green-300 bg-green-50'
                  : isMin
                    ? 'border-amber-300 bg-amber-50'
                    : dayAdjs.length > 0
                      ? 'border-gray-200 bg-white ring-1 ring-offset-1'
                      : 'border-gray-100 bg-gray-50'
              }`}
              style={dayAdjs.length > 0 ? { '--tw-ring-color': ADJUSTMENT_TYPE_CONFIG[dayAdjs[0].type].color + '40' } as React.CSSProperties : undefined}
            >
              {/* 조정일 뱃지 */}
              {dayAdjs.length > 0 && (
                <div className="flex flex-col gap-0.5 mb-1.5">
                  {dayAdjs.map((adj) => {
                    const cfg = ADJUSTMENT_TYPE_CONFIG[adj.type]
                    return (
                      <span
                        key={adj.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded ${cfg.bgClass} ${cfg.textClass} border ${cfg.borderClass} leading-none`}
                        title={`${cfg.label}: ${adj.description}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                        {cfg.shortLabel}
                      </span>
                    )
                  })}
                </div>
              )}
              <div className="text-xs text-gray-500 mb-1">
                {day.date.slice(5)}
                <span className="text-gray-400 ml-0.5">
                  {'일월화수목금토'[new Date(day.date).getDay()]}
                </span>
                {isMax && <span className="ml-1 text-green-600">최고</span>}
                {isMin && <span className="ml-1 text-amber-600">최저</span>}
              </div>
              <div className="text-lg font-bold text-gray-900">{day.leads}건</div>
              <div className="text-xs text-gray-500 mt-0.5">
                ${Math.round(day.cpl).toLocaleString('en-US')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
