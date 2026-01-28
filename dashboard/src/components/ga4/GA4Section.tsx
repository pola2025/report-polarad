'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { KPICard } from '@/components/ui/kpi-card'
import { formatNumber, formatPercent } from '@/lib/utils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Bar,
  ComposedChart,
  ScatterChart,
  Scatter,
  ReferenceLine,
} from 'recharts'
import { BulletChartWithSummary } from '@/components/charts/BulletChart'
import { TrafficTreemap, TrafficSourceList } from '@/components/charts/TrafficTreemap'
import type { GA4AnalyticsResponse, BulletChartData } from '@/types/ga4-analytics'
import { Activity, Users, TrendingDown, Target, TrendingUp } from 'lucide-react'

// 일별 광고 데이터 타입
interface DailyTrendData {
  date: string
  meta_spend: number
  meta_spend_krw: number
  naver_spend: number
  total_spend_krw: number
}

interface GA4SectionProps {
  data: GA4AnalyticsResponse
  dailyTrend?: DailyTrendData[]
}

// 상관계수 계산 함수
function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0 || n !== y.length) return 0

  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0)
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0)
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  if (denominator === 0) return 0
  return numerator / denominator
}

// 상관계수 해석
function interpretCorrelation(r: number): { text: string; color: string } {
  const absR = Math.abs(r)
  if (absR >= 0.7) return { text: '강한 상관관계', color: 'text-green-600' }
  if (absR >= 0.4) return { text: '중간 상관관계', color: 'text-yellow-600' }
  if (absR >= 0.2) return { text: '약한 상관관계', color: 'text-orange-500' }
  return { text: '상관관계 없음', color: 'text-gray-500' }
}

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

// 메트릭 색상
const METRIC_COLORS = {
  sessions: '#3B82F6', // blue-500
  users: '#10B981', // emerald-500
  pageviews: '#8B5CF6', // violet-500
  bounceRate: '#EF4444', // red-500
  conversions: '#F59E0B', // amber-500
}

type ViewMode = 'combined' | 'single'
type MetricType = 'sessions' | 'users' | 'pageviews' | 'bounceRate' | 'conversions'

// 커스텀 툴팁
interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color?: string }>
  label?: string | number
  chartData: Array<{ day: number; label: string }>
}

