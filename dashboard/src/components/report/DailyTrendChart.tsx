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
  showClicks?: boolean  // 클릭수 선 표시 여부 (H.E.A 판교 Meta: true)
  showSpend?: boolean  // 지출액 선 표시 여부 (H.E.A 판교 Naver: true)
  channel?: 'meta' | 'naver'  // 채널 구분 (제목에 표시)
  barMetric?: 'spend' | 'clicks'  // 막대 그래프에 표시할 지표 (기본: spend)
}

type MetricType = 'clicks' | 'impressions' | 'spend' | 'ctr'
type ViewMode = 'combined' | 'single'

// 지표별 색상 설정
const METRIC_COLORS = {
  spend: '#3B82F6',       // 파란색
  clicks: '#1877F2',      // 페이스북 파란색
  impressions: '#03C75A', // 녹색
  leads: '#8B5CF6',       // 보라색
} as const

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

// 커스텀 툴팁 컴포넌트 (지표별 색상 적용)
interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color?: string }>
  label?: string | number
  usdToKrw: number
  showLeads: boolean
  showClicksLine: boolean  // 클릭수 선 표시 여부
  showSpendLine: boolean  // 지출액 선 표시 여부
  barMetric: 'spend' | 'clicks'
  chartData: Array<{ day: number; label: string }>
}

function CustomTooltip({ active, payload, label, usdToKrw, showLeads, showClicksLine, showSpendLine, barMetric, chartData }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const dateLabel = chartData.find(d => d.day === label)?.label || ''

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-gray-900 mb-2">{dateLabel}</p>
      {payload.map((entry) => {
        const { dataKey, value } = entry
        let displayName = ''
        let displayValue = ''
        let color = '#374151'

        switch (dataKey) {
          case 'spend':
            // 막대가 지출액이거나, 지출액 선이 표시될 때
            if (barMetric !== 'spend' && !showSpendLine) return null
            displayName = '지출액'
            displayValue = `₩${formatNumber(Math.round((value as number) * usdToKrw))}`
            color = METRIC_COLORS.spend
            break
          case 'clicks':
            // 막대가 클릭수이거나, 클릭수 선이 표시될 때
            if (barMetric !== 'clicks' && !showClicksLine) return null
            displayName = '클릭수'
            displayValue = formatNumber(value as number)
            color = METRIC_COLORS.clicks
            break
          case 'impressions':
            displayName = '노출수'
            displayValue = formatNumber(value as number)
            color = METRIC_COLORS.impressions
            break
          case 'leads':
            if (!showLeads) return null
            displayName = '리드수'
            displayValue = formatNumber(value as number)
            color = METRIC_COLORS.leads
            break
          default:
            return null
        }

        return (
          <div key={dataKey as string} className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color }} className="font-medium">{displayName}</span>
            <span style={{ color }} className="font-semibold">{displayValue}</span>
          </div>
        )
      })}
    </div>
  )
}

