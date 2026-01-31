'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { Info, MousePointerClick } from 'lucide-react'
import type { MetaAdData } from '@/types/meta-analytics'
import { formatNumber } from '@/lib/utils'

type AxisMetric = 'spend' | 'leads' | 'impressions' | 'clicks' | 'ctr' | 'cpl'

const METRIC_LABELS: Record<AxisMetric, string> = {
  spend: '지출 ($)',
  leads: '리드',
  impressions: '노출수',
  clicks: '클릭수',
  ctr: 'CTR (%)',
  cpl: 'CPL ($)',
}

const QUADRANT_LABELS = [
  { key: 'top-right', label: '고효율', emoji: '🏆', color: 'text-emerald-600' },
  { key: 'top-left', label: '저비용 고성과', emoji: '📈', color: 'text-blue-600' },
  { key: 'bottom-right', label: '고비용 저성과', emoji: '⚠️', color: 'text-amber-600' },
  { key: 'bottom-left', label: '저성과', emoji: '💤', color: 'text-gray-400' },
]

function getCplColor(cpl: number, minCpl: number, maxCpl: number): string {
  if (maxCpl === minCpl) return '#22c55e'
  const ratio = Math.min(1, Math.max(0, (cpl - minCpl) / (maxCpl - minCpl)))
  // green → yellow → red
  if (ratio < 0.5) {
    const t = ratio * 2
    const r = Math.round(34 + t * (234 - 34))
    const g = Math.round(197 + t * (179 - 197))
    const b = Math.round(94 + t * (8 - 94))
    return `rgb(${r},${g},${b})`
  }
  const t = (ratio - 0.5) * 2
  const r = Math.round(234 + t * (239 - 234))
  const g = Math.round(179 - t * 179)
  const b = Math.round(8 + t * (68 - 8))
  return `rgb(${r},${g},${b})`
}

function getMetricValue(ad: MetaAdData, metric: AxisMetric): number {
  switch (metric) {
    case 'spend': return ad.spend
    case 'leads': return ad.leads
    case 'impressions': return ad.impressions
    case 'clicks': return ad.clicks
    case 'ctr': return ad.ctr
    case 'cpl': return ad.cpl
  }
}

function formatMetricValue(value: number, metric: AxisMetric): string {
  switch (metric) {
    case 'spend':
    case 'cpl':
      return `$${value.toFixed(2)}`
    case 'ctr':
      return `${value.toFixed(2)}%`
    case 'leads':
    case 'clicks':
      return value.toFixed(0)
    case 'impressions':
      return formatNumber(value)
  }
}

