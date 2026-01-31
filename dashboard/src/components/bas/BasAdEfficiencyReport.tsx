'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Lightbulb, Loader2, AlertTriangle, Zap } from 'lucide-react'
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

/** Factor 1: Burn Rate (25%) — spend efficiency risk */
function scoreBurnRate(ad: MetaAdData, metaAllocationShare: number): number {
  if (ad.leads === 0) {
    // No leads: risk proportional to how much Meta allocated
    return clamp(metaAllocationShare * 100)
  }
  // Has leads: risk based on CPL vs target
  const cplRatio = ad.cpl / TARGET_CPL
  return clamp((cplRatio - 1) * 50 + 50) // CPL = target → 50, 2x target → 100
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

/** Factor 5: Ad Fatigue (15%) — CTR vs batch avg + age penalty */
function scoreFatigue(
  ad: MetaAdData,
  ageDays: number,
  batchAvgCtr: number,
): number {
  let fatigue = 0
  if (batchAvgCtr > 0) {
    const ctrRatio = ad.ctr / batchAvgCtr
    // CTR < batch avg → fatigued
    fatigue = clamp((1 - ctrRatio) * 80)
  }
  // Age penalty: +15pts max at D+30
  const agePenalty = Math.min(15, (ageDays / 30) * 15)
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

function ScoreGauge({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 50 ? '#10b981' : score >= 30 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
        className="text-xs font-bold" fill={color}
      >
        {score}
      </text>
    </svg>
  )
}

function RiskBar({ value, color = '#ef4444' }: { value: number; color?: string }) {
  const bg = value >= 70 ? '#fef2f2' : value >= 45 ? '#fffbeb' : '#f0fdf4'
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: bg }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  )
}

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
  const [leads, setLeads] = useState<BasLead[]>([])
  const [leadsLoaded, setLeadsLoaded] = useState(false)

  // Fetch ad effective_status from Meta API
  useEffect(() => {
    let cancelled = false
    async function load() {
      setStatusLoading(true)
      try {
        const res = await fetch(`/api/meta/ads-status?clientSlug=${clientSlug}`)
        if (!res.ok) throw new Error('상태 조회 실패')
        const data = await res.json()
        const ids = new Set<string>()
        for (const campaign of data.campaigns || []) {
          for (const adset of campaign.adsets || []) {
            for (const ad of adset.ads || []) {
              if (ad.is_active) ids.add(ad.id)
            }
          }
        }
        if (!cancelled) setActiveAdIds(ids)
      } catch {
        if (!cancelled) setActiveAdIds(null)
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

  // Filter: only active ads
  const activeAds = useMemo(() => {
    if (activeAdIds === null) return ads
    return ads.filter((ad) => activeAdIds.has(ad.ad_id))
  }, [ads, activeAdIds])

  const excludedCount = ads.length - activeAds.length

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
    for (const ad of activeAds) {
      const batch = getAdBatch(ad)
      if (!batchCtrs.has(batch)) batchCtrs.set(batch, [])
      batchCtrs.get(batch)!.push(ad.ctr)
    }
    const avgs = new Map<string, number>()
    batchCtrs.forEach((ctrs, batch) => {
      avgs.set(batch, ctrs.reduce((s: number, v: number) => s + v, 0) / ctrs.length)
    })
    return avgs
  }, [activeAds])

  // Total spend for allocation share
  const totalSpend = useMemo(() => activeAds.reduce((s, a) => s + a.spend, 0), [activeAds])

  // Scored ads with full risk analysis
  const scored = useMemo<ScoredAd[]>(() => {
    if (activeAds.length === 0) return []

    // Precompute enriched values
    const enriched = activeAds.map((ad) => {
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
      const batchAvg = batchAvgCtrs.get(getAdBatch(e.ad)) || e.ad.ctr
      const factors: AdRiskFactors = {
        burnRate: scoreBurnRate(e.ad, e.metaAllocationShare),
        cplTrend: scoreCplTrend(e.ad, dailyData),
        pipeline: leadsLoaded
          ? scorePipeline(e.wpv, e.ad.spend, allWpvEfficiencies)
          : 50,
        stability: scoreStability(e.ad, dailyData),
        fatigue: scoreFatigue(e.ad, e.ageDays, batchAvg),
      }

      const compositeRisk = Math.round(
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
  }, [activeAds, totalSpend, wpvMap, batchAvgCtrs, dailyData, leadsLoaded])

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

  // Loading
  if (statusLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        <p className="text-gray-400 text-sm">광고 상태 조회 중...</p>
      </div>
    )
  }

  // Empty
  if (activeAds.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-400 text-sm">
          {ads.length > 0
            ? `활성 광고가 없습니다. (OFF 상태 ${ads.length}개 제외됨)`
            : '광고 데이터가 없습니다.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
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
            활성 <span className="font-semibold text-gray-900">{activeAds.length}</span>개 광고
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

            return (
              <motion.div
                key={item.ad.ad_id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                className={`bg-white rounded-xl border p-4 ${cfg.border}`}
              >
                <div className="flex items-start gap-3">
                  {/* Score gauge */}
                  <ScoreGauge score={item.score} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Name + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-gray-900 truncate max-w-[180px]" title={item.ad.ad_name}>
                        {item.ad.ad_name}
                      </h4>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                        D+{item.ageDays}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                        {cfg.emoji} {cfg.label}
                      </span>
                      {/* Kill Switch badge */}
                      {item.risk.killSwitch && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 bg-red-600 text-white animate-pulse flex items-center gap-0.5">
                          <Zap className="h-2.5 w-2.5" />
                          KILL
                        </span>
                      )}
                      {/* WPV badge */}
                      {item.risk.wpv > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 bg-blue-100 text-blue-700">
                          WPV {item.risk.wpv}
                        </span>
                      )}
                    </div>

                    {item.ad.campaign_name && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.ad.campaign_name}</p>
                    )}

                    {/* Risk bar */}
                    <div className="mt-2 mb-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-gray-400">리스크</span>
                        <span className="text-[10px] font-semibold" style={{ color: riskColor }}>
                          {item.risk.compositeRisk}
                        </span>
                      </div>
                      <RiskBar value={item.risk.compositeRisk} color={riskColor} />
                    </div>

                    {/* Meta allocation */}
                    <div className="text-[10px] text-gray-400 mb-1">
                      Meta 배분 {(item.risk.metaAllocationShare * 100).toFixed(1)}%
                      {item.risk.killSwitchReason && (
                        <span className="text-red-500 ml-1">· {item.risk.killSwitchReason}</span>
                      )}
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
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
        </motion.div>
      )}
    </div>
  )
}