export function DailyTrendChart({ daily, usdToKrw = 1500, showLeads = false, showClicks = false, showSpend = false, channel, barMetric = 'spend' }: DailyTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('combined')
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('clicks')

  if (daily.length === 0) return null

  // 채널명 표시
  const channelName = channel === 'meta' ? 'Meta' : channel === 'naver' ? 'Naver' : ''

  // 클릭수 선 표시 여부 (외부에서 제어, Meta 채널에서만 유효)
  const showClicksLine = showClicks && channel === 'meta' && barMetric === 'spend'

  // 지출액 선 표시 여부 (외부에서 제어, Naver 채널에서 barMetric이 clicks일 때)
  const showSpendLine = showSpend && channel === 'naver' && barMetric === 'clicks'

  // 막대 그래프 설정 (지출액 또는 클릭수)
  const barConfig = barMetric === 'clicks'
    ? { label: '클릭수', color: METRIC_COLORS.clicks, fillColor: '#DBEAFE' }
    : { label: '지출액', color: METRIC_COLORS.spend, fillColor: '#DBEAFE' }

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
  const totalClicks = chartData.reduce((sum, d) => sum + d.clicks, 0)
  const totalImpressions = chartData.reduce((sum, d) => sum + d.impressions, 0)
  const totalLeads = chartData.reduce((sum, d) => sum + d.leads, 0)
  const avgSpend = totalSpend / chartData.length
  const avgClicks = totalClicks / chartData.length
  const avgImpressions = totalImpressions / chartData.length

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
          <span>📈</span>
          <span>{channelName ? `${channelName} ` : ''}일별 성과 추이</span>
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

      {/* 통합 차트 (지출액/클릭수 + 노출수 + 리드수) */}
      {viewMode === 'combined' && (
        <>
          <div className={showLeads ? "h-96" : "h-80"}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: showLeads ? 80 : 60, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                />
                {/* 왼쪽 Y축: 지출액 또는 클릭수 */}
                <YAxis
                  yAxisId="bar"
                  orientation="left"
                  tick={{ fontSize: 11, fill: barConfig.color }}
                  axisLine={{ stroke: barConfig.color }}
                  tickLine={false}
                  tickFormatter={(v) => barMetric === 'spend'
                    ? `₩${(v * usdToKrw / 1000).toFixed(0)}K`
                    : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()
                  }
                  label={{ value: barConfig.label, angle: -90, position: 'insideLeft', fill: barConfig.color, fontSize: 11 }}
                />
                {/* 오른쪽 Y축: 노출수 (녹색) */}
                <YAxis
                  yAxisId="impressions"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#03C75A' }}
                  axisLine={{ stroke: '#03C75A' }}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
                  label={{ value: '노출수', angle: 90, position: 'insideRight', fill: '#03C75A', fontSize: 11, offset: showLeads ? -20 : 0 }}
                />
                {/* 오른쪽 Y축 2: 리드수 (보라색) - showLeads가 true일 때만 */}
                {showLeads && (
                  <YAxis
                    yAxisId="leads"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#8B5CF6' }}
                    axisLine={{ stroke: '#8B5CF6' }}
                    tickLine={false}
                    tickFormatter={(v) => v.toString()}
                    label={{ value: '리드수', angle: 90, position: 'right', fill: '#8B5CF6', fontSize: 11, offset: 15 }}
                  />
                )}
                {/* 클릭수용 Y축 (숨김 - 스케일만 적용) */}
                {showClicksLine && (
                  <YAxis
                    yAxisId="clicks"
                    orientation="right"
                    hide={true}
                    domain={['dataMin * 0.8', 'dataMax * 1.2']}
                  />
                )}
                {/* 지출액용 Y축 (숨김 - 스케일만 적용) */}
                {showSpendLine && (
                  <YAxis
                    yAxisId="spend"
                    orientation="right"
                    hide={true}
                    domain={['dataMin * 0.8', 'dataMax * 1.2']}
                  />
                )}
                <Tooltip
                  content={<CustomTooltip usdToKrw={usdToKrw} showLeads={showLeads} showClicksLine={showClicksLine} showSpendLine={showSpendLine} barMetric={barMetric} chartData={chartData} />}
                />
                <Legend
                  formatter={(value) => {
                    if (value === 'spend') return '지출액'
                    if (value === 'clicks') return '클릭수'
                    if (value === 'impressions') return '노출수'
                    if (value === 'leads') return '리드수'
                    return value
                  }}
                />
                {/* 막대 그래프: 지출액 또는 클릭수 */}
                <Bar
                  yAxisId="bar"
                  dataKey={barMetric}
                  fill={barConfig.fillColor}
                  stroke={barConfig.color}
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                />
                {/* 노출수: 선 그래프 (녹색) */}
                <Line
                  yAxisId="impressions"
                  type="monotone"
                  dataKey="impressions"
                  stroke="#03C75A"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#03C75A' }}
                  activeDot={{ r: 6 }}
                />
                {/* 리드수: 선 그래프 (보라색) - 별도 Y축 */}
                {showLeads && (
                  <Line
                    yAxisId="leads"
                    type="monotone"
                    dataKey="leads"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#8B5CF6' }}
                    activeDot={{ r: 7 }}
                  />
                )}
                {/* 클릭수: 선 그래프 (파란색) - Meta 채널에서만, 별도 Y축 (숨김) */}
                {showClicksLine && (
                  <Line
                    yAxisId="clicks"
                    type="monotone"
                    dataKey="clicks"
                    stroke={METRIC_COLORS.clicks}
                    strokeWidth={2}
                    dot={{ r: 3, fill: METRIC_COLORS.clicks }}
                    activeDot={{ r: 6 }}
                  />
                )}
                {/* 지출액: 선 그래프 (파란색) - Naver 채널에서만, 별도 Y축 (숨김) */}
                {showSpendLine && (
                  <Line
                    yAxisId="spend"
                    type="monotone"
                    dataKey="spend"
                    stroke={METRIC_COLORS.spend}
                    strokeWidth={2}
                    dot={{ r: 3, fill: METRIC_COLORS.spend }}
                    activeDot={{ r: 6 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 통합 차트 요약 */}
          <div className={`grid gap-4 mt-4 ${showLeads ? 'grid-cols-4' : (showClicksLine || showSpendLine) ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {/* 첫 번째 카드: 지출액 또는 클릭수 */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <div>
                {barMetric === 'spend' ? (
                  <>
                    <p className="text-xs text-blue-600">총 지출액</p>
                    <p className="text-sm font-semibold text-blue-700">₩{formatNumber(Math.round(totalSpend * usdToKrw))}</p>
                    <p className="text-xs text-blue-400">일평균 ₩{formatNumber(Math.round(avgSpend * usdToKrw))}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-blue-600">총 클릭수</p>
                    <p className="text-sm font-semibold text-blue-700">{formatNumber(totalClicks)}</p>
                    <p className="text-xs text-blue-400">일평균 {formatNumber(Math.round(avgClicks))}</p>
                  </>
                )}
              </div>
            </div>
            {/* 클릭수 카드 - Meta 채널에서만 */}
            {showClicksLine && (
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-indigo-600">총 클릭수</p>
                  <p className="text-sm font-semibold text-indigo-700">{formatNumber(totalClicks)}</p>
                  <p className="text-xs text-indigo-400">일평균 {formatNumber(Math.round(avgClicks))}</p>
                </div>
              </div>
            )}
            {/* 지출액 카드 - Naver 채널에서만 */}
            {showSpendLine && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-blue-600">총 지출액</p>
                  <p className="text-sm font-semibold text-blue-700">₩{formatNumber(Math.round(totalSpend * usdToKrw))}</p>
                  <p className="text-xs text-blue-400">일평균 ₩{formatNumber(Math.round(avgSpend * usdToKrw))}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-xs text-green-600">총 노출수</p>
                <p className="text-sm font-semibold text-green-700">{formatNumber(totalImpressions)}</p>
                <p className="text-xs text-green-400">일평균 {formatNumber(Math.round(avgImpressions))}</p>
              </div>
            </div>
            {showLeads && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-purple-600">총 리드수</p>
                  <p className="text-sm font-semibold text-purple-700">{formatNumber(totalLeads)}</p>
                  <p className="text-xs text-purple-400">일평균 {(totalLeads / chartData.length).toFixed(1)}</p>
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
