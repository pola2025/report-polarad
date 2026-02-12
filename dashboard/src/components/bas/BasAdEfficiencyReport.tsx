'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Lightbulb, Loader2, AlertTriangle, Zap, DollarSign } from 'lucide-react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import type { MetaAdData, MetaDailyData } from '@/types/meta-analytics'
import type { BasLead } from '@/types/bas-leads'
import type { AdRiskFactors, AdRiskScore } from '@/types/bas-analytics'
import {
  WPV_WEIGHTS,
  CFO_RISK_WEIGHTS,
  TARGET_CPL,
  KILL_SWITCH_SPEND_THRESHOLD,
} from '@/types/bas-analytics'

// --- Types ---

type SortKey = 'risk_desc' | 'risk_asc' | 'wpv_desc' | 'score_asc' | 'score_desc' | 'age_desc'
type Recommendation = 'off' | 'watch' | 'keep'

interface CampaignInfo {
  id: string
  name: string
  dailyBudget: number | null    // USD (campaign-level CBO budget)
  lifetimeBudget: number | null // USD
  adsetDailyBudgetSum: number   // sum of adset daily_budgets if no campaign budget
  activeAdCount: number
}

interface ScoredAd {
  ad: MetaAdData
  score: number        // legacy efficiency score (0-100, higher=better)
  ageDays: number
  leadsPerDay: number
  impressionsPerDay: number
  recommendation: Recommendation
  risk: AdRiskScore
}

// --- Helpers ---

function parseAdCreatedDate(ad: MetaAdData): Date {
  const m = ad.ad_name.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    if (!isNaN(d.getTime())) return d
  }
  return new Date(ad.first_date)
}

function daysSince(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
}

