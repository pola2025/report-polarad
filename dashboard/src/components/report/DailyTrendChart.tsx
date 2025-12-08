'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatNumber } from '@/lib/utils'

interface DailyData {
  date: string
  impressions: number
  clicks: number
  leads: number
  spend: number
}

interface DailyTrendChartProps {
  daily: DailyData[]
  usdToKrw?: number
}

type MetricType = 'clicks' | 'impressions' | 'spend' | 'ctr'

// 날짜 포맷 (MM/DD)
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate().toString().padStart(2, '0')}`
}

// 요일 변환
function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return days[date.getDay()]
}

export function DailyTrendChart({ daily, usdToKrw = 1500 }: DailyTrendChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('clicks')

  if (daily.length === 0) return null

  // 데이터 가공
  const chartData = daily.map(d => ({
    ...d,
    label: `${formatDate(d.date)} (${getDayOfWeek(d.date)})`,
    day: parseInt(d.date.split('-')[2]),
    ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
    spendKrw: d.spend * usdToKrw,
  }))

  // 메트릭별 설정
  const metricConfig: Record<MetricType, { label: string; color: string; format: (v: number) => string }> = {
    clicks: { label: '클릭수', color: '#1877F2', format: (v) => formatNumber(v) },
    impressions: { label: '노출수', color: '#03C75A', format: (v) => formatNumber(v) },
    spend: { label: '지출액', color: '#F59E0B', format: (v) => `₩${formatNumber(Math.round(v * usdToKrw))}` },
    ctr: { label: 'CTR', color: '#8B5CF6', format: (v) => `${v.toFixed(2)}%` },
  }

  // 평균값 계산
  const avg = chartData.reduce((sum, d) => {
    if (selectedMetric === 'ctr') return sum + d.ctr
    if (selectedMetric === 'spend') return sum + d.spend
    return sum + d[selectedMetric]
  }, 0) / chartData.length

  // 최고/최저 성과 날짜 찾기
  const values = chartData.map(d => {
    if (selectedMetric === 'ctr') return d.ctr
    if (selectedMetric === 'spend') return d.spend
    return d[selectedMetric]
  })
  const maxValue = Math.max(...values)
  const minValue = Math.min(...values)
  const maxIndex = values.indexOf(maxValue)
  const minIndex = values.indexOf(minValue)

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
        <span>📈</span>
        <span>일별 성과 추이</span>
      </div>

      {/* 메트릭 선택 버튼 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.keys(metricConfig) as MetricType[]).map((metric) => (
          <button
            key={metric}
            onClick={() => setSelectedMetric(metric)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedMetric === metric
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {metricConfig[metric].label}
          </button>
        ))}
      </div>

      {/* 차트 */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
              tickFormatter={(value) => {
                if (selectedMetric === 'ctr') return `${value.toFixed(1)}%`
                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
                return value.toString()
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '12px',
              }}
              formatter={(value: number) => [metricConfig[selectedMetric].format(value), metricConfig[selectedMetric].label]}
              labelFormatter={(label) => chartData.find(d => d.day === label)?.label || ''}
            />
            <ReferenceLine
              y={avg}
              stroke="#9CA3AF"
              strokeDasharray="5 5"
              label={{ value: '평균', position: 'right', fill: '#9CA3AF', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey={selectedMetric === 'spend' ? 'spend' : selectedMetric}
              stroke={metricConfig[selectedMetric].color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 및 통계 */}
      <div className="flex gap-6 justify-center mt-4">
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5" style={{ backgroundColor: metricConfig[selectedMetric].color }}></span>
          <span className="text-sm text-gray-600">{metricConfig[selectedMetric].label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-gray-400"></span>
          <span className="text-sm text-gray-600">평균: {metricConfig[selectedMetric].format(avg)}</span>
        </div>
      </div>

      {/* 인사이트 박스 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
          <span className="text-lg">📌</span>
          <div className="text-sm text-gray-700">
            <strong>{chartData[maxIndex]?.label}:</strong>{' '}
            {metricConfig[selectedMetric].label} 최고 {metricConfig[selectedMetric].format(maxValue)}
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
          <span className="text-lg">📌</span>
          <div className="text-sm text-gray-700">
            <strong>{chartData[minIndex]?.label}:</strong>{' '}
            {metricConfig[selectedMetric].label} 최저 {metricConfig[selectedMetric].format(minValue)}
          </div>
        </div>
      </div>
    </Card>
  )
}
