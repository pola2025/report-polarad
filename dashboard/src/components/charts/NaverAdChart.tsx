'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'

interface NaverDataRow {
  date: string
  keyword: string
  impressions: number
  clicks: number
  ctr: number
  avg_cpc: number
  total_cost: number
  avg_rank: number
}

interface NaverAdChartProps {
  data: NaverDataRow[]
  title?: string
}

export function NaverDailyTrendChart({ data, title = '일별 추이' }: NaverAdChartProps) {
  const chartData = useMemo(() => {
    // 일별로 집계
    const dailyMap = new Map<string, { impressions: number; clicks: number; cost: number }>()

    data.forEach((row) => {
      const existing = dailyMap.get(row.date) || { impressions: 0, clicks: 0, cost: 0 }
      dailyMap.set(row.date, {
        impressions: existing.impressions + row.impressions,
        clicks: existing.clicks + row.clicks,
        cost: existing.cost + row.total_cost,
      })
    })

    return Array.from(dailyMap.entries())
      .map(([date, values]) => ({
        date: date.slice(5), // MM-DD 형식
        fullDate: date,
        ...values,
        ctr: values.impressions > 0 ? ((values.clicks / values.impressions) * 100).toFixed(2) : 0,
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
  }, [data])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">데이터가 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number, name: string) => {
                  if (name === '비용') return [formatNumber(value) + '원', name]
                  return [formatNumber(value), name]
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="clicks"
                name="클릭"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cost"
                name="비용"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function NaverKeywordChart({ data, title = 'TOP 키워드' }: NaverAdChartProps) {
  const chartData = useMemo(() => {
    // 키워드별로 집계
    const keywordMap = new Map<string, { impressions: number; clicks: number; cost: number }>()

    data.forEach((row) => {
      const existing = keywordMap.get(row.keyword) || { impressions: 0, clicks: 0, cost: 0 }
      keywordMap.set(row.keyword, {
        impressions: existing.impressions + row.impressions,
        clicks: existing.clicks + row.clicks,
        cost: existing.cost + row.total_cost,
      })
    })

    return Array.from(keywordMap.entries())
      .map(([keyword, values]) => ({
        keyword: keyword.length > 10 ? keyword.slice(0, 10) + '...' : keyword,
        fullKeyword: keyword,
        ...values,
        ctr: values.impressions > 0 ? ((values.clicks / values.impressions) * 100).toFixed(2) : 0,
        cpc: values.clicks > 0 ? Math.round(values.cost / values.clicks) : 0,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)
  }, [data])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">데이터가 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="keyword" type="category" tick={{ fontSize: 11 }} width={75} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number, name: string) => {
                  if (name === '비용') return [formatNumber(value) + '원', name]
                  return [formatNumber(value), name]
                }}
              />
              <Legend />
              <Bar dataKey="cost" name="비용" fill="#10B981" />
              <Bar dataKey="clicks" name="클릭" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// 키워드별 지출 도넛 차트 (데스크톱) / 수평 바 차트 (모바일)
const DONUT_COLORS = [
  '#3B82F6', // 파랑
  '#10B981', // 초록
  '#F59E0B', // 주황
  '#8B5CF6', // 보라
  '#EF4444', // 빨강
  '#06B6D4', // 청록
  '#EC4899', // 분홍
  '#84CC16', // 라임
  '#F97316', // 오렌지
  '#6366F1', // 인디고
]

interface KeywordSpendData {
  keyword: string
  total_cost: number
}

interface NaverKeywordDonutChartProps {
  keywords: KeywordSpendData[]
}

// 모바일용 수평 바 차트 컴포넌트
function MobileHorizontalBarChart({ data, totalSpend }: { data: Array<{ name: string; fullName: string; value: number }>; totalSpend: number }) {
  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const percent = totalSpend > 0 ? (item.value / totalSpend) * 100 : 0
        return (
          <div key={index}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]" title={item.fullName}>
                {item.name}
              </span>
              <span className="text-sm text-gray-500">
                {formatNumber(item.value)}원 ({percent.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${percent}%`,
                  backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length],
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function NaverKeywordDonutChart({ keywords }: NaverKeywordDonutChartProps) {
  const chartData = useMemo(() => {
    // 클릭이 있는 키워드만 필터링하고 지출액 기준으로 정렬
    const filtered = keywords
      .filter(k => k.total_cost > 0)
      .sort((a, b) => b.total_cost - a.total_cost)

    // 상위 8개와 나머지
    const top8 = filtered.slice(0, 8)
    const rest = filtered.slice(8)

    const result = top8.map(k => ({
      name: k.keyword.length > 12 ? k.keyword.slice(0, 12) + '...' : k.keyword,
      fullName: k.keyword,
      value: k.total_cost,
    }))

    if (rest.length > 0) {
      const otherTotal = rest.reduce((sum, k) => sum + k.total_cost, 0)
      result.push({
        name: '기타',
        fullName: `기타 ${rest.length}개 키워드`,
        value: otherTotal,
      })
    }

    return result
  }, [keywords])

  const totalSpend = chartData.reduce((sum, d) => sum + d.value, 0)

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-400">
        데이터 없음
      </div>
    )
  }

  return (
    <>
      {/* 모바일: 수평 바 차트 */}
      <div className="md:hidden">
        <MobileHorizontalBarChart data={chartData} totalSpend={totalSpend} />
      </div>

      {/* 데스크톱: 도넛 차트 */}
      <div className="hidden md:block">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(1)}%)`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props) => {
                const percent = ((value / totalSpend) * 100).toFixed(1)
                return [`${formatNumber(value)}원 (${percent}%)`, props.payload.fullName]
              }}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value, entry) => {
                const data = entry.payload as { value: number }
                return `${value}: ${formatNumber(data.value)}원`
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export function NaverSummaryCards({ data }: { data: NaverDataRow[] }) {
  const summary = useMemo(() => {
    const totalImpressions = data.reduce((sum, r) => sum + r.impressions, 0)
    const totalClicks = data.reduce((sum, r) => sum + r.clicks, 0)
    const totalCost = data.reduce((sum, r) => sum + r.total_cost, 0)
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgCpc = totalClicks > 0 ? totalCost / totalClicks : 0
    const uniqueKeywords = new Set(data.map((r) => r.keyword)).size

    return {
      totalImpressions,
      totalClicks,
      totalCost,
      avgCtr: avgCtr.toFixed(2),
      avgCpc: Math.round(avgCpc),
      uniqueKeywords,
    }
  }, [data])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-gray-900">{formatNumber(summary.totalImpressions)}</div>
          <div className="text-sm text-gray-500">총 노출</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-blue-600">{formatNumber(summary.totalClicks)}</div>
          <div className="text-sm text-gray-500">총 클릭</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-green-600">{formatNumber(summary.totalCost)}원</div>
          <div className="text-sm text-gray-500">총 비용</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-purple-600">{summary.avgCtr}%</div>
          <div className="text-sm text-gray-500">평균 CTR</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-orange-600">{formatNumber(summary.avgCpc)}원</div>
          <div className="text-sm text-gray-500">평균 CPC</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-gray-900">{summary.uniqueKeywords}</div>
          <div className="text-sm text-gray-500">키워드 수</div>
        </CardContent>
      </Card>
    </div>
  )
}
