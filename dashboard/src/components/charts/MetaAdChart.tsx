'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { formatNumber, formatCurrency } from '@/lib/utils'
import { formatSpendWithKrw } from '@/lib/constants'

interface DailyData {
  date: string
  meta_impressions: number
  meta_clicks: number
  meta_spend: number
  meta_leads: number
  naver_impressions: number
  naver_clicks: number
  naver_spend: number
}

interface MetaTrendChartProps {
  data: DailyData[]
  metric?: 'impressions' | 'clicks' | 'spend' | 'leads'
}

const metricConfig = {
  impressions: { label: '노출수', color: '#3B82F6', format: formatNumber },
  clicks: { label: '클릭수', color: '#10B981', format: formatNumber },
  spend: { label: '지출액', color: '#F59E0B', format: formatCurrency },
  leads: { label: '리드수', color: '#8B5CF6', format: formatNumber },
}

export function MetaDailyTrendChart({ data, metric = 'impressions' }: MetaTrendChartProps) {
  const config = metricConfig[metric]

  const chartData = data.map(d => ({
    date: d.date.slice(5), // MM-DD
    value: d[`meta_${metric}` as keyof DailyData] as number,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => formatNumber(v)} />
        <Tooltip
          formatter={(value: number) => [config.format(value), config.label]}
          labelFormatter={(label) => `날짜: ${label}`}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={config.color}
          strokeWidth={2}
          dot={false}
          name={config.label}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface ChannelComparisonChartProps {
  data: DailyData[]
  metric?: 'impressions' | 'clicks' | 'spend'
}

export function ChannelComparisonChart({ data, metric = 'impressions' }: ChannelComparisonChartProps) {
  const chartData = data.map(d => ({
    date: d.date.slice(5),
    meta: d[`meta_${metric}` as keyof DailyData] as number,
    naver: d[`naver_${metric}` as keyof DailyData] as number,
  }))

  const label = metricConfig[metric].label
  const formatter = metricConfig[metric].format

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => formatNumber(v)} />
        <Tooltip
          formatter={(value: number) => [formatter(value), '']}
          labelFormatter={(label) => `날짜: ${label}`}
        />
        <Legend />
        <Bar dataKey="meta" name={`Meta ${label}`} fill="#3B82F6" stackId="a" />
        <Bar dataKey="naver" name={`Naver ${label}`} fill="#10B981" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface MetaSummaryProps {
  current: {
    impressions: number
    clicks: number
    leads: number
    spend: number
    spend_krw?: number
  }
  previous: {
    impressions: number
    clicks: number
    leads: number
    spend: number
    spend_krw?: number
  }
}

// 요일별 추이 그래프 (주별 색상 구분)
interface DayOfWeekChartProps {
  data: DailyData[]
  metric?: 'impressions' | 'clicks' | 'spend'
}

const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토']
const WEEK_COLORS = [
  '#3B82F6', // 1주차 - 파랑
  '#10B981', // 2주차 - 초록
  '#F59E0B', // 3주차 - 주황
  '#8B5CF6', // 4주차 - 보라
  '#EF4444', // 5주차 - 빨강
]

export function MetaDayOfWeekChart({ data, metric = 'spend' }: DayOfWeekChartProps) {
  // 요일별로 데이터 집계 (주차별 구분)
  const dayOfWeekData: { [day: string]: { [week: string]: number } } = {}
  DAYS_OF_WEEK.forEach(day => {
    dayOfWeekData[day] = {}
  })

  // 데이터를 주차별로 분류
  const weeklyData: { [week: number]: { date: string; value: number; dayIndex: number }[] } = {}

  data.forEach((d, index) => {
    const date = new Date(d.date)
    const dayIndex = date.getDay() // 0=일, 1=월, ...
    const weekNum = Math.floor(index / 7) + 1

    if (!weeklyData[weekNum]) {
      weeklyData[weekNum] = []
    }

    const value = metric === 'spend'
      ? (d.meta_spend || 0)
      : metric === 'clicks'
        ? (d.meta_clicks || 0)
        : (d.meta_impressions || 0)

    weeklyData[weekNum].push({ date: d.date, value, dayIndex })
  })

  // 차트 데이터 구성 (월~일 순서)
  const chartData = DAYS_OF_WEEK.map((day, dayIndex) => {
    const result: { day: string; [key: string]: number | string } = { day }

    Object.keys(weeklyData).forEach(weekNum => {
      const weekData = weeklyData[parseInt(weekNum)]
      const dayData = weekData.find(d => d.dayIndex === dayIndex)
      result[`week${weekNum}`] = dayData?.value || 0
    })

    return result
  })

  // 월요일부터 시작하도록 순서 재배열
  const reorderedData = [
    chartData[1], // 월
    chartData[2], // 화
    chartData[3], // 수
    chartData[4], // 목
    chartData[5], // 금
    chartData[6], // 토
    chartData[0], // 일
  ]

  const config = metricConfig[metric]
  const weekKeys = Object.keys(weeklyData)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={reorderedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="day" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => formatNumber(v)} />
        <Tooltip
          formatter={(value: number, name: string) => {
            const weekLabel = name.replace('week', '') + '주차'
            return [config.format(value), weekLabel]
          }}
          labelFormatter={(label) => `${label}요일`}
        />
        <Legend
          formatter={(value) => value.replace('week', '') + '주차'}
        />
        {weekKeys.map((weekNum, idx) => (
          <Bar
            key={weekNum}
            dataKey={`week${weekNum}`}
            name={`week${weekNum}`}
            fill={WEEK_COLORS[idx % WEEK_COLORS.length]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MetaSummaryCards({ current, previous }: MetaSummaryProps) {
  const ctr = current.impressions > 0 ? (current.clicks / current.impressions) * 100 : 0
  const previousCtr = previous.impressions > 0 ? (previous.clicks / previous.impressions) * 100 : 0
  const cpc = current.clicks > 0 ? current.spend / current.clicks : 0
  const previousCpc = previous.clicks > 0 ? previous.spend / previous.clicks : 0

  const metrics = [
    { label: '노출수', current: current.impressions, previous: previous.impressions, format: formatNumber },
    { label: '클릭수', current: current.clicks, previous: previous.clicks, format: formatNumber },
    { label: 'CTR', current: ctr, previous: previousCtr, format: (v: number) => `${v.toFixed(2)}%` },
    { label: '지출액', current: current.spend, previous: previous.spend, format: (v: number) => formatSpendWithKrw(v) },
    { label: 'CPC', current: cpc, previous: previousCpc, format: formatCurrency },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {metrics.map(({ label, current, previous, format }) => {
        const change = previous > 0 ? ((current - previous) / previous) * 100 : 0
        const isPositive = label === 'CPC' ? change < 0 : change > 0
        return (
          <div key={label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-semibold">{format(current)}</p>
            {previous > 0 && (
              <p className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