function percentileRank(value: number, all: number[]): number {
  if (all.length <= 1) return 50
  const sorted = [...all].sort((a, b) => a - b)
  const idx = sorted.findIndex((v) => v >= value)
  if (idx === -1) return 100
  return Math.round((idx / (sorted.length - 1)) * 100)
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

/** Extract date prefix (batch) from ad name: "20260115_A" → "20260115" */
function getAdBatch(ad: MetaAdData): string {
  const m = ad.ad_name.match(/^(\d{8})/)
  return m ? m[1] : ad.ad_name
}

// --- Factor Scoring ---

/** Factor 1: Burn Rate (25%) — 예산 낭비 위험도
 * 감점 기준:
 *  - 리드 0건 기본 위험 60 (Meta 알고리즘이 감점한 광고 포함)
 *  - 리드 0건 + 지출 많음 → +20 (예산 직접 낭비)
 *  - 리드 0건 + 노출 많음 → +20 (전환 실패: 사람들이 봤으나 반응 안 함)
 *  - 리드 있음 → CPL 기반 + 노출당 전환율 보정
 */
function scoreBurnRate(ad: MetaAdData, metaAllocationShare: number): number {
  if (ad.leads === 0) {
    // 리드 0건: 무조건 위험 신호
    let risk = 60 // 기본 위험도 (Meta가 배분을 줄인 광고도 최소 60)

    // 지출 많을수록 예산 낭비 심각 (0-15점 추가)
    risk += Math.min(ad.spend / KILL_SWITCH_SPEND_THRESHOLD, 1) * 15

    // 노출 많은데 리드 0 = 전환 실패 (0-15점 추가)
    risk += Math.min(ad.impressions / 5000, 1) * 15

    // Meta 배분 높은데 리드 0 = 큰 기회를 낭비 (0-10점 추가)
    risk += metaAllocationShare * 10

    return clamp(risk) // 60-100
  }
  // 리드 있음: CPL 기반 위험도
  const cplRatio = ad.cpl / TARGET_CPL
  const cplRisk = clamp((cplRatio - 1) * 50 + 50) // CPL = target → 50, 2x → 100

  // 노출 대비 전환율 보정: 노출 많은데 리드 적으면 추가 위험
  const impressionsPerLead = ad.impressions / ad.leads
  const conversionPenalty = Math.min(15, Math.max(0, (impressionsPerLead - 3000) / 400))

  return clamp(cplRisk + conversionPenalty)
}

/** Factor 2: CPL Trend (25%) — uses aggregated daily data for the ad's campaign */
function scoreCplTrend(
  ad: MetaAdData,
  dailyData: MetaDailyData[] | undefined,
): number {
  if (!dailyData || dailyData.length < 6) return 50 // neutral

  // Use last 6 days, split into two 3-day blocks
  const recent = dailyData.slice(-6)
  const block1 = recent.slice(0, 3)
  const block2 = recent.slice(3, 6)

  const spend1 = block1.reduce((s, d) => s + d.spend, 0)
  const leads1 = block1.reduce((s, d) => s + d.leads, 0)
  const spend2 = block2.reduce((s, d) => s + d.spend, 0)
  const leads2 = block2.reduce((s, d) => s + d.leads, 0)

  const cpl1 = leads1 > 0 ? spend1 / leads1 : 0
  const cpl2 = leads2 > 0 ? spend2 / leads2 : 0

  if (cpl1 === 0 && cpl2 === 0) return 50
  if (cpl1 === 0) return 30 // was zero, now has cost → slight risk
  if (cpl2 === 0) return 70 // was spending, now no leads → higher risk

  const changeRate = (cpl2 - cpl1) / cpl1
  // changeRate > 0 means CPL got worse
  return clamp(50 + changeRate * 100)
}

/** Factor 3: Pipeline Health / WPV (20%) — uses leads API data */
function scorePipeline(
  adWpv: number,
  adSpend: number,
  allWpvEfficiencies: number[],
): number {
  if (adSpend === 0) return 50
  const wpvEff = adWpv / adSpend
  // Higher WPV efficiency = lower risk
  const pctRank = percentileRank(wpvEff, allWpvEfficiencies)
  return clamp(100 - pctRank)
}

/** Factor 4: Lead Stability (15%) — CV of leads across 3-day blocks */
function scoreStability(
  ad: MetaAdData,
  dailyData: MetaDailyData[] | undefined,
): number {
  if (!dailyData || dailyData.length < 6) return 50

  // Split into 3-day blocks
  const blocks: number[] = []
  for (let i = 0; i <= dailyData.length - 3; i += 3) {
    blocks.push(dailyData.slice(i, i + 3).reduce((s, d) => s + d.leads, 0))
  }
  if (blocks.length < 2) return 50

  const mean = blocks.reduce((s, v) => s + v, 0) / blocks.length
  if (mean === 0) return 80 // consistently zero leads = risky
  const variance = blocks.reduce((s, v) => s + (v - mean) ** 2, 0) / blocks.length
  const cv = Math.sqrt(variance) / mean

  // CV 0 → very stable (risk=0), CV 1+ → unstable (risk=100)
  return clamp(cv * 100)
}

/** Factor 5: Ad Fatigue (15%) — CTR + 시청시간 vs 배치평균 + 나이 패널티
 * 좋은 광고 = 클릭 많고 시청시간 길다 → 낮은 피로도
 * 나쁜 광고 = CTR 저조, 시청시간 짧다 → 높은 피로도
 */
function scoreFatigue(
  ad: MetaAdData,
  ageDays: number,
  batchAvgCtr: number,
  batchAvgWatchTime: number,
): number {
  let fatigue = 0

  // CTR vs 배치 평균 (0-50)
  if (batchAvgCtr > 0) {
    const ctrRatio = ad.ctr / batchAvgCtr
    fatigue += clamp((1 - ctrRatio) * 50)
  }

  // 시청시간 vs 배치 평균 (0-30)
  const adWatchTime = ad.avg_watch_time || 0
  if (batchAvgWatchTime > 0) {
    if (adWatchTime > 0) {
      const watchRatio = adWatchTime / batchAvgWatchTime
      fatigue += clamp((1 - watchRatio) * 30)
    } else {
      fatigue += 15 // 다른 광고는 시청시간 있는데 이 광고만 없음
    }
  }

  // 나이 패널티: D+30에서 최대 20점
  const agePenalty = Math.min(20, (ageDays / 30) * 20)
  return clamp(fatigue + agePenalty)
}

// --- Classification ---

function classifyRisk(
  compositeRisk: number,
  killSwitch: boolean,
  ageDays: number,
  leads: number,
): Recommendation {
  if (killSwitch) return 'off'
  if (compositeRisk >= 70) return 'off'
  if (ageDays >= 14 && leads === 0) return 'off'
  if (compositeRisk >= 45) return 'watch'
  if (ageDays >= 7 && ageDays < 14 && leads === 0) return 'watch'
  return 'keep'
}

/** OFF/KILL/WATCH 이유를 실제 수치 기반으로 생성 */
function getWarningReason(item: ScoredAd): string | null {
  if (item.recommendation === 'keep') return null

  const parts: string[] = []
  const { factors } = item.risk
  const ad = item.ad

  // ── 핵심 지표 (리드/CPL) ──
  if (ad.leads === 0) {
    const imps = ad.impressions > 1000
      ? `${(ad.impressions / 1000).toFixed(1)}K`
      : `${ad.impressions}`
    parts.push(`${imps} 노출, $${ad.spend.toFixed(0)} 지출 → 전환 0건`)
  } else if (ad.cpl > TARGET_CPL) {
    parts.push(`CPL $${ad.cpl.toFixed(1)} (목표 $${TARGET_CPL}의 ${(ad.cpl / TARGET_CPL).toFixed(1)}배)`)
  }

  // ── 팩터별 수치 기반 이유 (60 이상만, 최대 2개) ──
  const factorParts: string[] = []

  if (factors.burnRate >= 60 && ad.leads > 0) {
    const iplead = Math.round(ad.impressions / ad.leads)
    factorParts.push(`노출 ${iplead.toLocaleString()}회당 1리드`)
  }

  if (factors.cplTrend >= 60) {
    factorParts.push('최근 CPL 상승 추세')
  }

  if (factors.pipeline >= 60) {
    if (item.risk.wpv === 0) {
      factorParts.push('파이프라인 진행 0건')
    } else {
      factorParts.push(`WPV ${item.risk.wpv} · 효율 ${item.risk.wpvEfficiency.toFixed(2)}/$ (하위)`)
    }
  }

  if (factors.stability >= 60) {
    factorParts.push('리드 유입량 불안정')
  }

  if (factors.fatigue >= 60) {
    const wt = ad.avg_watch_time
    if (wt && wt > 0) {
      factorParts.push(`시청 ${wt.toFixed(1)}s · CTR ${ad.ctr.toFixed(2)}% (배치 하회)`)
    } else {
      factorParts.push(`CTR ${ad.ctr.toFixed(2)}% (배치 평균 하회)`)
    }
  }

  // 최대 2개 팩터만
  parts.push(...factorParts.slice(0, 2))

  // ── Kill Switch 보충 ──
  if (item.risk.killSwitch && item.risk.metaAllocationShare > 0.3) {
    parts.push(`Meta 예산 ${(item.risk.metaAllocationShare * 100).toFixed(0)}% 배분`)
  }

  // ── 장기 미전환 ──
  if (item.ageDays >= 14 && ad.leads === 0 && !parts.some(p => p.includes('전환'))) {
    parts.push(`D+${item.ageDays}일 집행, 미전환`)
  }

  return parts.length > 0 ? parts.join(' · ') : null
}

// --- Config ---

const RECOMMENDATION_CONFIG: Record<Recommendation, { label: string; emoji: string; bg: string; text: string; border: string }> = {
  off:   { label: 'OFF 권고',  emoji: '🔴', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  watch: { label: '관찰',      emoji: '🟡', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  keep:  { label: '유지',      emoji: '🟢', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'risk_desc', label: '위험 높은순' },
  { key: 'risk_asc', label: '위험 낮은순' },
  { key: 'wpv_desc', label: 'WPV 높은순' },
  { key: 'score_asc', label: '효율 낮은순' },
  { key: 'score_desc', label: '효율 높은순' },
  { key: 'age_desc', label: '나이 많은순' },
]

const LEGACY_WEIGHTS = { cpl_inv: 0.30, ctr: 0.20, leads_day: 0.20, watch_time: 0.15, impressions_day: 0.15 }

const FACTOR_LABELS: Record<keyof AdRiskFactors, string> = {
  burnRate: '소진율',
  cplTrend: 'CPL추이',
  pipeline: '파이프라인',
  stability: '안정성',
  fatigue: '피로도',
}

const FACTOR_COLORS: Record<keyof AdRiskFactors, string> = {
  burnRate: '#ef4444',
  cplTrend: '#f59e0b',
  pipeline: '#3b82f6',
  stability: '#8b5cf6',
  fatigue: '#ec4899',
}

// --- SVG Components ---

function MiniFactorGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const size = 36
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500"
        />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
          className="font-bold" style={{ fontSize: '9px' }} fill={color}
        >
          {Math.round(value)}
        </text>
      </svg>
      <span className="text-[10px] text-gray-500 leading-none">{label}</span>
    </div>
  )
}

// --- Main component ---

interface BasAdEfficiencyReportProps {
  ads: MetaAdData[]
  clientSlug: string
  dailyData?: MetaDailyData[]
}

export function BasAdEfficiencyReport({ ads, clientSlug, dailyData }: BasAdEfficiencyReportProps) {
  const [sortKey, setSortKey] = useState<SortKey>('risk_desc')
  const [activeAdIds, setActiveAdIds] = useState<Set<string> | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState(false)
  const [leads, setLeads] = useState<BasLead[]>([])
  const [leadsLoaded, setLeadsLoaded] = useState(false)
  const [adToCampaignMap, setAdToCampaignMap] = useState<Map<string, string>>(new Map())
  const [campaignInfoMap, setCampaignInfoMap] = useState<Map<string, CampaignInfo>>(new Map())
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all')

  // Fetch ad effective_status from Meta API + campaign info
  useEffect(() => {
    let cancelled = false
    async function load() {
      setStatusLoading(true)
      setStatusError(false)
      try {
        const res = await fetch(`/api/meta/ads-status?clientSlug=${clientSlug}`)
        if (!res.ok) throw new Error('상태 조회 실패')
        const data = await res.json()
        const ids = new Set<string>()
        const adCampaign = new Map<string, string>()
        const campInfo = new Map<string, CampaignInfo>()

        for (const campaign of data.campaigns || []) {
          let adsetDailyBudgetSum = 0
          let activeAdCount = 0

          for (const adset of campaign.adsets || []) {
            if (adset.daily_budget) adsetDailyBudgetSum += adset.daily_budget
            for (const ad of adset.ads || []) {
              if (ad.is_active) {
                ids.add(ad.id)
                activeAdCount++
              }
              adCampaign.set(ad.id, campaign.id)
            }
          }

          campInfo.set(campaign.id, {
            id: campaign.id,
            name: campaign.name,
            dailyBudget: campaign.daily_budget,
            lifetimeBudget: campaign.lifetime_budget,
            adsetDailyBudgetSum,
            activeAdCount,
          })
        }

        if (!cancelled) {
          setActiveAdIds(ids)
          setAdToCampaignMap(adCampaign)
          setCampaignInfoMap(campInfo)
        }
      } catch {
        if (!cancelled) {
          setActiveAdIds(new Set())
          setStatusError(true)
        }
      } finally {
        if (!cancelled) setStatusLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [clientSlug])

  // Fetch leads for WPV calculation
  useEffect(() => {
    let cancelled = false
    async function loadLeads() {
      try {
        const res = await fetch(`/api/bas/leads?clientSlug=${clientSlug}&limit=500`)
        if (!res.ok) throw new Error('리드 조회 실패')
        const data = await res.json()
        if (!cancelled) {
          setLeads(data.leads || [])
          setLeadsLoaded(true)
        }
      } catch {
        if (!cancelled) {
          setLeads([])
          setLeadsLoaded(true)
        }
      }
    }
    loadLeads()
    return () => { cancelled = true }
  }, [clientSlug])

  // Filter: only active ads (OFF 광고 제외)
  const activeAds = useMemo(() => {
    if (activeAdIds === null || activeAdIds.size === 0) return []
    return ads.filter((ad) => activeAdIds.has(ad.ad_id))
  }, [ads, activeAdIds])

  // Campaign filter
  const filteredAds = useMemo(() => {
    if (selectedCampaignId === 'all') return activeAds
    return activeAds.filter((ad) => adToCampaignMap.get(ad.ad_id) === selectedCampaignId)
  }, [activeAds, selectedCampaignId, adToCampaignMap])

  // List of campaigns that have active ads (for dropdown)
  const activeCampaigns = useMemo(() => {
    const campIds = new Set<string>()
    for (const ad of activeAds) {
      const cid = adToCampaignMap.get(ad.ad_id)
      if (cid) campIds.add(cid)
    }
    return Array.from(campIds)
      .map((id) => campaignInfoMap.get(id))
      .filter((c): c is CampaignInfo => !!c)
  }, [activeAds, adToCampaignMap, campaignInfoMap])

  const excludedCount = ads.length - activeAds.length

  // Budget info for selected campaign(s)
  const budgetInfo = useMemo(() => {
    if (selectedCampaignId !== 'all') {
      const camp = campaignInfoMap.get(selectedCampaignId)
      if (!camp) return { dailyBudget: null, lifetimeBudget: null }
      // CBO: campaign-level daily_budget, otherwise sum of adset budgets
      const daily = camp.dailyBudget ?? (camp.adsetDailyBudgetSum > 0 ? camp.adsetDailyBudgetSum : null)
      return { dailyBudget: daily, lifetimeBudget: camp.lifetimeBudget }
    }
    // "all": sum all campaigns' effective daily budgets
    let totalDaily = 0
    let hasAny = false
    let totalLifetime: number | null = null
    for (const camp of activeCampaigns) {
      const daily = camp.dailyBudget ?? (camp.adsetDailyBudgetSum > 0 ? camp.adsetDailyBudgetSum : null)
      if (daily !== null) { totalDaily += daily; hasAny = true }
      if (camp.lifetimeBudget !== null) {
        totalLifetime = (totalLifetime ?? 0) + camp.lifetimeBudget
      }
    }
    return { dailyBudget: hasAny ? totalDaily : null, lifetimeBudget: totalLifetime }
  }, [selectedCampaignId, campaignInfoMap, activeCampaigns])

  // Average days_count across filtered ads
  const avgDaysCount = useMemo(() => {
    if (filteredAds.length === 0) return 0
    return Math.round(filteredAds.reduce((s, a) => s + a.days_count, 0) / filteredAds.length)
  }, [filteredAds])

  // Build WPV map: ad_name → total WPV
  const wpvMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!leadsLoaded) return map
    for (const lead of leads) {
      const adName = lead.ad_name
      if (!adName) continue
      const weight = WPV_WEIGHTS[lead.status] || 1
      map.set(adName, (map.get(adName) || 0) + weight)
    }
    return map
  }, [leads, leadsLoaded])

  // Build batch CTR averages
  const batchAvgCtrs = useMemo(() => {
    const batchCtrs = new Map<string, number[]>()
    for (const ad of filteredAds) {
      const batch = getAdBatch(ad)
      if (!batchCtrs.has(batch)) batchCtrs.set(batch, [])
      batchCtrs.get(batch)!.push(ad.ctr)
    }
    const avgs = new Map<string, number>()
    batchCtrs.forEach((ctrs, batch) => {
      avgs.set(batch, ctrs.reduce((s: number, v: number) => s + v, 0) / ctrs.length)
    })
    return avgs
  }, [filteredAds])

  // Build batch avg watch times
  const batchAvgWatchTimes = useMemo(() => {
    const batchTimes = new Map<string, number[]>()
    for (const ad of filteredAds) {
      const wt = ad.avg_watch_time || 0
      if (wt > 0) {
        const batch = getAdBatch(ad)
        if (!batchTimes.has(batch)) batchTimes.set(batch, [])
        batchTimes.get(batch)!.push(wt)
      }
    }
    const avgs = new Map<string, number>()
    batchTimes.forEach((times, batch) => {
      avgs.set(batch, times.reduce((s: number, v: number) => s + v, 0) / times.length)
    })
    return avgs
  }, [filteredAds])

  // Total spend for allocation share
  const totalSpend = useMemo(() => filteredAds.reduce((s, a) => s + a.spend, 0), [filteredAds])

  // Scored ads with full risk analysis
  const scored = useMemo<ScoredAd[]>(() => {
    if (filteredAds.length === 0) return []

    // Precompute enriched values
    const enriched = filteredAds.map((ad) => {
      const created = parseAdCreatedDate(ad)
      const ageDays = daysSince(created)
      const activeDays = Math.max(ad.days_count, 1)
      const metaAllocationShare = totalSpend > 0 ? ad.spend / totalSpend : 0
      const wpv = wpvMap.get(ad.ad_name) || 0
      return {
        ad,
        ageDays,
        leadsPerDay: ad.leads / activeDays,
        impressionsPerDay: ad.impressions / activeDays,
        metaAllocationShare,
        wpv,
        wpvEfficiency: ad.spend > 0 ? wpv / ad.spend : 0,
      }
    })

    // Collect arrays for percentile calculations
    const allCtrs = enriched.map((e) => e.ad.ctr)
    const allCpls = enriched.filter((e) => e.ad.leads > 0).map((e) => e.ad.cpl)
    const allLeadsPerDay = enriched.map((e) => e.leadsPerDay)
    const allWatchTimes = enriched.filter((e) => (e.ad.avg_watch_time || 0) > 0).map((e) => e.ad.avg_watch_time || 0)
    const allImpsPerDay = enriched.map((e) => e.impressionsPerDay)
    const allWpvEfficiencies = enriched.map((e) => e.wpvEfficiency)

    return enriched.map((e) => {
      // Legacy efficiency score
      const ctrP = percentileRank(e.ad.ctr, allCtrs)
      const cplInvP = e.ad.leads > 0 && allCpls.length > 0
        ? 100 - percentileRank(e.ad.cpl, allCpls)
        : 0
      const leadsP = percentileRank(e.leadsPerDay, allLeadsPerDay)
      const watchP = (e.ad.avg_watch_time || 0) > 0 && allWatchTimes.length > 0
        ? percentileRank(e.ad.avg_watch_time || 0, allWatchTimes)
        : 0
      const impsP = percentileRank(e.impressionsPerDay, allImpsPerDay)

      const score = Math.round(
        cplInvP * LEGACY_WEIGHTS.cpl_inv +
        ctrP * LEGACY_WEIGHTS.ctr +
        leadsP * LEGACY_WEIGHTS.leads_day +
        watchP * LEGACY_WEIGHTS.watch_time +
        impsP * LEGACY_WEIGHTS.impressions_day
      )

      // 5-Factor Risk Scoring
      const adBatch = getAdBatch(e.ad)
      const batchAvgCtr = batchAvgCtrs.get(adBatch) || e.ad.ctr
      const batchAvgWatch = batchAvgWatchTimes.get(adBatch) || 0
      const factors: AdRiskFactors = {
        burnRate: scoreBurnRate(e.ad, e.metaAllocationShare),
        cplTrend: scoreCplTrend(e.ad, dailyData),
        pipeline: leadsLoaded
          ? scorePipeline(e.wpv, e.ad.spend, allWpvEfficiencies)
          : 50,
        stability: scoreStability(e.ad, dailyData),
        fatigue: scoreFatigue(e.ad, e.ageDays, batchAvgCtr, batchAvgWatch),
      }

      const baseRisk = Math.round(
        factors.burnRate * CFO_RISK_WEIGHTS.burnRate +
        factors.cplTrend * CFO_RISK_WEIGHTS.cplTrend +
        factors.pipeline * CFO_RISK_WEIGHTS.pipeline +
        factors.stability * CFO_RISK_WEIGHTS.stability +
        factors.fatigue * CFO_RISK_WEIGHTS.fatigue
      )

      // Kill Switch
      let killSwitch = false
      let killSwitchReason: string | undefined

      // Rule 1: spend >= $30 AND leads = 0
      if (e.ad.spend >= KILL_SWITCH_SPEND_THRESHOLD && e.ad.leads === 0) {
        killSwitch = true
        killSwitchReason = `$${e.ad.spend.toFixed(0)} 지출, 리드 0건`
      }
      // Rule 2: allocation > 30% AND leads = 0 AND spend > $15
      if (!killSwitch && e.metaAllocationShare > 0.3 && e.ad.leads === 0 && e.ad.spend > 15) {
        killSwitch = true
        killSwitchReason = `Meta 배분 ${(e.metaAllocationShare * 100).toFixed(0)}%, 리드 0건`
      }

      // Kill Switch = 최고 위험 → compositeRisk 최소 80 보장
      const compositeRisk = killSwitch ? Math.max(baseRisk, 80) : baseRisk

      const risk: AdRiskScore = {
        factors,
        compositeRisk,
        killSwitch,
        killSwitchReason,
        metaAllocationShare: e.metaAllocationShare,
        wpv: e.wpv,
        wpvEfficiency: e.wpvEfficiency,
      }

      return {
        ...e,
        score,
        risk,
        recommendation: classifyRisk(compositeRisk, killSwitch, e.ageDays, e.ad.leads),
      }
    })
  }, [filteredAds, totalSpend, wpvMap, batchAvgCtrs, batchAvgWatchTimes, dailyData, leadsLoaded])

  // Sorted
  const sorted = useMemo(() => {
    const arr = [...scored]
    switch (sortKey) {
      case 'risk_desc': return arr.sort((a, b) => b.risk.compositeRisk - a.risk.compositeRisk)
      case 'risk_asc': return arr.sort((a, b) => a.risk.compositeRisk - b.risk.compositeRisk)
      case 'wpv_desc': return arr.sort((a, b) => b.risk.wpv - a.risk.wpv)
      case 'score_asc': return arr.sort((a, b) => a.score - b.score)
      case 'score_desc': return arr.sort((a, b) => b.score - a.score)
      case 'age_desc': return arr.sort((a, b) => b.ageDays - a.ageDays)
    }
  }, [scored, sortKey])

  // Aggregated stats
  const counts = useMemo(() => {
    const c = { off: 0, watch: 0, keep: 0 }
    scored.forEach((s) => c[s.recommendation]++)
    return c
  }, [scored])

  const avgRisk = scored.length > 0
    ? Math.round(scored.reduce((s, e) => s + e.risk.compositeRisk, 0) / scored.length)
    : 0

  const killSwitchAds = useMemo(() => scored.filter((s) => s.risk.killSwitch), [scored])

  const dailyWaste = useMemo(
    () => killSwitchAds.reduce((s, e) => s + e.ad.spend / Math.max(e.ad.days_count, 1), 0),
    [killSwitchAds],
  )

  const totalWpv = useMemo(() => scored.reduce((s, e) => s + e.risk.wpv, 0), [scored])

  // Avg factors across all ads
  const avgFactors = useMemo<AdRiskFactors>(() => {
    if (scored.length === 0) return { burnRate: 0, cplTrend: 0, pipeline: 0, stability: 0, fatigue: 0 }
    const sum = scored.reduce(
      (acc, s) => ({
        burnRate: acc.burnRate + s.risk.factors.burnRate,
        cplTrend: acc.cplTrend + s.risk.factors.cplTrend,
        pipeline: acc.pipeline + s.risk.factors.pipeline,
        stability: acc.stability + s.risk.factors.stability,
        fatigue: acc.fatigue + s.risk.factors.fatigue,
      }),
      { burnRate: 0, cplTrend: 0, pipeline: 0, stability: 0, fatigue: 0 },
    )
    const n = scored.length
    return {
      burnRate: Math.round(sum.burnRate / n),
      cplTrend: Math.round(sum.cplTrend / n),
      pipeline: Math.round(sum.pipeline / n),
      stability: Math.round(sum.stability / n),
      fatigue: Math.round(sum.fatigue / n),
    }
  }, [scored])

  // Spend by recommendation for stack bar
  const spendByRec = useMemo(() => {
    const map = { off: 0, watch: 0, keep: 0 }
    scored.forEach((s) => { map[s.recommendation] += s.ad.spend })
    return map
  }, [scored])

  // Scatter plot data: spend vs leads
  const scatterData = useMemo(() =>
    scored.map((s) => ({
      name: s.ad.ad_name.length > 20 ? s.ad.ad_name.slice(0, 20) + '…' : s.ad.ad_name,
      fullName: s.ad.ad_name,
      spend: Math.round(s.ad.spend),
      leads: s.ad.leads,
      impressions: s.ad.impressions,
      cpl: s.ad.leads > 0 ? s.ad.cpl : 0,
      recommendation: s.recommendation,
      killSwitch: s.risk.killSwitch,
      // bubble size: 노출수 비례 (min 40, max 400)
      size: Math.max(40, Math.min(400, s.ad.impressions / 20)),
    })),
  [scored])

  // Median spend for reference line
  const medianSpend = useMemo(() => {
    if (scored.length === 0) return 0
    const spends = scored.map((s) => s.ad.spend).sort((a, b) => a - b)
    const mid = Math.floor(spends.length / 2)
    return spends.length % 2 ? spends[mid] : (spends[mid - 1] + spends[mid]) / 2
  }, [scored])

  // Auto-insight
  const insight = useMemo(() => {
    if (scored.length === 0) return null
    const lines: string[] = []

    // Kill Switch
    if (killSwitchAds.length > 0) {
      lines.push(`Kill Switch 대상 ${killSwitchAds.length}개 — 일 약 $${dailyWaste.toFixed(1)} 손실 추정`)
    }

    // CPL trend
    const risingCpl = scored.filter((s) => s.risk.factors.cplTrend >= 65)
    const improvingCpl = scored.filter((s) => s.risk.factors.cplTrend <= 35)
    if (risingCpl.length > 0) {
      lines.push(`CPL 악화 추이 ${risingCpl.length}개 광고 — 예산 재배분 검토 필요`)
    }
    if (improvingCpl.length > 0) {
      lines.push(`CPL 개선 추이 ${improvingCpl.length}개 광고 — 예산 증액 고려`)
    }

    // Best WPV
    const bestWpv = [...scored].sort((a, b) => b.risk.wpvEfficiency - a.risk.wpvEfficiency)[0]
    if (bestWpv && bestWpv.risk.wpv > 0) {
      lines.push(`최고 WPV 효율: "${bestWpv.ad.ad_name.slice(0, 25)}${bestWpv.ad.ad_name.length > 25 ? '…' : ''}" (WPV ${bestWpv.risk.wpv}, 효율 ${bestWpv.risk.wpvEfficiency.toFixed(2)}/USD)`)
    }

    // Stability warning
    const unstable = scored.filter((s) => s.risk.factors.stability >= 70)
    if (unstable.length > 0) {
      lines.push(`리드 변동성 높은 광고 ${unstable.length}개 — 성과 불안정`)
    }

    // Old no-lead
    const oldNoLead = scored.filter((s) => s.ageDays >= 14 && s.ad.leads === 0)
    if (oldNoLead.length > 0) {
      lines.push(`D+14 이상 무리드 광고 ${oldNoLead.length}개 — 즉시 검토 권장`)
    }

    return lines
  }, [scored, killSwitchAds, dailyWaste])

  // Detailed creative analysis report
  const detailedReport = useMemo(() => {
    if (scored.length === 0) return null

    const totalLeads = scored.reduce((s, e) => s + e.ad.leads, 0)
    const totalImpressions = scored.reduce((s, e) => s + e.ad.impressions, 0)
    const totalClicks = scored.reduce((s, e) => s + e.ad.clicks, 0)
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0
    const watchTimeAds = scored.filter((s) => (s.ad.avg_watch_time || 0) > 0)
    const avgWatch = watchTimeAds.length > 0
      ? watchTimeAds.reduce((s, e) => s + (e.ad.avg_watch_time || 0), 0) / watchTimeAds.length
      : 0
    const bestWatch = watchTimeAds.length > 0
      ? [...watchTimeAds].sort((a, b) => (b.ad.avg_watch_time || 0) - (a.ad.avg_watch_time || 0))[0]
      : null
    const bestCpl = scored.filter((s) => s.ad.leads > 0).sort((a, b) => a.ad.cpl - b.ad.cpl)[0] || null
    const bestCtr = [...scored].sort((a, b) => b.ad.ctr - a.ad.ctr)[0]
    const worstCpl = scored.filter((s) => s.ad.leads > 0).sort((a, b) => b.ad.cpl - a.ad.cpl)[0] || null

    // Kill switch deep analysis
    const killAnalysis = killSwitchAds.map((ks) => {
      const watchRank = watchTimeAds.length > 0
        ? [...watchTimeAds].sort((a, b) => (b.ad.avg_watch_time || 0) - (a.ad.avg_watch_time || 0)).findIndex((w) => w.ad.ad_id === ks.ad.ad_id) + 1
        : null
      const ctrRank = [...scored].sort((a, b) => b.ad.ctr - a.ad.ctr).findIndex((s) => s.ad.ad_id === ks.ad.ad_id) + 1
      return { ...ks, watchRank, ctrRank }
    })

    // Recommendation distribution
    const keepAds = scored.filter((s) => s.recommendation === 'keep')
    const watchAds = scored.filter((s) => s.recommendation === 'watch')
    const offAds = scored.filter((s) => s.recommendation === 'off')

    return {
      totalLeads, totalImpressions, totalClicks, avgCtr, avgCpl, avgWatch,
      bestWatch, bestCpl, bestCtr, worstCpl, killAnalysis,
      keepAds, watchAds, offAds,
    }
  }, [scored, totalSpend, killSwitchAds])

  // Loading: 광고 상태 + 리드 데이터 모두 완료될 때까지 대기
  if (statusLoading || !leadsLoaded) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        <p className="text-gray-400 text-sm">
          {statusLoading ? '광고 상태 조회 중...' : '리드 데이터 분석 중...'}
        </p>
      </div>
    )
  }

  // Empty
  if (activeAds.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        {statusError ? (
          <>
            <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-2" />
            <p className="text-gray-600 text-sm font-medium">광고 상태를 조회할 수 없습니다</p>
            <p className="text-gray-400 text-xs mt-1">Meta API 연결을 확인해 주세요.</p>
          </>
        ) : (
          <p className="text-gray-400 text-sm">
            {ads.length > 0
              ? `활성 광고가 없습니다. (OFF 상태 ${ads.length}개 제외됨)`
              : '광고 데이터가 없습니다.'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── 소진예산 + 산점도 패널 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: 소진예산 스택바 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-800">소진예산 배분</span>
              </div>
              {activeCampaigns.length >= 1 && (
                <div className="relative">
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="text-[11px] border border-gray-300 rounded-lg px-2 py-1 bg-white pr-6 appearance-none cursor-pointer max-w-[180px] truncate"
                  >
                    <option value="all">전체 캠페인</option>
                    {activeCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>

            {/* 3-column metrics: 총 지출 / 광고일수 / 일 예산 */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <div className="text-2xl font-bold text-gray-900">${totalSpend.toFixed(0)}</div>
                <div className="text-[10px] text-gray-400">총 지출</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 flex items-baseline gap-1">
                  {avgDaysCount}<span className="text-sm font-medium text-gray-400">일</span>
                </div>
                <div className="text-[10px] text-gray-400">광고일수</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {budgetInfo.dailyBudget !== null
                    ? `$${budgetInfo.dailyBudget.toFixed(0)}`
                    : budgetInfo.lifetimeBudget !== null
                      ? `$${budgetInfo.lifetimeBudget.toFixed(0)}`
                      : '미설정'}
                </div>
                <div className="text-[10px] text-gray-400">
                  {budgetInfo.dailyBudget !== null
                    ? '일 예산'
                    : budgetInfo.lifetimeBudget !== null
                      ? '전체 예산'
                      : '일 예산'}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-gray-400 mb-3">활성 광고 {filteredAds.length}개{selectedCampaignId !== 'all' ? '' : ` · 캠페인 ${activeCampaigns.length}개`}</div>

            {/* Stack bar */}
            {totalSpend > 0 && (
              <>
                <div className="flex h-5 rounded-full overflow-hidden mb-2">
                  {spendByRec.off > 0 && (
                    <div
                      className="bg-red-400 h-full transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${(spendByRec.off / totalSpend) * 100}%` }}
                    >
                      {spendByRec.off / totalSpend > 0.1 && (
                        <span className="text-[9px] text-white font-bold">${spendByRec.off.toFixed(0)}</span>
                      )}
                    </div>
                  )}
                  {spendByRec.watch > 0 && (
                    <div
                      className="bg-amber-300 h-full transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${(spendByRec.watch / totalSpend) * 100}%` }}
                    >
                      {spendByRec.watch / totalSpend > 0.1 && (
                        <span className="text-[9px] text-amber-800 font-bold">${spendByRec.watch.toFixed(0)}</span>
                      )}
                    </div>
                  )}
                  {spendByRec.keep > 0 && (
                    <div
                      className="bg-emerald-400 h-full transition-all duration-500 flex items-center justify-center"
                      style={{ width: `${(spendByRec.keep / totalSpend) * 100}%` }}
                    >
                      {spendByRec.keep / totalSpend > 0.1 && (
                        <span className="text-[9px] text-white font-bold">${spendByRec.keep.toFixed(0)}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    OFF {(spendByRec.off / totalSpend * 100).toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-300" />
                    관찰 {(spendByRec.watch / totalSpend * 100).toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    유지 {(spendByRec.keep / totalSpend * 100).toFixed(0)}%
                  </span>
                </div>
              </>
            )}

            {/* Top spenders */}
            <div className="mt-3 space-y-2">
              {[...scored].sort((a, b) => b.ad.spend - a.ad.spend).slice(0, 5).map((s) => {
                const pct = totalSpend > 0 ? (s.ad.spend / totalSpend) * 100 : 0
                const barColor = s.recommendation === 'off' ? 'bg-red-400' : s.recommendation === 'watch' ? 'bg-amber-300' : 'bg-emerald-400'
                return (
                  <div key={s.ad.ad_id} className="text-[11px]">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-gray-600 font-medium break-all leading-tight">{s.ad.ad_name}</span>
                      <span className="flex-shrink-0 flex items-center gap-1.5">
                        <span className="text-gray-700 font-semibold">${s.ad.spend.toFixed(0)}</span>
                        <span className="text-gray-400">{s.ad.leads}건</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: 지출 vs 성과 산점도 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-800">지출 vs 리드</span>
              <div className="flex gap-2 text-[9px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />OFF/KILL</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />관찰</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />유지</span>
              </div>
            </div>
            <div className="h-[220px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <XAxis
                    dataKey="spend" type="number" name="지출"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickFormatter={(v: number) => `$${v}`}
                    label={{ value: '지출($)', position: 'bottom', offset: 0, style: { fontSize: 10, fill: '#9ca3af' } }}
                  />
                  <YAxis
                    dataKey="leads" type="number" name="리드"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    label={{ value: '리드', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#9ca3af' } }}
                  />
                  <ReferenceLine x={medianSpend} stroke="#e5e7eb" strokeDasharray="3 3" />
                  <ReferenceLine y={1} stroke="#e5e7eb" strokeDasharray="3 3" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs max-w-[200px]">
                          <div className="font-semibold text-gray-900 truncate">{d.fullName}</div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-gray-600">
                            <span>지출</span><span className="font-medium text-right">${d.spend}</span>
                            <span>리드</span><span className="font-medium text-right">{d.leads}건</span>
                            <span>CPL</span><span className="font-medium text-right">{d.leads > 0 ? `$${d.cpl.toFixed(1)}` : '-'}</span>
                            <span>노출</span><span className="font-medium text-right">{d.impressions.toLocaleString()}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Scatter data={scatterData}>
                    {scatterData.map((d, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          d.killSwitch ? '#dc2626'
                          : d.recommendation === 'off' ? '#ef4444'
                          : d.recommendation === 'watch' ? '#f59e0b'
                          : '#10b981'
                        }
                        fillOpacity={d.killSwitch ? 0.9 : 0.7}
                        stroke={d.killSwitch ? '#991b1b' : 'none'}
                        strokeWidth={d.killSwitch ? 2 : 0}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            {/* Quadrant labels */}
            <div className="grid grid-cols-2 gap-1 mt-1 text-[9px]">
              <div className="text-center text-gray-400">저지출 + 고성과 ⭐</div>
              <div className="text-center text-gray-400">고지출 + 고성과 ✅</div>
              <div className="text-center text-gray-400">저지출 + 무성과 🔇</div>
              <div className="text-center text-red-400 font-medium">고지출 + 무성과 🚨</div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Summary Panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {/* Factor gauges row */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-3 pb-3 border-b border-gray-100">
          <div className="text-xs text-gray-500 font-medium">리스크 팩터</div>
          {(Object.keys(FACTOR_LABELS) as (keyof AdRiskFactors)[]).map((key) => (
            <MiniFactorGauge
              key={key}
              label={FACTOR_LABELS[key]}
              value={avgFactors[key]}
              color={FACTOR_COLORS[key]}
            />
          ))}
        </div>

        {/* Summary metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Kill Switch count */}
          <div className={`rounded-lg p-2.5 text-center ${killSwitchAds.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <div className={`text-lg font-bold ${killSwitchAds.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {killSwitchAds.length}
            </div>
            <div className="text-[10px] text-gray-500">Kill Switch</div>
          </div>

          {/* Daily waste */}
          <div className={`rounded-lg p-2.5 text-center ${dailyWaste > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <div className={`text-lg font-bold ${dailyWaste > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              ${dailyWaste.toFixed(1)}
            </div>
            <div className="text-[10px] text-gray-500">일 낭비 추정</div>
          </div>

          {/* Avg risk */}
          <div className="rounded-lg p-2.5 text-center bg-gray-50">
            <div className={`text-lg font-bold ${avgRisk >= 60 ? 'text-red-600' : avgRisk >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {avgRisk}
            </div>
            <div className="text-[10px] text-gray-500">평균 리스크</div>
          </div>

          {/* Total WPV */}
          <div className="rounded-lg p-2.5 text-center bg-blue-50">
            <div className="text-lg font-bold text-blue-600">{totalWpv}</div>
            <div className="text-[10px] text-gray-500">총 WPV</div>
          </div>
        </div>
      </div>

      {/* Summary header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm text-gray-500">
            활성 <span className="font-semibold text-gray-900">{filteredAds.length}</span>개 광고
            {excludedCount > 0 && (
              <span className="text-gray-400 ml-1">(OFF {excludedCount}개 제외)</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            {(['off', 'watch', 'keep'] as Recommendation[]).map((r) => {
              const cfg = RECOMMENDATION_CONFIG[r]
              return (
                <span key={r} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} ${cfg.border} border`}>
                  {cfg.emoji} {cfg.label} {counts[r]}
                </span>
              )
            })}
          </div>
          {/* Sort */}
          <div className="ml-auto relative">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white pr-7 appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Card list */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {sorted.map((item, i) => {
            const cfg = RECOMMENDATION_CONFIG[item.recommendation]
            const riskColor = item.risk.compositeRisk >= 70 ? '#ef4444'
              : item.risk.compositeRisk >= 45 ? '#f59e0b'
              : '#10b981'
            const warningReason = getWarningReason(item)

            return (
              <motion.div
                key={item.ad.ad_id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                className={`rounded-xl border px-4 pt-3 pb-4 ${
                  item.risk.killSwitch
                    ? 'bg-red-50/60 border-red-300 border-2 ring-1 ring-red-200'
                    : item.recommendation === 'off'
                      ? 'bg-red-50/30 border-red-200'
                      : `bg-white ${cfg.border}`
                }`}
              >
                  {/* Risk bar on top */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.risk.compositeRisk}%`, backgroundColor: riskColor }}
                    />
                  </div>
                  <span className="text-[11px] font-bold tabular-nums flex-shrink-0" style={{ color: riskColor }}>
                    {item.risk.compositeRisk}
                  </span>
                </div>

                {/* Name + badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-gray-900 truncate max-w-[200px]" title={item.ad.ad_name}>
                    {item.ad.ad_name}
                  </h4>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                    D+{item.ageDays}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  {item.risk.killSwitch && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 bg-red-600 text-white animate-pulse flex items-center gap-0.5">
                      <Zap className="h-2.5 w-2.5" />
                      KILL
                    </span>
                  )}
                  {item.risk.wpv > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 bg-blue-100 text-blue-700">
                      WPV {item.risk.wpv}
                    </span>
                  )}
                </div>

                {item.ad.campaign_name && (
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.ad.campaign_name}</p>
                )}

                {/* Warning reason banner */}
                {warningReason && (
                  <div className={`mt-1.5 px-2.5 py-1.5 rounded-lg text-[11px] leading-snug ${
                    item.risk.killSwitch
                      ? 'bg-white text-red-800 border border-red-300 shadow-sm'
                      : item.recommendation === 'off'
                        ? 'bg-red-50/70 text-red-600 border border-red-100'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}>
                    <span className="font-bold">
                      {item.risk.killSwitch ? '⚡ ' : item.recommendation === 'off' ? '⛔ ' : '⚠️ '}
                    </span>
                    <span className={item.risk.killSwitch ? 'font-semibold' : ''}>
                      {warningReason}
                    </span>
                  </div>
                )}

                {/* Meta allocation */}
                <div className="text-[10px] text-gray-400 mt-1.5 mb-1">
                  Meta 배분 {(item.risk.metaAllocationShare * 100).toFixed(1)}%
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-4 gap-x-2 gap-y-1 text-[11px]">
                  <div>
                    <span className="text-gray-400">CPL</span>{' '}
                    <span className="font-medium text-gray-700">
                      {item.ad.leads > 0 ? `$${item.ad.cpl.toFixed(1)}` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">CTR</span>{' '}
                    <span className="font-medium text-gray-700">{item.ad.ctr.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">리드</span>{' '}
                    <span className="font-medium text-gray-700">{item.ad.leads}건</span>
                  </div>
                  <div>
                    <span className="text-gray-400">지출</span>{' '}
                    <span className="font-medium text-gray-700">${item.ad.spend.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">노출</span>{' '}
                    <span className="font-medium text-gray-700">{item.ad.impressions.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">클릭</span>{' '}
                    <span className="font-medium text-gray-700">{item.ad.clicks.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">리드/일</span>{' '}
                    <span className="font-medium text-gray-700">{item.leadsPerDay.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">시청</span>{' '}
                    <span className="font-medium text-gray-700">
                      {item.ad.avg_watch_time ? `${item.ad.avg_watch_time.toFixed(1)}s` : '-'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Auto-Insight */}
      {insight && insight.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-xl border border-violet-200 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-semibold text-violet-900">CFO Auto-Insight</span>
          </div>
          <ul className="space-y-1">
            {insight.map((line, i) => {
              const isWarning = line.includes('Kill Switch') || line.includes('즉시 검토')
              return (
                <li key={i} className="text-xs text-violet-700 flex items-start gap-1.5">
                  {isWarning ? (
                    <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <span className="text-violet-400 mt-0.5">•</span>
                  )}
                  {line}
                </li>
              )
            })}
          </ul>

          {/* Detailed Report */}
          {detailedReport && (
            <div className="mt-3 pt-3 border-t border-violet-200/60 space-y-3">
              <p className="text-xs font-semibold text-violet-800">광고 소재 종합 분석</p>

              {/* Overview stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: '평균 CPL', value: detailedReport.avgCpl > 0 ? `$${detailedReport.avgCpl.toFixed(1)}` : '-' },
                  { label: '평균 CTR', value: `${detailedReport.avgCtr.toFixed(2)}%` },
                  { label: '평균 시청', value: detailedReport.avgWatch > 0 ? `${detailedReport.avgWatch.toFixed(1)}s` : '-' },
                  { label: '총 리드', value: `${detailedReport.totalLeads}건` },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/60 rounded-lg px-2 py-1.5 text-center">
                    <div className="text-[10px] text-violet-500">{stat.label}</div>
                    <div className="text-xs font-bold text-violet-900">{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Kill Switch deep analysis */}
              {detailedReport.killAnalysis.length > 0 && (
                <div className="bg-red-50/80 rounded-lg p-2.5 border border-red-200/60">
                  <p className="text-[11px] font-bold text-red-800 mb-1.5">Kill Switch 대상 심층 분석</p>
                  {detailedReport.killAnalysis.map((ks) => (
                    <div key={ks.ad.ad_id} className="mb-2 last:mb-0">
                      <p className="text-[11px] font-semibold text-red-900 truncate" title={ks.ad.ad_name}>
                        {ks.ad.ad_name}
                      </p>
                      <div className="text-[10px] text-red-700 space-y-0.5 mt-0.5">
                        <p>지출 ${ks.ad.spend.toFixed(1)} / 노출 {ks.ad.impressions.toLocaleString()} / 클릭 {ks.ad.clicks} / 리드 {ks.ad.leads}건</p>
                        {(ks.ad.avg_watch_time || 0) > 0 && (
                          <p>
                            평균 시청 <span className="font-bold">{ks.ad.avg_watch_time?.toFixed(1)}s</span>
                            {ks.watchRank && ks.watchRank <= 3 && (
                              <span className="ml-1 text-amber-700 font-semibold">
                                (전체 {ks.watchRank}위 — 관심도는 높으나 전환 실패)
                              </span>
                            )}
                          </p>
                        )}
                        <p>CTR {ks.ad.ctr.toFixed(2)}% (전체 {ks.ctrRank}위) / D+{ks.ageDays}</p>
                        <p className="text-red-600 font-medium mt-0.5">
                          {(ks.ad.avg_watch_time || 0) >= detailedReport!.avgWatch && detailedReport!.avgWatch > 0
                            ? '→ 영상 관심도↑ 전환 동선 문제 가능성. CTA/랜딩페이지 점검 권장'
                            : '→ 노출 대비 반응 부족. 소재 교체 또는 타겟 재설정 검토'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Top/Bottom performers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {detailedReport.bestCpl && (
                  <div className="bg-emerald-50/80 rounded-lg p-2 border border-emerald-200/60">
                    <p className="text-[10px] text-emerald-600 font-medium">최고 CPL 효율</p>
                    <p className="text-[11px] font-semibold text-emerald-900 truncate" title={detailedReport.bestCpl.ad.ad_name}>
                      {detailedReport.bestCpl.ad.ad_name}
                    </p>
                    <p className="text-[10px] text-emerald-700">
                      CPL ${detailedReport.bestCpl.ad.cpl.toFixed(1)} / 리드 {detailedReport.bestCpl.ad.leads}건 / CTR {detailedReport.bestCpl.ad.ctr.toFixed(2)}%
                    </p>
                  </div>
                )}
                {detailedReport.bestWatch && (
                  <div className="bg-blue-50/80 rounded-lg p-2 border border-blue-200/60">
                    <p className="text-[10px] text-blue-600 font-medium">최장 시청 시간</p>
                    <p className="text-[11px] font-semibold text-blue-900 truncate" title={detailedReport.bestWatch.ad.ad_name}>
                      {detailedReport.bestWatch.ad.ad_name}
                    </p>
                    <p className="text-[10px] text-blue-700">
                      시청 {detailedReport.bestWatch.ad.avg_watch_time?.toFixed(1)}s / 리드 {detailedReport.bestWatch.ad.leads}건 / CTR {detailedReport.bestWatch.ad.ctr.toFixed(2)}%
                    </p>
                  </div>
                )}
              </div>

              {/* Distribution summary */}
              <div className="text-[10px] text-violet-600 leading-relaxed bg-white/50 rounded-lg p-2">
                <p>
                  <span className="font-semibold">소재 분포:</span>{' '}
                  유지 {detailedReport.keepAds.length}개 · 관찰 {detailedReport.watchAds.length}개 · 중단 {detailedReport.offAds.length}개
                </p>
                {detailedReport.worstCpl && detailedReport.bestCpl && detailedReport.worstCpl.ad.ad_id !== detailedReport.bestCpl.ad.ad_id && (
                  <p className="mt-0.5">
                    CPL 편차 ${detailedReport.bestCpl.ad.cpl.toFixed(1)} ~ ${detailedReport.worstCpl.ad.cpl.toFixed(1)} —{' '}
                    {detailedReport.worstCpl.ad.cpl / detailedReport.bestCpl.ad.cpl > 3
                      ? '극단적 편차, 비효율 소재 예산 재배분 시급'
                      : detailedReport.worstCpl.ad.cpl / detailedReport.bestCpl.ad.cpl > 2
                        ? '편차 큼, 하위 소재 예산 축소 검토'
                        : '편차 보통, 전반적 효율 양호'}
                  </p>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
