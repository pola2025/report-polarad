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
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'

interface KeywordStatRow {
  year_month: string
  keyword: string
  pc_searches: number
  mobile_searches: number
  total_searches: number
}

interface KeywordTrendChartProps {
  data: KeywordStatRow[]
  title?: string
}

export function KeywordMonthlyTrendChart({ data, title = '월별 검색량 추이' }: KeywordTrendChartProps) {
  const chartData = useMemo(() => {
    // 월별로 집계
    const monthlyMap = new Map<string, { pc: number; mobile: number; total: number }>()

    data.forEach((row) => {
      const existing = monthlyMap.get(row.year_month) || { pc: 0, mobile: 0, total: 0 }
      monthlyMap.set(row.year_month, {
        pc: existing.pc + row.pc_searches,
        mobile: existing.mobile + row.mobile_searches,
        total: existing.total + row.total_searches,
      })
    })

    return Array.from(monthlyMap.entries())
      .map(([month, values]) => ({
        month,
        displayMonth: month.slice(2), // YY-MM 형식
        ...values,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
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
              <XAxis dataKey="displayMonth" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number, name: string) => [formatNumber(value), name]}
                labelFormatter={(label) => `20${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                name="전체"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="mobile"
                name="모바일"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="pc"
                name="PC"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function KeywordRankingChart({ data, title = 'TOP 키워드' }: KeywordTrendChartProps) {
  const chartData = useMemo(() => {
    // 키워드별로 집계 (전체 기간 합계)
    const keywordMap = new Map<string, { pc: number; mobile: number; total: number }>()

    data.forEach((row) => {
      const existing = keywordMap.get(row.keyword) || { pc: 0, mobile: 0, total: 0 }
      keywordMap.set(row.keyword, {
        pc: existing.pc + row.pc_searches,
        mobile: existing.mobile + row.mobile_searches,
        total: existing.total + row.total_searches,
      })
    })

    return Array.from(keywordMap.entries())
      .map(([keyword, values]) => ({
        keyword: keyword.length > 12 ? keyword.slice(0, 12) + '...' : keyword,
        fullKeyword: keyword,
        ...values,
      }))
      .sort((a, b) => b.total - a.total)
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
                formatter={(value: number, name: string) => [formatNumber(value), name]}
              />
              <Legend />
              <Bar dataKey="mobile" name="모바일" fill="#10B981" stackId="a" />
              <Bar dataKey="pc" name="PC" fill="#F59E0B" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function KeywordComparisonChart({ data, title = '월별 비교' }: KeywordTrendChartProps) {
  const chartData = useMemo(() => {
    // 최근 2개월 데이터 비교
    const months = Array.from(new Set(data.map((d) => d.year_month))).sort().slice(-2)
    if (months.length < 2) return []

    const [prevMonth, currMonth] = months
    const keywordMap = new Map<string, { prev: number; curr: number }>()

    data.forEach((row) => {
      if (row.year_month !== prevMonth && row.year_month !== currMonth) return

      const existing = keywordMap.get(row.keyword) || { prev: 0, curr: 0 }
      if (row.year_month === prevMonth) {
        existing.prev = row.total_searches
      } else {
        existing.curr = row.total_searches
      }
      keywordMap.set(row.keyword, existing)
    })

    return Array.from(keywordMap.entries())
      .map(([keyword, values]) => ({
        keyword: keyword.length > 10 ? keyword.slice(0, 10) + '...' : keyword,
        fullKeyword: keyword,
        [prevMonth]: values.prev,
        [currMonth]: values.curr,
        change: values.prev > 0 ? ((values.curr - values.prev) / values.prev * 100).toFixed(1) : 0,
        prevMonth,
        currMonth,
      }))
      .sort((a, b) => (b[currMonth] as number) - (a[currMonth] as number))
      .slice(0, 8)
  }, [data])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">비교할 데이터가 부족합니다 (최소 2개월 필요).</p>
        </CardContent>
      </Card>
    )
  }

  const prevMonth = chartData[0].prevMonth
  const currMonth = chartData[0].currMonth

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="keyword" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number, name: string) => [formatNumber(value), name]}
              />
              <Legend />
              <Bar dataKey={prevMonth} name={prevMonth} fill="#94A3B8" />
              <Bar dataKey={currMonth} name={currMonth} fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function KeywordSummaryCards({ data }: { data: KeywordStatRow[] }) {
  const summary = useMemo(() => {
    // 최신 월 데이터만
    const months = Array.from(new Set(data.map((d) => d.year_month))).sort()
    const latestMonth = months[months.length - 1]
    const prevMonth = months[months.length - 2]

    const latestData = data.filter((d) => d.year_month === latestMonth)
    const prevData = data.filter((d) => d.year_month === prevMonth)

    const latestTotal = latestData.reduce((sum, r) => sum + r.total_searches, 0)
    const latestPc = latestData.reduce((sum, r) => sum + r.pc_searches, 0)
    const latestMobile = latestData.reduce((sum, r) => sum + r.mobile_searches, 0)
    const latestKeywords = latestData.length

    const prevTotal = prevData.reduce((sum, r) => sum + r.total_searches, 0)
    const changePercent = prevTotal > 0 ? ((latestTotal - prevTotal) / prevTotal * 100).toFixed(1) : 0

    return {
      latestMonth,
      totalSearches: latestTotal,
      pcSearches: latestPc,
      mobileSearches: latestMobile,
      keywordCount: latestKeywords,
      changePercent,
      mobileRatio: latestTotal > 0 ? ((latestMobile / latestTotal) * 100).toFixed(1) : 0,
    }
  }, [data])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-gray-900">{summary.latestMonth || '-'}</div>
          <div className="text-sm text-gray-500">기준 월</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-blue-600">{formatNumber(summary.totalSearches)}</div>
          <div className="text-sm text-gray-500">총 검색량</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-green-600">{formatNumber(summary.mobileSearches)}</div>
          <div className="text-sm text-gray-500">모바일</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-orange-600">{formatNumber(summary.pcSearches)}</div>
          <div className="text-sm text-gray-500">PC</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className={`text-2xl font-bold ${Number(summary.changePercent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Number(summary.changePercent) >= 0 ? '+' : ''}{summary.changePercent}%
          </div>
          <div className="text-sm text-gray-500">전월 대비</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-purple-600">{summary.mobileRatio}%</div>
          <div className="text-sm text-gray-500">모바일 비율</div>
        </CardContent>
      </Card>
    </div>
  )
}
