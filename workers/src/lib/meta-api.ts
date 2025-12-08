import type { Env, DailyAggregate } from '../types'

// Meta Graph API Insights 데이터 구조
export interface MetaInsight {
  ad_id: string
  ad_name: string
  campaign_id: string
  campaign_name: string
  date_start: string
  date_stop: string
  impressions: string
  inline_link_clicks?: string
  spend: string
  publisher_platform?: string
  device_platform?: string
  account_currency?: string
  actions?: Array<{
    action_type: string
    value: string
  }>
  video_avg_time_watched_actions?: Array<{
    action_type: string
    value: string
  }>
}

/**
 * Meta Graph API에서 Insights 데이터 조회
 */
export async function fetchMetaInsights(
  env: Env,
  startDate: string,
  endDate: string
): Promise<MetaInsight[]> {
  const url = `https://graph.facebook.com/v22.0/${env.META_AD_ACCOUNT_ID}/insights`

  const params = new URLSearchParams({
    access_token: env.META_ACCESS_TOKEN,
    level: 'ad',
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    fields: 'ad_id,ad_name,campaign_id,campaign_name,impressions,inline_link_clicks,spend,actions,video_avg_time_watched_actions,account_currency',
    breakdowns: 'publisher_platform,device_platform',
    time_increment: '1',
    limit: '500',
  })

  console.log(`📞 Meta API 호출: ${startDate} ~ ${endDate}`)

  let allData: MetaInsight[] = []
  let nextUrl: string | null = `${url}?${params}`

  try {
    while (nextUrl) {
      const response = await fetch(nextUrl)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Meta API Error (${response.status}): ${errorText}`)
      }

      const result = await response.json() as { data: MetaInsight[]; paging?: { next?: string } }
      const data = result.data || []

      allData = allData.concat(data)
      nextUrl = result.paging?.next || null

      if (nextUrl) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    console.log(`✅ Meta API 응답: ${allData.length}건`)
    return allData
  } catch (error) {
    console.error('❌ Meta API 호출 실패:', error)
    throw error
  }
}

/**
 * actions 배열에서 특정 action_type 값 추출
 */
function extractActionValue(actions?: Array<{ action_type: string; value: string }>, actionType: string = 'lead'): number {
  if (!actions || actions.length === 0) return 0
  const action = actions.find((a) => a.action_type === actionType)
  return action ? parseInt(action.value, 10) : 0
}

/**
 * video_avg_time_watched_actions에서 평균 시청 시간 추출 (초 단위)
 */
function extractAvgWatchTime(videoActions?: Array<{ action_type: string; value: string }>): number {
  if (!videoActions || videoActions.length === 0) return 0
  const action = videoActions.find((a) => a.action_type === 'video_view')
  return action ? parseFloat(action.value) : 0
}

/**
 * Meta Insights 데이터를 DailyAggregate 형식으로 변환
 */
export function transformMetaData(insightsData: MetaInsight[], clientId: string): DailyAggregate[] {
  console.log(`🔄 데이터 변환 시작: ${insightsData.length}건`)

  const transformed = insightsData.map((row) => ({
    client_id: clientId,
    date: row.date_start,
    ad_id: row.ad_id,
    ad_name: row.ad_name,
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    platform: row.publisher_platform || 'unknown',
    device: row.device_platform || 'unknown',
    impressions: parseInt(row.impressions, 10) || 0,
    clicks: parseInt(row.inline_link_clicks || '0', 10) || 0,
    spend: parseFloat(row.spend) || 0,
    leads: extractActionValue(row.actions, 'lead'),
    video_views: extractActionValue(row.actions, 'video_view'),
    avg_watch_time: extractAvgWatchTime(row.video_avg_time_watched_actions),
    currency: row.account_currency || 'KRW',
  }))

  const totalLeads = transformed.reduce((sum, item) => sum + item.leads, 0)
  const totalVideoViews = transformed.reduce((sum, item) => sum + item.video_views, 0)
  const totalSpend = transformed.reduce((sum, item) => sum + item.spend, 0)
  console.log(`✅ 변환 완료: 리드 ${totalLeads}건, 영상조회 ${totalVideoViews}건, 지출 ₩${totalSpend.toLocaleString()}`)

  return transformed
}

/**
 * Meta API에서 데이터 수집 및 변환 (통합 함수)
 */
export async function collectMetaData(
  env: Env,
  clientId: string,
  startDate: string,
  endDate: string
): Promise<DailyAggregate[]> {
  console.log(`🚀 Meta 데이터 수집 시작: ${startDate} ~ ${endDate}`)

  const insights = await fetchMetaInsights(env, startDate, endDate)

  if (insights.length === 0) {
    console.warn('⚠️ Meta API에서 데이터를 가져올 수 없습니다')
    return []
  }

  const aggregates = transformMetaData(insights, clientId)

  return aggregates
}
