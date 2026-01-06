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
  Legend,
  Bar,
  ComposedChart,
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
  showLeads?: boolean  // 리드수 표시 여부 (나라똔: true, H.E.A 판교: false)
}

type MetricType = 'clicks' | 'impressions' | 'spend' | 'ctr'
type ViewMode = 'combined' | 'single'

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

export function DailyTrendChart({ daily, usdToKrw = 1500, showLeads = false }: DailyTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('combined')
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

  // 통합 차트용 통계
  const totalSpend = chartData.reduce((sum, d) => sum + d.spend, 0)
  const totalImpressions = chartData.reduce((sum, d) => sum + d.impressions, 0)
  const totalLeads = chartData.reduce((sum, d) => sum + d.leads, 0)
  const avgSpend = totalSpend / chartData.length
  const avgImpressions = totalImpressions / chartData.length

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
          <span>📈</span>
          <span>일별 성과 추이</span>
        </div>

        {/* 뷰 모드 전환 */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('combined')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'combined'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            통합
          </button>
          <button
            onClick={() => setViewMode('single')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'single'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            개별
          </button>
        </div>
      </div>

      {/* 개별 메트릭 선택 버튼 (single 모드에서만) */}
      {viewMode === 'single' && (
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
      )}

      {/* 통합 차트 (지출액 + 노출수 + 리드수) */}
      {viewMode === 'combined' && (
        <>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 60, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                />
                {/* 왼쪽 Y축: 지출액 */}
                <YAxis
                  yAxisId="spend"
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#F59E0B' }}
                  axisLine={{ stroke: '#F59E0B' }}
                  tickLine={false}
                  tickFormatter={(v) => `₩${(v * usdToKrw / 1000).toFixed(0)}K`}
                  label={{ value: '지출액', angle: -90, position: 'insideLeft', fill: '#F59E0B', fontSize: 11 }}
                />
                {/* 오른쪽 Y축: 노출수 */}
                <YAxis
                  yAxisId="impressions"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#03C75A' }}
                  axisLine={{ stroke: '#03C75A' }}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
                  label={{ value: '노출수', angle: 90, position: 'insideRight', fill: '#03C75A', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                  itemStyle={{
                    color: '#374151',
                  }}
                  labelStyle={{
                    color: '#111827',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'spend') return [`₩${formatNumber(Math.round(value * usdToKrw))}`, '지출액']
                    if (name === 'impressions') return [formatNumber(value), '노출수']
                    if (name === 'leads') return [formatNumber(value), '리드수']
                    return [value, name]
                  }}
                  labelFormatter={(label) => chartData.find(d => d.day === label)?.label || ''}
                />
                <Legend
                  formatter={(value) => {
                    if (value === 'spend') return '지출액'
                    if (value === 'impressions') return '노출수'
                    if (value === 'leads') return '리드수'
                    return value
                  }}
                />
                {/* 지출액: 막대 그래프 */}
                <Bar
                  yAxisId="spend"
                  dataKey="spend"
                  fill="#FEF3C7"
                  stroke="#F59E0B"
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                />
                {/* 노출수: 선 그래프 */}
                <Line
                  yAxisId="impressions"
                  type="monotone"
                  dataKey="impressions"
                  stroke="#03C75A"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#03C75A' }}
                  activeDot={{ r: 6 }}
                />
                {/* 리드수: 선 그래프 (showLeads가 true일 때만) */}
                {showLeads && (
                  <Line
                    yAxisId="impressions"
                    type="monotone"
                    dataKey="leads"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#8B5CF6' }}
                    activeDot={{ r: 6 }}
                    strokeDasharray="5 5"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 통합 차트 요약 */}
          <div className={`grid gap-4 mt-4 ${showLeads ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
              <div className="w-3 h-3 bg-amber-400 rounded"></div>
              <div>
                <p className="text-xs text-gray-500">총 지출액</p>
                <p className="text-sm font-semibold">₩{formatNumber(Math.round(totalSpend * usdToKrw))}</p>
                <p className="text-xs text-gray-400">일평균 ₩{formatNumber(Math.round(avgSpend * usdToKrw))}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-xs text-gray-500">총 노출수</p>
                <p className="text-sm font-semibold">{formatNumber(totalImpressions)}</p>
                <p className="text-xs text-gray-400">일평균 {formatNumber(Math.round(avgImpressions))}</p>
              </div>
            </div>
            {showLeads && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-gray-500">총 리드수</p>
                  <p className="text-sm font-semibold">{formatNumber(totalLeads)}</p>
                  <p className="text-xs text-gray-400">일평균 {(totalLeads / chartData.length).toFixed(1)}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 개별 차트 (기존 방식) */}
      {viewMode === 'single' && (
        <>
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
        </>
      )}
    </Card>
  )
}