function CustomTooltip({ active, payload, label, chartData }: CustomTooltipProps) {
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
          case 'sessions':
            displayName = '세션'
            displayValue = formatNumber(value)
            color = METRIC_COLORS.sessions
            break
          case 'users':
            displayName = '사용자'
            displayValue = formatNumber(value)
            color = METRIC_COLORS.users
            break
          case 'pageviews':
            displayName = '페이지뷰'
            displayValue = formatNumber(value)
            color = METRIC_COLORS.pageviews
            break
          case 'bounceRate':
            displayName = '이탈률'
            displayValue = formatPercent(value, 1)
            color = METRIC_COLORS.bounceRate
            break
          case 'conversions':
            displayName = '전환'
            displayValue = formatNumber(value)
            color = METRIC_COLORS.conversions
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

export function GA4Section({ data, dailyTrend }: GA4SectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('combined')
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('sessions')

  if (!data.success || !data.data) {
    return (
      <Card className="p-6">
        <p className="text-gray-500 text-center">GA4 데이터를 불러올 수 없습니다.</p>
      </Card>
    )
  }

  const { daily, sources, summary, comparison } = data.data

  // 일별 데이터 가공
  const chartData = daily.map(d => ({
    ...d,
    label: `${formatDate(d.date)} (${getDayOfWeek(d.date)})`,
    day: parseInt(d.date.split('-')[2]),
  }))

  // 불릿 차트용 데이터
  const bulletData: BulletChartData[] = [
    {
      label: '세션',
      current: summary.totalSessions,
      previous: comparison.previous.totalSessions,
      format: 'number',
    },
    {
      label: '사용자',
      current: summary.totalUsers,
      previous: comparison.previous.totalUsers,
      format: 'number',
    },
    {
      label: '이탈률',
      current: summary.avgBounceRate,
      previous: comparison.previous.avgBounceRate,
      format: 'percent',
    },
    {
      label: '평균 체류시간',
      current: summary.avgSessionDuration,
      previous: comparison.previous.avgSessionDuration,
      format: 'duration',
    },
  ]

  // 전환이 있는 경우에만 추가
  if (summary.totalConversions > 0) {
    bulletData.push({
      label: '전환',
      current: summary.totalConversions,
      previous: comparison.previous.totalConversions,
      format: 'number',
    })
  }

  // 메트릭 설정
  const metricConfig: Record<MetricType, { label: string; color: string; format: (v: number) => string }> = {
    sessions: { label: '세션', color: METRIC_COLORS.sessions, format: formatNumber },
    users: { label: '사용자', color: METRIC_COLORS.users, format: formatNumber },
    pageviews: { label: '페이지뷰', color: METRIC_COLORS.pageviews, format: formatNumber },
    bounceRate: { label: '이탈률', color: METRIC_COLORS.bounceRate, format: (v) => formatPercent(v, 1) },
    conversions: { label: '전환', color: METRIC_COLORS.conversions, format: formatNumber },
  }

  // 통계 계산
  const totalSessions = chartData.reduce((sum, d) => sum + d.sessions, 0)
  const totalUsers = chartData.reduce((sum, d) => sum + d.users, 0)
  const avgSessions = totalSessions / chartData.length
  const avgUsers = totalUsers / chartData.length
  const avgBounceRate = chartData.reduce((sum, d) => sum + d.bounceRate, 0) / chartData.length

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">GA4 분석 요약</h2>
          <p className="text-sm text-gray-500">
            {summary.dateRange.start} ~ {summary.dateRange.end}
          </p>
        </div>

        {/* 모바일: 2x2 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="총 세션"
            value={summary.totalSessions}
            previousValue={comparison.previous.totalSessions}
          />
          <KPICard
            title="총 사용자"
            value={summary.totalUsers}
            previousValue={comparison.previous.totalUsers}
          />
          <KPICard
            title="평균 이탈률"
            value={summary.avgBounceRate}
            previousValue={comparison.previous.avgBounceRate}
            format="percent"
          />
          <KPICard
            title="총 전환"
            value={summary.totalConversions}
            previousValue={comparison.previous.totalConversions}
          />
        </div>
      </section>

      {/* 일별 트렌드 차트 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Activity className="h-5 w-5 text-blue-500" />
            <span>일별 트래픽 추이</span>
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

        {/* 개별 메트릭 선택 */}
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

        {/* 통합 차트 */}
        {viewMode === 'combined' && (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 11, fill: METRIC_COLORS.sessions }}
                    axisLine={{ stroke: METRIC_COLORS.sessions }}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
                    label={{ value: '세션', angle: -90, position: 'insideLeft', fill: METRIC_COLORS.sessions, fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: METRIC_COLORS.users }}
                    axisLine={{ stroke: METRIC_COLORS.users }}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
                    label={{ value: '사용자', angle: 90, position: 'insideRight', fill: METRIC_COLORS.users, fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip chartData={chartData} />} />
                  <Legend
                    formatter={(value) => {
                      if (value === 'sessions') return '세션'
                      if (value === 'users') return '사용자'
                      return value
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="sessions"
                    fill="#DBEAFE"
                    stroke={METRIC_COLORS.sessions}
                    strokeWidth={1}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="users"
                    stroke={METRIC_COLORS.users}
                    strokeWidth={2}
                    dot={{ r: 3, fill: METRIC_COLORS.users }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 통합 차트 요약 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <div>
                  <p className="text-xs text-blue-600">총 세션</p>
                  <p className="text-sm font-semibold text-blue-700">{formatNumber(totalSessions)}</p>
                  <p className="text-xs text-blue-400">일평균 {formatNumber(Math.round(avgSessions))}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-green-600">총 사용자</p>
                  <p className="text-sm font-semibold text-green-700">{formatNumber(totalUsers)}</p>
                  <p className="text-xs text-green-400">일평균 {formatNumber(Math.round(avgUsers))}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div>
                  <p className="text-xs text-red-600">평균 이탈률</p>
                  <p className="text-sm font-semibold text-red-700">{formatPercent(avgBounceRate, 1)}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 개별 차트 */}
        {viewMode === 'single' && (
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
                    if (selectedMetric === 'bounceRate') return formatPercent(value, 0)
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
                <Line
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke={metricConfig[selectedMetric].color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* 기간 비교 (불릿 차트) */}
      <Card className="p-6">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
          <TrendingDown className="h-5 w-5 text-purple-500" />
          <span>기간 비교</span>
        </div>
        <BulletChartWithSummary data={bulletData} />
      </Card>

      {/* 유입 소스 분석 */}
      <Card className="p-6">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
          <Target className="h-5 w-5 text-amber-500" />
          <span>유입 소스 분석</span>
        </div>

        {sources.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 트리맵 */}
            <div>
              <TrafficTreemap data={sources} metric="sessions" height={350} />
            </div>

            {/* 소스 리스트 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-4">상위 유입 소스</h3>
              <TrafficSourceList data={sources} metric="sessions" />
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">유입 소스 데이터가 없습니다.</p>
        )}
      </Card>

      {/* 광고비 vs 세션 상관관계 분석 */}
      {dailyTrend && dailyTrend.length > 0 && daily.length > 0 && (() => {
        // 날짜 매칭하여 광고비-세션 데이터 병합
        const ga4Map = new Map(daily.map(d => [d.date, d.sessions]))
        const correlationData = dailyTrend
          .filter(d => ga4Map.has(d.date) && d.total_spend_krw > 0)
          .map(d => ({
            date: d.date,
            spend: Math.round(d.total_spend_krw / 1000), // 천원 단위
            sessions: ga4Map.get(d.date) || 0,
          }))

        if (correlationData.length < 3) return null

        const spendArr = correlationData.map(d => d.spend)
        const sessionsArr = correlationData.map(d => d.sessions)
        const correlation = calculateCorrelation(spendArr, sessionsArr)
        const interpretation = interpretCorrelation(correlation)

        // 평균값 계산 (참조선용)
        const avgSpend = spendArr.reduce((a, b) => a + b, 0) / spendArr.length
        const avgSessions = sessionsArr.reduce((a, b) => a + b, 0) / sessionsArr.length

        return (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
                <span>광고비 vs 세션 상관관계</span>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">상관계수 (r)</p>
                <p className={`text-2xl font-bold ${interpretation.color}`}>
                  {correlation.toFixed(3)}
                </p>
                <p className={`text-sm ${interpretation.color}`}>{interpretation.text}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 산점도 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">광고비(천원) vs 세션 산점도</h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis
                        type="number"
                        dataKey="spend"
                        name="광고비"
                        unit="천원"
                        tick={{ fontSize: 11 }}
                        axisLine={{ stroke: '#E5E7EB' }}
                      />
                      <YAxis
                        type="number"
                        dataKey="sessions"
                        name="세션"
                        tick={{ fontSize: 11 }}
                        axisLine={{ stroke: '#E5E7EB' }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        formatter={(value: number, name: string) => {
                          if (name === '광고비') return [`${formatNumber(value)}천원`, '광고비']
                          return [formatNumber(value), '세션']
                        }}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                        }}
                      />
                      <ReferenceLine x={avgSpend} stroke="#9CA3AF" strokeDasharray="3 3" />
                      <ReferenceLine y={avgSessions} stroke="#9CA3AF" strokeDasharray="3 3" />
                      <Scatter
                        name="일별 데이터"
                        data={correlationData}
                        fill="#6366F1"
                        fillOpacity={0.7}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 해석 및 요약 */}
              <div className="space-y-4">
                <div className="bg-indigo-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-indigo-800 mb-2">분석 결과</h4>
                  <p className="text-sm text-indigo-700">
                    {correlation > 0.4 ? (
                      <>광고비 증가 시 세션이 <strong>증가</strong>하는 경향이 있습니다. 광고 효율이 좋습니다.</>
                    ) : correlation > 0 ? (
                      <>광고비와 세션 사이에 <strong>약한 양의 상관관계</strong>가 있습니다.</>
                    ) : correlation > -0.2 ? (
                      <>광고비와 세션 사이에 <strong>유의미한 상관관계가 없습니다</strong>.</>
                    ) : (
                      <>광고비 증가에도 세션이 <strong>감소</strong>하는 경향이 있습니다. 광고 전략 검토가 필요합니다.</>
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">분석 데이터</p>
                    <p className="text-lg font-semibold text-gray-800">{correlationData.length}일</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">평균 광고비</p>
                    <p className="text-lg font-semibold text-gray-800">{formatNumber(Math.round(avgSpend))}천원</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">평균 세션</p>
                    <p className="text-lg font-semibold text-gray-800">{formatNumber(Math.round(avgSessions))}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">상관강도</p>
                    <p className={`text-lg font-semibold ${interpretation.color}`}>
                      {Math.abs(correlation * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )
      })()}
    </div>
  )
}

// 간단한 GA4 KPI 요약 컴포넌트 (통합 대시보드용)
interface GA4KPISummaryProps {
  data: GA4AnalyticsResponse
}

export function GA4KPISummary({ data }: GA4KPISummaryProps) {
  if (!data.success || !data.data) {
    return null
  }

  const { summary, comparison } = data.data

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
          <Activity className="h-4 w-4" />
          <span>세션</span>
        </div>
        <p className="text-xl font-bold text-blue-700">{formatNumber(summary.totalSessions)}</p>
        {comparison.changes.sessions !== 0 && (
          <p className={`text-xs mt-1 ${comparison.changes.sessions > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {comparison.changes.sessions > 0 ? '+' : ''}{comparison.changes.sessions.toFixed(1)}%
          </p>
        )}
      </div>

      <div className="bg-green-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
          <Users className="h-4 w-4" />
          <span>사용자</span>
        </div>
        <p className="text-xl font-bold text-green-700">{formatNumber(summary.totalUsers)}</p>
        {comparison.changes.users !== 0 && (
          <p className={`text-xs mt-1 ${comparison.changes.users > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {comparison.changes.users > 0 ? '+' : ''}{comparison.changes.users.toFixed(1)}%
          </p>
        )}
      </div>

      <div className="bg-red-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
          <TrendingDown className="h-4 w-4" />
          <span>이탈률</span>
        </div>
        <p className="text-xl font-bold text-red-700">{formatPercent(summary.avgBounceRate, 1)}</p>
        {comparison.changes.bounceRate !== 0 && (
          <p className={`text-xs mt-1 ${comparison.changes.bounceRate < 0 ? 'text-green-600' : 'text-red-600'}`}>
            {comparison.changes.bounceRate > 0 ? '+' : ''}{comparison.changes.bounceRate.toFixed(1)}%
          </p>
        )}
      </div>

      <div className="bg-amber-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-amber-600 text-sm mb-1">
          <Target className="h-4 w-4" />
          <span>전환</span>
        </div>
        <p className="text-xl font-bold text-amber-700">{formatNumber(summary.totalConversions)}</p>
        {comparison.changes.conversions !== 0 && (
          <p className={`text-xs mt-1 ${comparison.changes.conversions > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {comparison.changes.conversions > 0 ? '+' : ''}{comparison.changes.conversions.toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  )
}
