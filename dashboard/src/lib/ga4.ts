/**
 * GA4 Data API 클라이언트
 * Google Analytics 4 데이터 조회
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data'
import type {
  GA4DailyData,
  GA4SourceMedium,
  GA4LandingPage,
  GA4SearchTerm,
  GA4Summary,
  GA4Credentials,
  GA4EventData,
  GA4EventBySource,
  GA4EventSummary,
} from '@/types/ga4-analytics'

// GA4 클라이언트 초기화
function createGA4Client(credentials: GA4Credentials): BetaAnalyticsDataClient {
  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key.replace(/\\n/g, '\n'),
    },
  })
}

// 환경변수에서 자격 증명 로드
export function getGA4Credentials(): GA4Credentials | null {
  const jsonStr = process.env.GA4_SERVICE_ACCOUNT_JSON
  if (!jsonStr) {
    console.error('GA4_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않았습니다.')
    return null
  }

  try {
    const parsed = JSON.parse(jsonStr)
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    }
  } catch (error) {
    console.error('GA4 자격 증명 파싱 오류:', error)
    return null
  }
}

// 일별 데이터 조회
export async function fetchGA4DailyData(
  propertyId: string,
  credentials: GA4Credentials,
  startDate: string,
  endDate: string
): Promise<GA4DailyData[]> {
  const client = createGA4Client(credentials)

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'conversions' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
  })

  if (!response.rows) return []

  return response.rows.map((row) => {
    const date = row.dimensionValues?.[0]?.value || ''
    const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`

    const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10)
    const users = parseInt(row.metricValues?.[1]?.value || '0', 10)
    const newUsers = parseInt(row.metricValues?.[2]?.value || '0', 10)
    const pageviews = parseInt(row.metricValues?.[3]?.value || '0', 10)
    const bounceRate = parseFloat(row.metricValues?.[4]?.value || '0') * 100
    const avgSessionDuration = parseFloat(row.metricValues?.[5]?.value || '0')
    const conversions = parseInt(row.metricValues?.[6]?.value || '0', 10)

    return {
      date: formattedDate,
      sessions,
      users,
      newUsers,
      pageviews,
      bounceRate: Math.round(bounceRate * 100) / 100,
      avgSessionDuration: Math.round(avgSessionDuration),
      conversions,
      conversionRate: sessions > 0 ? Math.round((conversions / sessions) * 10000) / 100 : 0,
    }
  })
}

// 소스/매체별 데이터 조회
export async function fetchGA4Sources(
  propertyId: string,
  credentials: GA4Credentials,
  startDate: string,
  endDate: string
): Promise<GA4SourceMedium[]> {
  const client = createGA4Client(credentials)

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'conversions' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  })

  if (!response.rows) return []

  return response.rows.map((row) => {
    const source = row.dimensionValues?.[0]?.value || '(direct)'
    const medium = row.dimensionValues?.[1]?.value || '(none)'

    return {
      source,
      medium,
      sourceMedium: `${source} / ${medium}`,
      sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
      users: parseInt(row.metricValues?.[1]?.value || '0', 10),
      newUsers: parseInt(row.metricValues?.[2]?.value || '0', 10),
      conversions: parseInt(row.metricValues?.[3]?.value || '0', 10),
      bounceRate: Math.round(parseFloat(row.metricValues?.[4]?.value || '0') * 10000) / 100,
    }
  })
}

// 랜딩페이지 데이터 조회
export async function fetchGA4LandingPages(
  propertyId: string,
  credentials: GA4Credentials,
  startDate: string,
  endDate: string
): Promise<GA4LandingPage[]> {
  const client = createGA4Client(credentials)

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'landingPage' },
      { name: 'landingPagePlusQueryString' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  })

  if (!response.rows) return []

  return response.rows.map((row) => ({
    pagePath: row.dimensionValues?.[0]?.value || '/',
    pageTitle: row.dimensionValues?.[1]?.value || '/',
    sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
    users: parseInt(row.metricValues?.[1]?.value || '0', 10),
    bounceRate: Math.round(parseFloat(row.metricValues?.[2]?.value || '0') * 10000) / 100,
    avgSessionDuration: Math.round(parseFloat(row.metricValues?.[3]?.value || '0')),
  }))
}

// 검색어 데이터 조회
export async function fetchGA4SearchTerms(
  propertyId: string,
  credentials: GA4Credentials,
  startDate: string,
  endDate: string
): Promise<GA4SearchTerm[]> {
  const client = createGA4Client(credentials)

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionGoogleAdsQuery' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  })

  if (!response.rows) return []

  return response.rows
    .filter((row) => row.dimensionValues?.[0]?.value && row.dimensionValues[0].value !== '(not set)')
    .map((row) => ({
      searchTerm: row.dimensionValues?.[0]?.value || '',
      sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
      users: parseInt(row.metricValues?.[1]?.value || '0', 10),
    }))
}

// 요약 데이터 계산
export function calculateGA4Summary(dailyData: GA4DailyData[], startDate: string, endDate: string): GA4Summary {
  const totalSessions = dailyData.reduce((sum, d) => sum + d.sessions, 0)
  const totalUsers = dailyData.reduce((sum, d) => sum + d.users, 0)
  const totalNewUsers = dailyData.reduce((sum, d) => sum + d.newUsers, 0)
  const totalPageviews = dailyData.reduce((sum, d) => sum + d.pageviews, 0)
  const totalConversions = dailyData.reduce((sum, d) => sum + d.conversions, 0)

  const avgBounceRate = dailyData.length > 0
    ? dailyData.reduce((sum, d) => sum + d.bounceRate, 0) / dailyData.length
    : 0

  const avgSessionDuration = dailyData.length > 0
    ? dailyData.reduce((sum, d) => sum + d.avgSessionDuration, 0) / dailyData.length
    : 0

  const avgConversionRate = totalSessions > 0
    ? (totalConversions / totalSessions) * 100
    : 0

  return {
    totalSessions,
    totalUsers,
    totalNewUsers,
    totalPageviews,
    avgBounceRate: Math.round(avgBounceRate * 100) / 100,
    avgSessionDuration: Math.round(avgSessionDuration),
    totalConversions,
    avgConversionRate: Math.round(avgConversionRate * 100) / 100,
    dateRange: { start: startDate, end: endDate },
  }
}

// 전체 GA4 데이터 조회
export async function fetchAllGA4Data(
  propertyId: string,
  credentials: GA4Credentials,
  startDate: string,
  endDate: string
) {
  const [daily, sources, landingPages, searchTerms] = await Promise.all([
    fetchGA4DailyData(propertyId, credentials, startDate, endDate),
    fetchGA4Sources(propertyId, credentials, startDate, endDate),
    fetchGA4LandingPages(propertyId, credentials, startDate, endDate),
    fetchGA4SearchTerms(propertyId, credentials, startDate, endDate),
  ])

  const summary = calculateGA4Summary(daily, startDate, endDate)

  return {
    daily,
    sources,
    landingPages,
    searchTerms,
    summary,
  }
}

// 특정 이벤트 일별 데이터 조회
export async function fetchGA4EventDaily(
  propertyId: string,
  credentials: GA4Credentials,
  startDate: string,
  endDate: string,
  eventName: string = 'generate_lead'
): Promise<GA4EventData[]> {
  const client = createGA4Client(credentials)

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'eventCount' },
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: {
          matchType: 'EXACT',
          value: eventName,
        },
      },
    },
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
  })

  if (!response.rows) return []

  return response.rows.map((row) => {
    const date = row.dimensionValues?.[0]?.value || ''
    const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`

    return {
      date: formattedDate,
      eventName,
      eventCount: parseInt(row.metricValues?.[0]?.value || '0', 10),
      sessions: parseInt(row.metricValues?.[1]?.value || '0', 10),
      users: parseInt(row.metricValues?.[2]?.value || '0', 10),
    }
  })
}

// 이벤트 소스/매체별 데이터 조회
export async function fetchGA4EventBySource(
  propertyId: string,
  credentials: GA4Credentials,
  startDate: string,
  endDate: string,
  eventName: string = 'generate_lead'
): Promise<GA4EventBySource[]> {
  const client = createGA4Client(credentials)

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ],
    metrics: [
      { name: 'eventCount' },
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: {
          matchType: 'EXACT',
          value: eventName,
        },
      },
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 20,
  })

  if (!response.rows) return []

  return response.rows.map((row) => {
    const source = row.dimensionValues?.[0]?.value || '(direct)'
    const medium = row.dimensionValues?.[1]?.value || '(none)'
    const eventCount = parseInt(row.metricValues?.[0]?.value || '0', 10)
    const sessions = parseInt(row.metricValues?.[1]?.value || '0', 10)
    const users = parseInt(row.metricValues?.[2]?.value || '0', 10)

    return {
      sourceMedium: `${source} / ${medium}`,
      eventCount,
      sessions,
      users,
      conversionRate: sessions > 0 ? Math.round((eventCount / sessions) * 10000) / 100 : 0,
    }
  })
}

// 이벤트 요약 계산
export function calculateGA4EventSummary(
  eventData: GA4EventData[],
  eventName: string,
  startDate: string,
  endDate: string
): GA4EventSummary {
  const totalEvents = eventData.reduce((sum, d) => sum + d.eventCount, 0)
  const totalSessions = eventData.reduce((sum, d) => sum + d.sessions, 0)
  const totalUsers = eventData.reduce((sum, d) => sum + d.users, 0)

  return {
    eventName,
    totalEvents,
    totalSessions,
    totalUsers,
    conversionRate: totalSessions > 0 ? Math.round((totalEvents / totalSessions) * 10000) / 100 : 0,
    dateRange: { start: startDate, end: endDate },
  }
}

// 전체 이벤트 데이터 조회
export async function fetchGA4EventData(
  propertyId: string,
  credentials: GA4Credentials,
  startDate: string,
  endDate: string,
  eventName: string = 'generate_lead'
) {
  const [daily, bySource] = await Promise.all([
    fetchGA4EventDaily(propertyId, credentials, startDate, endDate, eventName),
    fetchGA4EventBySource(propertyId, credentials, startDate, endDate, eventName),
  ])

  const summary = calculateGA4EventSummary(daily, eventName, startDate, endDate)

  return {
    daily,
    bySource,
    summary,
  }
}
