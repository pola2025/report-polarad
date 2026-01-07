'use client'

import { formatNumber, formatPercent } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Tooltip,
} from 'recharts'
import type { BulletChartData } from '@/types/ga4-analytics'

interface BulletChartProps {
  data: BulletChartData[]
  height?: number
}

// 포맷 함수 선택
const getFormatter = (format: BulletChartData['format']) => {
  switch (format) {
    case 'percent':
      return (v: number) => formatPercent(v, 1)
    case 'currency':
      return (v: number) => `₩${formatNumber(Math.round(v))}`
    case 'duration':
      return (v: number) => {
        const minutes = Math.floor(v / 60)
        const seconds = Math.round(v % 60)
        return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`
      }
    default:
      return (v: number) => formatNumber(Math.round(v))
  }
}

// 증감률 계산
const calculateChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

// 커스텀 툴팁
interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: { label: string; current: number; previous: number; format?: BulletChartData['format'] } }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload
  const formatter = getFormatter(data.format)
  const change = calculateChange(data.current, data.previous)
  const isPositive = data.format === 'percent' && data.label.includes('이탈률')
    ? change < 0
    : change > 0

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-gray-900 mb-2">{data.label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-blue-600">현재</span>
          <span className="font-semibold text-blue-700">{formatter(data.current)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-500">이전</span>
          <span className="font-medium text-gray-600">{formatter(data.previous)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm pt-1 border-t">
          <span className="text-gray-500">변화</span>
          <span className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

export function BulletChart({ data, height = 300 }: BulletChartProps) {
  // 차트 데이터 변환
  const chartData = data.map((item) => {
    const change = calculateChange(item.current, item.previous)
    // 이탈률은 낮을수록 좋음
    const isPositive = item.format === 'percent' && item.label.includes('이탈률')
      ? change < 0
      : change > 0

    return {
      ...item,
      change,
      isPositive,
      // 비율 계산 (이전 값을 100%로)
      currentRatio: item.previous > 0 ? (item.current / item.previous) * 100 : 100,
      previousRatio: 100,
    }
  })

  // Y축 레이블을 위한 최대 값 계산
  const maxRatio = Math.max(...chartData.map(d => d.currentRatio), 100) * 1.1

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
          barGap={-30}
        >
          <XAxis
            type="number"
            domain={[0, maxRatio]}
            tickFormatter={(v) => `${Math.round(v)}%`}
            fontSize={11}
            axisLine={{ stroke: '#E5E7EB' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={90}
            fontSize={12}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#374151' }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* 기준선 (100% = 이전 기간) */}
          <ReferenceLine x={100} stroke="#9CA3AF" strokeDasharray="5 5" />

          {/* 이전 기간 (배경 막대) */}
          <Bar
            dataKey="previousRatio"
            fill="#E5E7EB"
            radius={[0, 4, 4, 0]}
            barSize={24}
          />

          {/* 현재 기간 (전경 막대) */}
          <Bar
            dataKey="currentRatio"
            radius={[0, 4, 4, 0]}
            barSize={16}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isPositive ? '#10B981' : '#EF4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-gray-200 rounded-sm"></div>
          <span>이전 기간</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
          <span>증가</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
          <span>감소</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 border-t-2 border-dashed border-gray-400"></div>
          <span>기준선 (100%)</span>
        </div>
      </div>
    </div>
  )
}

// 데이터 요약 카드와 함께 표시
interface BulletChartWithSummaryProps {
  data: BulletChartData[]
}

export function BulletChartWithSummary({ data }: BulletChartWithSummaryProps) {
  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.map((item) => {
          const formatter = getFormatter(item.format)
          const change = calculateChange(item.current, item.previous)
          const isPositive = item.format === 'percent' && item.label.includes('이탈률')
            ? change < 0
            : change > 0

          return (
            <div key={item.label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-lg font-semibold text-gray-900">{formatter(item.current)}</p>
              <p className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </p>
            </div>
          )
        })}
      </div>

      {/* 불릿 차트 */}
      <BulletChart data={data} height={data.length * 50 + 60} />
    </div>
  )
}