interface BasAdBubbleMapProps {
  ads: MetaAdData[]
  onAdClick?: (ad: MetaAdData) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BubbleTooltip({ active, payload, xMetric, yMetric }: any) {
  if (!active || !payload?.length) return null
  const ad = payload[0]?.payload?._ad as MetaAdData | undefined
  if (!ad) return null
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-[260px]">
      <div className="font-semibold text-sm text-gray-900 truncate">{ad.ad_name}</div>
      {ad.campaign_name && (
        <div className="text-xs text-gray-400 truncate mb-2">{ad.campaign_name}</div>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-gray-500">{METRIC_LABELS[xMetric as AxisMetric]}</span>
        <span className="font-medium text-right">{formatMetricValue(getMetricValue(ad, xMetric), xMetric)}</span>
        <span className="text-gray-500">{METRIC_LABELS[yMetric as AxisMetric]}</span>
        <span className="font-medium text-right">{formatMetricValue(getMetricValue(ad, yMetric), yMetric)}</span>
        <span className="text-gray-500">CTR</span>
        <span className="font-medium text-right">{ad.ctr.toFixed(2)}%</span>
        <span className="text-gray-500">CPL</span>
        <span className="font-medium text-right">{ad.leads > 0 ? `$${ad.cpl.toFixed(2)}` : '-'}</span>
        <span className="text-gray-500">노출</span>
        <span className="font-medium text-right">{formatNumber(ad.impressions)}</span>
        <span className="text-gray-500">클릭</span>
        <span className="font-medium text-right">{formatNumber(ad.clicks)}</span>
      </div>
    </div>
  )
}

export function BasAdBubbleMap({ ads, onAdClick }: BasAdBubbleMapProps) {
  const [xMetric, setXMetric] = useState<AxisMetric>('spend')
  const [yMetric, setYMetric] = useState<AxisMetric>('leads')

  const { chartData, avgX, avgY, minCpl, maxCpl } = useMemo(() => {
    const validAds = ads.filter((a) => a.impressions > 0)
    if (validAds.length === 0) return { chartData: [], avgX: 0, avgY: 0, minCpl: 0, maxCpl: 0 }

    const xValues = validAds.map((a) => getMetricValue(a, xMetric))
    const yValues = validAds.map((a) => getMetricValue(a, yMetric))
    const cpls = validAds.filter((a) => a.leads > 0).map((a) => a.cpl)
    const aX = xValues.reduce((s, v) => s + v, 0) / xValues.length
    const aY = yValues.reduce((s, v) => s + v, 0) / yValues.length
    const mnCpl = cpls.length > 0 ? Math.min(...cpls) : 0
    const mxCpl = cpls.length > 0 ? Math.max(...cpls) : 1

    const data = validAds.map((ad) => ({
      x: getMetricValue(ad, xMetric),
      y: getMetricValue(ad, yMetric),
      z: Math.max(ad.ctr * 10, 3), // bubble size, min 3 for visibility
      cpl: ad.cpl,
      _ad: ad,
    }))

    return { chartData: data, avgX: aX, avgY: aY, minCpl: mnCpl, maxCpl: mxCpl }
  }, [ads, xMetric, yMetric])

  // Auto-insight
  const insight = useMemo(() => {
    const validAds = ads.filter((a) => a.impressions > 0)
    if (validAds.length < 2) return null
    const withLeads = validAds.filter((a) => a.leads > 0)
    if (withLeads.length === 0) return '리드가 발생한 광고가 없습니다.'
    const bestCpl = withLeads.reduce((best, ad) => (ad.cpl < best.cpl ? ad : best))
    const topRight = validAds.filter(
      (a) => getMetricValue(a, xMetric) > (chartData.length > 0 ? avgX : 0) && getMetricValue(a, yMetric) > (chartData.length > 0 ? avgY : 0)
    )
    const parts: string[] = []
    parts.push(`CPL이 가장 낮은 광고: "${bestCpl.ad_name.slice(0, 20)}" ($${bestCpl.cpl.toFixed(2)})`)
    if (topRight.length > 0) {
      parts.push(`고효율 영역(🏆) 광고 ${topRight.length}개`)
    }
    return parts.join(' · ')
  }, [ads, xMetric, yMetric, chartData, avgX, avgY])

  if (ads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
        광고 데이터가 없습니다.
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sm text-gray-900">광고 성과 버블맵</h3>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-gray-500">X:</label>
          <select
            value={xMetric}
            onChange={(e) => setXMetric(e.target.value as AxisMetric)}
            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          >
            {Object.entries(METRIC_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className="text-gray-500">Y:</label>
          <select
            value={yMetric}
            onChange={(e) => setYMetric(e.target.value as AxisMetric)}
            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          >
            {Object.entries(METRIC_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4-quadrant legend */}
      <div className="px-4 py-2 flex flex-wrap gap-3 text-xs border-b border-gray-50">
        {QUADRANT_LABELS.map((q) => (
          <span key={q.key} className={`${q.color}`}>
            {q.emoji} {q.label}
          </span>
        ))}
        <span className="ml-auto text-gray-400 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />낮은CPL
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 ml-1" />높은CPL
          <span className="text-gray-300 ml-1">| 버블 크기 = CTR</span>
        </span>
      </div>

      {/* Click hint */}
      <div className="px-4 pt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
        <MousePointerClick className="h-3 w-3" />
        <span>버블을 클릭하면 해당 광고의 상세 성과를 확인할 수 있습니다</span>
      </div>

      {/* Chart */}
      <div className="p-4 pt-2">
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="x"
              type="number"
              name={METRIC_LABELS[xMetric]}
              tick={{ fontSize: 11 }}
              label={{ value: METRIC_LABELS[xMetric], position: 'insideBottom', offset: -10, fontSize: 11, fill: '#6b7280' }}
            />
            <YAxis
              dataKey="y"
              type="number"
              name={METRIC_LABELS[yMetric]}
              tick={{ fontSize: 11 }}
              label={{ value: METRIC_LABELS[yMetric], angle: -90, position: 'insideLeft', offset: 5, fontSize: 11, fill: '#6b7280' }}
            />
            <ZAxis dataKey="z" range={[40, 400]} />
            {/* Average reference lines */}
            {chartData.length > 0 && (
              <>
                <ReferenceLine x={avgX} stroke="#d1d5db" strokeDasharray="4 4" />
                <ReferenceLine y={avgY} stroke="#d1d5db" strokeDasharray="4 4" />
              </>
            )}
            <Tooltip
              content={<BubbleTooltip xMetric={xMetric} yMetric={yMetric} />}
              cursor={{ strokeDasharray: '3 3' }}
            />
            <Scatter data={chartData} onClick={(entry) => {
              if (onAdClick && entry?._ad) onAdClick(entry._ad as MetaAdData)
            }}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={getCplColor(entry.cpl, minCpl, maxCpl)}
                  fillOpacity={0.75}
                  stroke={getCplColor(entry.cpl, minCpl, maxCpl)}
                  strokeWidth={1}
                  cursor="pointer"
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Auto-insight */}
      {insight && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 text-xs text-gray-600 bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
            <Info className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
            <span>{insight}</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}
