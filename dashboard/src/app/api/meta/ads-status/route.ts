/**
 * Meta 광고 ON/OFF 상태 조회 API
 *
 * Meta Marketing API에서 캠페인/광고세트/광고의 effective_status를 실시간 조회
 * 캠페인 OFF → 하위 광고세트/광고 모두 OFF (effective_status가 이미 반영)
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, TABLES } from '@/lib/supabase'

// Meta effective_status → 활성 여부
function isActive(status: string): boolean {
  return status === 'ACTIVE'
}

// Meta effective_status → 한글 라벨
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: '활성',
    PAUSED: '일시중지',
    DELETED: '삭제됨',
    ARCHIVED: '보관됨',
    IN_PROCESS: '처리중',
    WITH_ISSUES: '문제있음',
    CAMPAIGN_PAUSED: '캠페인 중지',
    ADSET_PAUSED: '광고세트 중지',
  }
  return map[status] || status
}

// Meta API 페이지네이션 처리
async function fetchAllPages<T>(url: string): Promise<T[]> {
  const all: T[] = []
  let nextUrl: string | null = url

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, { cache: 'no-store' })
    const data: { data?: T[]; error?: { message: string }; paging?: { next?: string } } = await response.json()

    if (data.error) {
      throw new Error(`Meta API: ${data.error.message}`)
    }

    if (data.data) {
      all.push(...data.data)
    }

    nextUrl = data.paging?.next || null
  }

  return all
}

// 응답 타입
interface CampaignStatus {
  id: string
  name: string
  effective_status: string
  configured_status: string
  is_active: boolean
  status_label: string
  daily_budget: number | null
  lifetime_budget: number | null
  adsets: AdSetStatus[]
}

interface AdSetStatus {
  id: string
  name: string
  campaign_id: string
  effective_status: string
  configured_status: string
  is_active: boolean
  status_label: string
  daily_budget: number | null
  lifetime_budget: number | null
  ads: AdStatus[]
}

interface AdStatus {
  id: string
  name: string
  adset_id: string
  campaign_id: string
  effective_status: string
  configured_status: string
  is_active: boolean
  status_label: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug')

    if (!clientSlug) {
      return NextResponse.json({ error: 'clientSlug 필수' }, { status: 400 })
    }

    // Supabase에서 Meta 인증 정보 조회
    const supabase = createServerClient()
    const { data: clientRow, error: clientError } = await supabase
      .from(TABLES.CLIENTS)
      .select('slug, meta_access_token, meta_ad_account_id')
      .eq('slug', clientSlug)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = clientRow as any
    const metaToken: string | null = client?.meta_access_token ?? null
    const metaAccountId: string | null = client?.meta_ad_account_id ?? null

    if (clientError || !metaToken || !metaAccountId) {
      return NextResponse.json({ error: '클라이언트 Meta 인증 정보 없음' }, { status: 404 })
    }

    const token = metaToken
    const accountId = metaAccountId
    const baseUrl = `https://graph.facebook.com/v21.0/act_${accountId}`

    // 캠페인, 광고세트, 광고를 병렬로 조회
    const [rawCampaigns, rawAdsets, rawAds] = await Promise.all([
      fetchAllPages<{
        id: string
        name: string
        effective_status: string
        configured_status: string
        daily_budget?: string
        lifetime_budget?: string
      }>(`${baseUrl}/campaigns?fields=id,name,effective_status,configured_status,daily_budget,lifetime_budget&limit=500&access_token=${token}`),

      fetchAllPages<{
        id: string
        name: string
        effective_status: string
        configured_status: string
        campaign_id: string
        daily_budget?: string
        lifetime_budget?: string
      }>(`${baseUrl}/adsets?fields=id,name,effective_status,configured_status,campaign_id,daily_budget,lifetime_budget&limit=500&access_token=${token}`),

      fetchAllPages<{
        id: string
        name: string
        effective_status: string
        configured_status: string
        adset_id: string
        campaign_id: string
      }>(`${baseUrl}/ads?fields=id,name,effective_status,configured_status,adset_id,campaign_id&limit=500&access_token=${token}`),
    ])

    // 계층 구조 조립
    // 1. 광고 → 광고세트 맵
    const adsByAdset = new Map<string, AdStatus[]>()
    for (const ad of rawAds) {
      const adStatus: AdStatus = {
        id: ad.id,
        name: ad.name,
        adset_id: ad.adset_id,
        campaign_id: ad.campaign_id,
        effective_status: ad.effective_status,
        configured_status: ad.configured_status,
        is_active: isActive(ad.effective_status),
        status_label: statusLabel(ad.effective_status),
      }
      const list = adsByAdset.get(ad.adset_id) || []
      list.push(adStatus)
      adsByAdset.set(ad.adset_id, list)
    }

    // 2. 광고세트 → 캠페인 맵
    const adsetsByCampaign = new Map<string, AdSetStatus[]>()
    for (const adset of rawAdsets) {
      const adsetStatus: AdSetStatus = {
        id: adset.id,
        name: adset.name,
        campaign_id: adset.campaign_id,
        effective_status: adset.effective_status,
        configured_status: adset.configured_status,
        is_active: isActive(adset.effective_status),
        status_label: statusLabel(adset.effective_status),
        daily_budget: adset.daily_budget ? parseInt(adset.daily_budget, 10) / 100 : null,
        lifetime_budget: adset.lifetime_budget ? parseInt(adset.lifetime_budget, 10) / 100 : null,
        ads: adsByAdset.get(adset.id) || [],
      }
      const list = adsetsByCampaign.get(adset.campaign_id) || []
      list.push(adsetStatus)
      adsetsByCampaign.set(adset.campaign_id, list)
    }

    // 3. 캠페인 조립
    const campaigns: CampaignStatus[] = rawCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      effective_status: c.effective_status,
      configured_status: c.configured_status,
      is_active: isActive(c.effective_status),
      status_label: statusLabel(c.effective_status),
      daily_budget: c.daily_budget ? parseInt(c.daily_budget, 10) / 100 : null,
      lifetime_budget: c.lifetime_budget ? parseInt(c.lifetime_budget, 10) / 100 : null,
      adsets: adsetsByCampaign.get(c.id) || [],
    }))

    // 통계
    const totalCampaigns = campaigns.length
    const activeCampaigns = campaigns.filter((c) => c.is_active).length
    const totalAdsets = rawAdsets.length
    const activeAdsets = rawAdsets.filter((a) => isActive(a.effective_status)).length
    const totalAds = rawAds.length
    const activeAds = rawAds.filter((a) => isActive(a.effective_status)).length

    return NextResponse.json({
      campaigns,
      summary: {
        total_campaigns: totalCampaigns,
        active_campaigns: activeCampaigns,
        total_adsets: totalAdsets,
        active_adsets: activeAdsets,
        total_ads: totalAds,
        active_ads: activeAds,
      },
    })
  } catch (error) {
    console.error('Ads status error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
