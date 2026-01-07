/**
 * 마케팅 퍼널 분석 API
 * GA4 유입 + GA4 이벤트(폼 제출) + Meta 리드 통합 분석
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  getGA4Credentials,
  fetchGA4DailyData,
  fetchGA4EventDaily,
  fetchGA4Sources,
} from '@/lib/ga4'
import { fetchAirtableData } from '@/lib/airtable'
import type {
  FunnelAnalysisResponse,
  FunnelStage,
  FunnelConversionRates,
  FunnelDailyTrend,
  ChannelFunnelData,
  CorrelationData,
} from '@/types/ga4-analytics'

// GA4 지원 클라이언트 설정
const GA4_CLIENTS: Record<string, { propertyId: string; name: string }> = {
  naratton: {
    propertyId: process.env.GA4_NARATTON_PROPERTY_ID || '497585078',
    name: '나라똔',
  },
}

// 피어슨 상관계수 계산
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0

  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0)
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0)
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 100) / 100
}

// 채널 매핑 (source/medium → 채널명)
function mapToChannel(source: string, medium: string): string {
  const s = source.toLowerCase()
  const m = medium.toLowerCase()

  if (s.includes('facebook') || s.includes('instagram') || s.includes('fb') || s.includes('ig')) {
    return 'Meta'
  }
  if (s.includes('naver') || s.includes('band')) {
    return 'Naver'
  }
  if (s.includes('google') && m.includes('cpc')) {
    return 'Google Ads'
  }
  if (s.includes('google') && (m.includes('organic') || m === '(none)')) {
    return 'Organic'
  }
  if (s === '(direct)' || s === 'direct') {
    return 'Direct'
  }
  if (m.includes('referral')) {
    return 'Referral'
  }
  return 'Other'
}

// 기본 시작 날짜 (30일 전)
function getDefaultStartDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().split('T')[0]
}

// GET: 퍼널 분석 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug') || searchParams.get('clientId')
    const startDate = searchParams.get('startDate') || getDefaultStartDate()
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]

    // 클라이언트 확인
    if (!clientSlug || !GA4_CLIENTS[clientSlug]) {
      return NextResponse.json(
        {
          success: false,
          error: `퍼널 분석은 현재 나라똔만 지원됩니다. clientSlug: ${clientSlug}`,
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

    // 병렬로 데이터 조회
    const [ga4Daily, ga4Events, ga4Sources, metaData] = await Promise.all([
      // GA4 일별 데이터 (세션, 사용자)
      fetchGA4DailyData(propertyId, credentials, startDate, endDate),
      // GA4 이벤트 데이터 (폼 제출)
      fetchGA4EventDaily(propertyId, credentials, startDate, endDate, 'generate_lead'),
      // GA4 소스별 데이터
      fetchGA4Sources(propertyId, credentials, startDate, endDate),
      // Meta 광고 데이터
      fetchAirtableData(clientSlug, startDate, endDate, 'meta'),
    ])

    // === 퍼널 데이터 집계 ===

    // 1. 전체 수치 계산
    const totalUsers = ga4Daily.reduce((sum, d) => sum + d.users, 0)
    const totalSessions = ga4Daily.reduce((sum, d) => sum + d.sessions, 0)
    const totalSubmissions = ga4Events.reduce((sum, d) => sum + d.eventCount, 0)
    const totalLeads = metaData.reduce((sum, d) => sum + (d.leads || 0), 0)
    const totalSpend = metaData.reduce((sum, d) => sum + (d.spend || 0), 0)

    // 2. 퍼널 단계
    const stages: FunnelStage[] = [
      {
        name: '유입',
        metric: 'users',
        value: totalUsers,
        rate: 100,
        color: '#3B82F6',
      },
      {
        name: '방문',
        metric: 'sessions',
        value: totalSessions,
        rate: totalUsers > 0 ? Math.round((totalSessions / totalUsers) * 10000) / 100 : 0,
        color: '#10B981',
      },
      {
        name: '홈페이지 접수',
        metric: 'submissions',
        value: totalSubmissions,
        rate: totalUsers > 0 ? Math.round((totalSubmissions / totalUsers) * 10000) / 100 : 0,
        color: '#F59E0B',
      },
      {
        name: '광고 리드',
        metric: 'leads',
        value: totalLeads,
        rate: totalUsers > 0 ? Math.round((totalLeads / totalUsers) * 10000) / 100 : 0,
        color: '#EF4444',
      },
    ]

    // 3. 전환율
    const conversionRates: FunnelConversionRates = {
      visitToSubmit: totalSessions > 0
        ? Math.round((totalSubmissions / totalSessions) * 10000) / 100
        : 0,
      submitToLead: totalSubmissions > 0
        ? Math.round((totalLeads / totalSubmissions) * 10000) / 100
        : 0,
      overallConversion: totalUsers > 0
        ? Math.round((totalLeads / totalUsers) * 10000) / 100
        : 0,
    }

    // 4. 일별 추이 데이터
    const dailyMap = new Map<string, FunnelDailyTrend>()

    // GA4 일별 데이터 추가
    for (const d of ga4Daily) {
      dailyMap.set(d.date, {
        date: d.date,
        users: d.users,
        sessions: d.sessions,
        submissions: 0,
        leads: 0,
      })
    }

    // GA4 이벤트 데이터 병합
    for (const d of ga4Events) {
      const existing = dailyMap.get(d.date)
      if (existing) {
        existing.submissions = d.eventCount
      } else {
        dailyMap.set(d.date, {
          date: d.date,
          users: 0,
          sessions: 0,
          submissions: d.eventCount,
          leads: 0,
        })
      }
    }

    // Meta 리드 데이터 병합
    for (const d of metaData) {
      const existing = dailyMap.get(d.date)
      if (existing) {
        existing.leads += d.leads || 0
      } else {
        dailyMap.set(d.date, {
          date: d.date,
          users: 0,
          sessions: 0,
          submissions: 0,
          leads: d.leads || 0,
        })
      }
    }

    const dailyTrend = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))

    // 5. 상관관계 분석
    const sessions = dailyTrend.map(d => d.sessions)
    const submissions = dailyTrend.map(d => d.submissions)
    const leads = dailyTrend.map(d => d.leads)

    // 일별 지출액 계산
    const spendMap = new Map<string, number>()
    for (const d of metaData) {
      spendMap.set(d.date, (spendMap.get(d.date) || 0) + (d.spend || 0))
    }
    const spends = dailyTrend.map(d => spendMap.get(d.date) || 0)

    const correlation: CorrelationData = {
      sessionsVsSubmissions: pearsonCorrelation(sessions, submissions),
      submissionsVsLeads: pearsonCorrelation(submissions, leads),
      spendVsLeads: pearsonCorrelation(spends, leads),
    }

    // 6. 채널별 데이터
    const channelMap = new Map<string, {
      users: number
      sessions: number
      conversions: number
    }>()

    for (const s of ga4Sources) {
      const channel = mapToChannel(s.source, s.medium)
      const existing = channelMap.get(channel) || { users: 0, sessions: 0, conversions: 0 }
      existing.users += s.users
      existing.sessions += s.sessions
      existing.conversions += s.conversions
      channelMap.set(channel, existing)
    }

    // 채널별 지출액 (Meta만)
    const metaSpend = totalSpend

    const byChannel: ChannelFunnelData[] = Array.from(channelMap.entries())
      .map(([channel, data]) => {
        const isMeta = channel === 'Meta'
        const channelLeads = isMeta ? totalLeads : 0
        const channelSubmissions = data.conversions // GA4 conversions를 submissions로 사용
        const channelSpend = isMeta ? metaSpend : 0

        return {
          channel,
          users: data.users,
          sessions: data.sessions,
          submissions: channelSubmissions,
          leads: channelLeads,
          spend: channelSpend,
          cpl: channelLeads > 0 ? Math.round(channelSpend / channelLeads) : null,
          conversionRate: data.sessions > 0
            ? Math.round((channelLeads / data.sessions) * 10000) / 100
            : 0,
        }
      })
      .sort((a, b) => b.sessions - a.sessions)

    // 응답 구성
    const response: FunnelAnalysisResponse = {
      success: true,
      data: {
        funnel: {
          stages,
          conversionRates,
        },
        trend: {
          daily: dailyTrend,
        },
        correlation,
        byChannel,
      },
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Funnel analysis error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '퍼널 분석 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
