'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts'
import type { DailyCombinedData } from '@/types/integrated-analytics'

interface CombinedTrendChartProps {
  data: DailyCombinedData[]
  type?: 'stacked' | 'line' | 'combined'
  metric?: 'spend' | 'impressions' | 'clicks'
}

/**
 * 일별 통합 트렌드 차트
 */
export function CombinedTrendChart({ data, type = 'stacked', metric = 'spend' }: CombinedTrendChartProps) {
  const chartData = data.map(d => ({
    date: d.date.slice(5), // MM-DD
    meta: metric === 'spend' ? d.meta_spend_krw : metric === 'impressions' ? d.meta_impressions : d.meta_clicks,
    naver: metric === 'spend' ? d.naver_spend : metric === 'impressions' ? d.naver_impressions : d.naver_clicks,
    total: metric === 'spend' ? d.total_spend_krw : d.total_impressions,
  }))

  const formatValue = (value: number) => {
    if (metric === 'spend') {
      return `₩${value.toLocaleString()}`
    }
    return value.toLocaleString()
  }

  const metricLabel = {
    spend: '광고비',
    impressions: '노출수',
    clicks: '클릭수',
  }[metric]

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v.toString()} />
          <Tooltip formatter={(value: number) => [formatValue(value), '']} />
          <Legend />
          <Line type="monotone" dataKey="meta" name={`Meta ${metricLabel}`} stroke="#3B82F6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="naver" name={`네이버 ${metricLabel}`} stroke="#10B981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'combined') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v.toString()} />
          <Tooltip formatter={(value: number) => [formatValue(value), '']} />
          <Legend />
          <Bar dataKey="meta" name={`Meta ${metricLabel}`} fill="#3B82F6" stackId="a" />
          <Bar dataKey="naver" name={`네이버 ${metricLabel}`} fill="#10B981" stackId="a" />
          <Line type="monotone" dataKey="total" name={`총 ${metricLabel}`} stroke="#F59E0B" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  // Stacked bar chart (default)
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v.toString()} />
        <Tooltip formatter={(value: number) => [formatValue(value), '']} />
        <Legend />
        <Bar dataKey="meta" name={`Meta ${metricLabel}`} fill="#3B82F6" stackId="a" />
        <Bar dataKey="naver" name={`네이버 ${metricLabel}`} fill="#10B981" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  )
}
