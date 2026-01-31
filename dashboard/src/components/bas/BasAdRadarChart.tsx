'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { X, Award } from 'lucide-react'
import type { MetaAdData } from '@/types/meta-analytics'
import { formatNumber } from '@/lib/utils'

interface BasAdRadarChartProps {
  ad: MetaAdData
  allAds: MetaAdData[]
  onClose?: () => void
}

interface RadarDataPoint {
  axis: string
  score: number
  rawValue: string
  icon: string
}

// Percentile rank: 0~100
function percentileRank(value: number, all: number[]): number {
  if (all.length <= 1) return 50
  const sorted = [...all].sort((a, b) => a - b)
  const idx = sorted.findIndex((v) => v >= value)
  if (idx === -1) return 100
  return Math.round((idx / (sorted.length - 1)) * 100)
}

// Weights for composite score
const WEIGHTS = {
  ctr: 0.25,
  leads: 0.25,
  cpl_inv: 0.25,
  watch_time: 0.15,
  impressions: 0.10,
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-blue-600'
  if (score >= 25) return 'text-amber-600'
  return 'text-red-600'
}

function getScoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-50 border-emerald-200'
  if (score >= 50) return 'bg-blue-50 border-blue-200'
  if (score >= 25) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return '최우수'
  if (score >= 60) return '우수'
  if (score >= 40) return '보통'
  if (score >= 20) return '개선필요'
  return '부진'
}

export function BasAdRadarChart({ ad, allAds, onClose }: BasAdRadarChartProps) {
  const { radarData, compositeScore } = useMemo(() => {
    const allCtrs = allAds.map((a) => a.ctr)
    const allLeads = allAds.map((a) => a.leads)
    const allCpls = allAds.filter((a) => a.leads > 0).map((a) => a.cpl)
    const allWatchTimes = allAds.filter((a) => (a.avg_watch_time || 0) > 0).map((a) => a.avg_watch_time || 0)
    const allImpressions = allAds.map((a) => a.impressions)

    const ctrScore = percentileRank(ad.ctr, allCtrs)
    const leadsScore = percentileRank(ad.leads, allLeads)
    // CPL inverted: lower CPL = higher score
    const cplInvScore = ad.leads > 0 && allCpls.length > 0
      ? 100 - percentileRank(ad.cpl, allCpls)
      : 0
    const watchScore = (ad.avg_watch_time || 0) > 0 && allWatchTimes.length > 0
      ? percentileRank(ad.avg_watch_time || 0, allWatchTimes)
      : 0
    const impressionScore = percentileRank(ad.impressions, allImpressions)

    const composite = Math.round(
      ctrScore * WEIGHTS.ctr +
      leadsScore * WEIGHTS.leads +
      cplInvScore * WEIGHTS.cpl_inv +
      watchScore * WEIGHTS.watch_time +
      impressionScore * WEIGHTS.impressions
    )

    const data: RadarDataPoint[] = [
      { axis: 'CTR', score: ctrScore, rawValue: `${ad.ctr.toFixed(2)}%`, icon: '🖱' },
      { axis: '리드', score: leadsScore, rawValue: `${ad.leads}건`, icon: '🎯' },
      { axis: 'CPL효율', score: cplInvScore, rawValue: ad.leads > 0 ? `$${ad.cpl.toFixed(2)}` : '-', icon: '💰' },
      { axis: '시청시간', score: watchScore, rawValue: ad.avg_watch_time ? `${ad.avg_watch_time.toFixed(1)}s` : '-', icon: '⏱' },
      { axis: '노출', score: impressionScore, rawValue: formatNumber(ad.impressions), icon: '👁' },
    ]

    return {
      radarData: data,
      compositeScore: composite,
    }
  }, [ad, allAds])

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-gray-900 truncate">{ad.ad_name}</h3>
          {ad.campaign_name && (
            <p className="text-xs text-gray-400 truncate">{ad.campaign_name}</p>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md ml-2">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Composite Score */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center ${getScoreBg(compositeScore)}`}>
          <span className={`text-lg font-bold ${getScoreColor(compositeScore)}`}>{compositeScore}</span>
          <span className="text-[9px] text-gray-400">/ 100</span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <Award className={`h-4 w-4 ${getScoreColor(compositeScore)}`} />
            <span className={`text-sm font-semibold ${getScoreColor(compositeScore)}`}>
              {getScoreLabel(compositeScore)}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">전체 {allAds.length}개 광고 대비 종합 점수</p>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="px-2">
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData} outerRadius={80}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 9 }}
              axisLine={false}
            />
            <Radar
              dataKey="score"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload as RadarDataPoint
                return (
                  <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 text-xs">
                    <div className="font-semibold">{d.icon} {d.axis}</div>
                    <div className="text-gray-500">점수: {d.score}/100</div>
                    <div className="text-gray-500">실제값: {d.rawValue}</div>
                  </div>
                )
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score breakdown */}
      <div className="px-4 pb-4">
        <div className="space-y-1.5">
          {radarData.map((d) => (
            <div key={d.axis} className="flex items-center gap-2 text-xs">
              <span className="w-14 text-gray-500 truncate">{d.axis}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${d.score}%`,
                    backgroundColor: d.score >= 70 ? '#22c55e' : d.score >= 40 ? '#3b82f6' : '#f59e0b',
                  }}
                />
              </div>
              <span className="w-8 text-right font-medium text-gray-700">{d.score}</span>
              <span className="w-16 text-right text-gray-400">{d.rawValue}</span>
            </div>
          ))}
        </div>

        {/* Additional metrics */}
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
            <span className="text-gray-400">지출</span>
            <span className="float-right font-medium">${ad.spend.toFixed(2)}</span>
          </div>
          <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
            <span className="text-gray-400">클릭</span>
            <span className="float-right font-medium">{formatNumber(ad.clicks)}</span>
          </div>
          <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
            <span className="text-gray-400">기간</span>
            <span className="float-right font-medium">{ad.days_count}일</span>
          </div>
          <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
            <span className="text-gray-400">비디오</span>
            <span className="float-right font-medium">{formatNumber(ad.video_views)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
