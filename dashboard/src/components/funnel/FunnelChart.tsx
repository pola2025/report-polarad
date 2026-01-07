'use client'

/**
 * 퍼널 차트 컴포넌트
 * 마케팅 퍼널 단계별 전환 시각화
 */

import { useMemo } from 'react'
import type { FunnelStage } from '@/types/ga4-analytics'

interface FunnelChartProps {
  stages: FunnelStage[]
  height?: number
}

export function FunnelChart({ stages, height = 300 }: FunnelChartProps) {
  const maxValue = useMemo(() => {
    return Math.max(...stages.map(s => s.value), 1)
  }, [stages])

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        퍼널 데이터가 없습니다
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex flex-col gap-2 h-full justify-center">
        {stages.map((stage, index) => {
          const widthPercent = Math.max((stage.value / maxValue) * 100, 10)
          const nextStage = stages[index + 1]
          const dropRate = nextStage
            ? Math.round((1 - nextStage.value / Math.max(stage.value, 1)) * 100)
            : null

          return (
            <div key={stage.name} className="relative">
              {/* 퍼널 바 */}
              <div className="flex items-center gap-4">
                {/* 단계명 */}
                <div className="w-24 text-sm font-medium text-gray-700 text-right">
                  {stage.name}
                </div>

                {/* 바 */}
                <div className="flex-1 relative">
                  <div
                    className="h-12 rounded-lg flex items-center justify-between px-4 transition-all duration-500"
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: stage.color || '#3B82F6',
                      minWidth: '120px',
                    }}
                  >
                    <span className="text-white font-semibold text-lg">
                      {stage.value.toLocaleString()}
                    </span>
                    <span className="text-white/80 text-sm">
                      {stage.rate}%
                    </span>
                  </div>

                  {/* 이탈율 표시 */}
                  {dropRate !== null && dropRate > 0 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-2">
                      <span className="text-xs text-red-500 font-medium">
                        -{dropRate}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 화살표 (마지막 단계 제외) */}
              {index < stages.length - 1 && (
                <div className="flex items-center gap-4 h-4">
                  <div className="w-24" />
                  <div className="flex-1 flex justify-start pl-8">
                    <svg
                      width="20"
                      height="16"
                      viewBox="0 0 20 16"
                      fill="none"
                      className="text-gray-300"
                    >
                      <path
                        d="M10 0L20 8L10 16V10H0V6H10V0Z"
                        fill="currentColor"
                        transform="rotate(90 10 8)"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 컴팩트 버전 (대시보드 KPI용)
export function FunnelChartCompact({ stages }: { stages: FunnelStage[] }) {
  const maxValue = useMemo(() => {
    return Math.max(...stages.map(s => s.value), 1)
  }, [stages])

  if (stages.length === 0) return null

  return (
    <div className="flex items-end gap-1 h-16">
      {stages.map((stage) => {
        const heightPercent = Math.max((stage.value / maxValue) * 100, 15)

        return (
          <div
            key={stage.name}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <div
              className="w-full rounded-t transition-all duration-300"
              style={{
                height: `${heightPercent}%`,
                backgroundColor: stage.color || '#3B82F6',
                minHeight: '8px',
              }}
            />
            <span className="text-[10px] text-gray-500 truncate w-full text-center">
              {stage.name.charAt(0)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
