/**
 * GA4 Analytics API
 * Google Analytics 4 데이터 조회
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  getGA4Credentials,
  fetchGA4DailyData,
  fetchGA4Sources,
  fetchGA4LandingPages,
  fetchGA4SearchTerms,
  calculateGA4Summary,
} from '@/lib/ga4'
import type {
  GA4DailyData,
  GA4WeeklyData,
  GA4MonthlyData,
  GA4Summary,
  GA4Comparison,
  GA4AnalyticsResponse,
} from '@/types/ga4-analytics'

// GA4 지원 클라이언트 설정
const GA4_CLIENTS: Record<string, { propertyId: string; name: string }> = {
  naratton: {
    propertyId: process.env.GA4_NARATTON_PROPERTY_ID || '497585078',
    name: '나라똔',
  },
}

// 주차 계산 (월요일 시작)
function getWeekLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const jan1 = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((days + jan1.getDay() + 1) / 7)
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// 주의 시작일 (월요일)
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date.setDate(diff))
  return monday.toISOString().split('T')[0]
}

// 주의 종료일 (일요일)
function getWeekEnd(dateStr: string): string {
  const start = new Date(getWeekStart(dateStr))
  start.setDate(start.getDate() + 6)
  return start.toISOString().split('T')[0]
}

// 이전 기간 날짜 계산
function getPreviousPeriod(startDate: string, endDate: string): { start: string; end: string } {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1

  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)

  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - days + 1)

  return {
    start: prevStart.toISOString().split('T')[0],
    end: prevEnd.toISOString().split('T')[0],
  }
}

// 일별 데이터를 주별로 집계
function aggregateToWeekly(daily: GA4DailyData[]): GA4WeeklyData[] {
  const weeklyMap = new Map<
    string,
    GA4WeeklyData & { totalBounceRate: number; totalDuration: number; dayCount: number }
  >()

  for (const d of daily) {
    const weekLabel = getWeekLabel(d.date)
    if (!weeklyMap.has(weekLabel)) {
      weeklyMap.set(weekLabel, {
        weekStart: getWeekStart(d.date),
        weekEnd: getWeekEnd(d.date),
        weekLabel,
        sessions: 0,
        users: 0,
        newUsers: 0,
        pageviews: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
        conversions: 0,
        totalBounceRate: 0,
        totalDuration: 0,
        dayCount: 0,
      })
    }
    const week = weeklyMap.get(weekLabel)!
    week.sessions += d.sessions
    week.users += d.users
    week.newUsers += d.newUsers
    week.pageviews += d.pageviews
    week.conversions += d.conversions
    week.totalBounceRate += d.bounceRate
    week.totalDuration += d.avgSessionDuration
    week.dayCount += 1
  }

  return Array.from(weeklyMap.values())
    .map((w) => ({
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      weekLabel: w.weekLabel,
      sessions: w.sessions,
      users: w.users,
      newUsers: w.newUsers,
      pageviews: w.pageviews,
      bounceRate: w.dayCount > 0 ? Math.round((w.totalBounceRate / w.dayCount) * 100) / 100 : 0,
      avgSessionDuration: w.dayCount > 0 ? Math.round(w.totalDuration / w.dayCount) : 0,
      conversions: w.conversions,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

// 일별 데이터를 월별로 집계
function aggregateToMonthly(daily: GA4DailyData[]): GA4MonthlyData[] {
  const monthlyMap = new Map<
    string,
    GA4MonthlyData & { totalBounceRate: number; totalDuration: number; dayCount: number }
  >()

  for (const d of daily) {
    const month = d.date.substring(0, 7)
    if (!monthlyMap.has(month)) {
      const [year, m] = month.split('-')
      monthlyMap.set(month, {
        month,
        monthLabel: `${year}년 ${parseInt(m)}월`,
        sessions: 0,
        users: 0,
        newUsers: 0,
        pageviews: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
        conversions: 0,
        totalBounceRate: 0,
        totalDuration: 0,
        dayCount: 0,
      })
    }
    const monthData = monthlyMap.get(month)!
    monthData.sessions += d.sessions
    monthData.users += d.users
    monthData.newUsers += d.newUsers
    monthData.pageviews += d.pageviews
    monthData.conversions += d.conversions
    monthData.totalBounceRate += d.bounceRate
    monthData.totalDuration += d.avgSessionDuration
    monthData.dayCount += 1
  }

  return Array.from(monthlyMap.values())
    .map((m) => ({
      month: m.month,
      monthLabel: m.monthLabel,
      sessions: m.sessions,
      users: m.users,
      newUsers: m.newUsers,
      pageviews: m.pageviews,
      bounceRate: m.dayCount > 0 ? Math.round((m.totalBounceRate / m.dayCount) * 100) / 100 : 0,
      avgSessionDuration: m.dayCount > 0 ? Math.round(m.totalDuration / m.dayCount) : 0,
      conversions: m.conversions,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

// 기간 비교 계산
function calculateComparison(current: GA4Summary, previous: GA4Summary): GA4Comparison {
  const calcChange = (curr: number, prev: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 10000) / 100
  }

  return {
    current,
    previous,
    changes: {
      sessions: calcChange(current.totalSessions, previous.totalSessions),
      users: calcChange(current.totalUsers, previous.totalUsers),
      newUsers: calcChange(current.totalNewUsers, previous.totalNewUsers),
      pageviews: calcChange(current.totalPageviews, previous.totalPageviews),
      bounceRate: calcChange(current.avgBounceRate, previous.avgBounceRate),
      sessionDuration: calcChange(current.avgSessionDuration, previous.avgSessionDuration),
      conversions: calcChange(current.totalConversions, previous.totalConversions),
    },
  }
}

// 빈 응답 생성
function createEmptyResponse(): GA4AnalyticsResponse {
  const emptySummary: GA4Summary = {
    totalSessions: 0,
    totalUsers: 0,
    totalNewUsers: 0,
    totalPageviews: 0,
    avgBounceRate: 0,
    avgSessionDuration: 0,
    totalConversions: 0,
    avgConversionRate: 0,
    dateRange: { start: '', end: '' },
  }

  return {
    success: true,
    data: {
      daily: [],
      weekly: [],
      monthly: [],
      sources: [],
      landingPages: [],
      searchTerms: [],
      summary: emptySummary,
      comparison: {
        current: emptySummary,
        previous: emptySummary,
        changes: {
          sessions: 0,
          users: 0,
          newUsers: 0,
          pageviews: 0,
          bounceRate: 0,
          sessionDuration: 0,
          conversions: 0,
        },
      },
    },
  }
}

// GET: GA4 분석 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug') || searchParams.get('clientId')
    const startDate = searchParams.get('startDate') || getDefaultStartDate()
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const view = searchParams.get('view') || 'all'

    // 클라이언트 확인
    if (!clientSlug || !GA4_CLIENTS[clientSlug]) {
      return NextResponse.json(
        {
          success: false,
          error: `GA4가 지원되지 않는 클라이언트입니다. 지원 클라이언트: ${Object.keys(GA4_CLIENTS).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // GA4 자격 증명 확인
    const credentials = getGA4Credentials()
    if (!credentials) {
      return NextResponse.json(
        {
          success: false,
          error: 'GA4 서비스 계정이 설정되지 않았습니다.',
        },
        { status: 500 }
      )
    }

    const { propertyId } = GA4_CLIENTS[clientSlug]

    // 현재 기간 데이터 조회
    const [daily, sources, landingPages, searchTerms] = await Promise.all([
      fetchGA4DailyData(propertyId, credentials, startDate, endDate),
      fetchGA4Sources(propertyId, credentials, startDate, endDate),
      fetchGA4LandingPages(propertyId, credentials, startDate, endDate),
      fetchGA4SearchTerms(propertyId, credentials, startDate, endDate),
    ])

    if (daily.length === 0) {
      return NextResponse.json(createEmptyResponse())
    }

    // 주별/월별 집계
    const weekly = aggregateToWeekly(daily)
    const monthly = aggregateToMonthly(daily)

    // 현재 기간 요약
    const currentSummary = calculateGA4Summary(daily, startDate, endDate)

    // 이전 기간 데이터 조회 (비교용)
    const prevPeriod = getPreviousPeriod(startDate, endDate)
    let previousSummary: GA4Summary

    try {
      const prevDaily = await fetchGA4DailyData(
        propertyId,
        credentials,
        prevPeriod.start,
        prevPeriod.end
      )
      previousSummary = calculateGA4Summary(prevDaily, prevPeriod.start, prevPeriod.end)
    } catch {
      previousSummary = {
        totalSessions: 0,
        totalUsers: 0,
        totalNewUsers: 0,
        totalPageviews: 0,
        avgBounceRate: 0,
        avgSessionDuration: 0,
        totalConversions: 0,
        avgConversionRate: 0,
        dateRange: prevPeriod,
      }
    }

    // 기간 비교
    const comparison = calculateComparison(currentSummary, previousSummary)

    // 응답 구성
    const response: GA4AnalyticsResponse = {
      success: true,
      data: {
        daily: view === 'all' || view === 'daily' ? daily : [],
        weekly: view === 'all' || view === 'weekly' ? weekly : [],
        monthly: view === 'all' || view === 'monthly' ? monthly : [],
        sources: view === 'all' || view === 'sources' ? sources : [],
        landingPages: view === 'all' || view === 'pages' ? landingPages : [],
        searchTerms: view === 'all' || view === 'search' ? searchTerms : [],
        summary: currentSummary,
        comparison,
      },
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('GA4 analytics error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'GA4 데이터 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

// 기본 시작 날짜 (30일 전)
function getDefaultStartDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().split('T')[0]
}
