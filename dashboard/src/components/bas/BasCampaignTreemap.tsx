'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { Info, MousePointerClick } from 'lucide-react'
import type { MetaAdData } from '@/types/meta-analytics'
import { formatNumber } from '@/lib/utils'

type SizeMetric = 'spend' | 'leads' | 'impressions'
type ColorMetric = 'cpl' | 'ctr' | 'leads'

const SIZE_LABELS: Record<SizeMetric, string> = {
  spend: '지출',
  leads: '리드',
  impressions: '노출수',
}

const COLOR_LABELS: Record<ColorMetric, string> = {
  cpl: 'CPL 효율',
  ctr: 'CTR',
  leads: '리드수',
}

interface TreemapNode {
  name: string
  size: number
  colorValue: number
  campaignName: string
  spend: number
  leads: number
  cpl: number
  ctr: number
  impressions: number
  adCount: number
  _ads: MetaAdData[]
  [key: string]: unknown
}

function getCplTreemapColor(value: number, min: number, max: number, metric: ColorMetric): string {
  if (max === min) return '#22c55e'
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)))

  if (metric === 'cpl') {
    // CPL: green (low=good) → red (high=bad)
    if (ratio < 0.5) {
      const t = ratio * 2
      return `rgb(${Math.round(34 + t * 200)}, ${Math.round(197 - t * 30)}, ${Math.round(94 - t * 86)})`
    }
    const t = (ratio - 0.5) * 2
    return `rgb(${Math.round(234 + t * 5)}, ${Math.round(167 - t * 167)}, ${Math.round(8 + t * 60)})`
  }
  // CTR, leads: blue scale (low=light → high=deep)
  const r = Math.round(219 - ratio * 160)
  const g = Math.round(234 - ratio * 130)
  const b = Math.round(254 - ratio * 50)
  return `rgb(${r},${g},${b})`
}

interface BasCampaignTreemapProps {
  ads: MetaAdData[]
  onAdSelect?: (ad: MetaAdData) => void
  sizeMetric?: SizeMetric
  colorMetric?: ColorMetric
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const node = payload[0]?.payload as TreemapNode | undefined
  if (!node) return null
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-[240px]">
      <div className="font-semibold text-sm text-gray-900 truncate">{node.name}</div>
      <div className="text-xs text-gray-400 mb-2">{node.adCount}개 광고</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-gray-500">지출</span>
        <span className="font-medium text-right">${node.spend.toFixed(2)}</span>
        <span className="text-gray-500">리드</span>
        <span className="font-medium text-right">{node.leads}</span>
        <span className="text-gray-500">CPL</span>
        <span className="font-medium text-right">{node.leads > 0 ? `$${node.cpl.toFixed(2)}` : '-'}</span>
        <span className="text-gray-500">CTR</span>
        <span className="font-medium text-right">{node.ctr.toFixed(2)}%</span>
        <span className="text-gray-500">노출</span>
        <span className="font-medium text-right">{formatNumber(node.impressions)}</span>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTreemapContent(props: any) {
  const { x, y, width, height, name, colorValue, _colorMin, _colorMax, _colorMetric } = props
  if (width < 4 || height < 4) return null

  const fill = getCplTreemapColor(colorValue, _colorMin, _colorMax, _colorMetric)
  const showLabel = width > 50 && height > 30
  const showValue = width > 70 && height > 45

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#fff"
        strokeWidth={2}
        rx={4}
        style={{ cursor: 'pointer' }}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showValue ? 6 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={width > 100 ? 12 : 10}
          fill="#fff"
          fontWeight={600}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
        >
          {name && name.length > (width > 100 ? 16 : 8) ? name.slice(0, width > 100 ? 16 : 8) + '…' : name}
        </text>
      )}
      {showValue && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="rgba(255,255,255,0.85)"
        >
          ${props.spend?.toFixed(0) ?? ''}
        </text>
      )}
    </g>
  )
}

export function BasCampaignTreemap({
  ads,
  onAdSelect,
  sizeMetric: defaultSize = 'spend',
  colorMetric: defaultColor = 'cpl',
}: BasCampaignTreemapProps) {
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>(defaultSize)
  const [colorMetric, setColorMetric] = useState<ColorMetric>(defaultColor)

  const { treeData, colorMin, colorMax, insight } = useMemo(() => {
    // Group by campaign
    const campaignMap = new Map<string, MetaAdData[]>()
    for (const ad of ads) {
      const key = ad.campaign_name || '(캠페인 없음)'
      const existing = campaignMap.get(key) || []
      existing.push(ad)
      campaignMap.set(key, existing)
    }

    const nodes: TreemapNode[] = []
    const entries = Array.from(campaignMap.entries())
    for (const [name, campaignAds] of entries) {
      const totalSpend = campaignAds.reduce((s, a) => s + a.spend, 0)
      const totalLeads = campaignAds.reduce((s, a) => s + a.leads, 0)
      const totalImpressions = campaignAds.reduce((s, a) => s + a.impressions, 0)
      const totalClicks = campaignAds.reduce((s, a) => s + a.clicks, 0)
      const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

      let sizeVal = totalSpend
      if (sizeMetric === 'leads') sizeVal = totalLeads
      else if (sizeMetric === 'impressions') sizeVal = totalImpressions

      let colorVal = cpl
      if (colorMetric === 'ctr') colorVal = ctr
      else if (colorMetric === 'leads') colorVal = totalLeads

      nodes.push({
        name,
        size: Math.max(sizeVal, 0.01), // prevent 0 size
        colorValue: colorVal,
        campaignName: name,
        spend: totalSpend,
        leads: totalLeads,
        cpl,
        ctr,
        impressions: totalImpressions,
        adCount: campaignAds.length,
        _ads: campaignAds,
      })
    }

    const colorValues = nodes.map((n) => n.colorValue).filter((v) => v > 0)
    const cMin = colorValues.length > 0 ? Math.min(...colorValues) : 0
    const cMax = colorValues.length > 0 ? Math.max(...colorValues) : 1

    // Insight
    let insightText: string | null = null
    if (nodes.length >= 2) {
      const sorted = [...nodes].sort((a, b) => b.spend - a.spend)
      const top = sorted[0]
      const topPct = ((top.spend / sorted.reduce((s, n) => s + n.spend, 0)) * 100).toFixed(0)
      insightText = `"${top.name.slice(0, 20)}" 캠페인이 전체 지출의 ${topPct}%를 차지`
      const withLeads = nodes.filter((n) => n.leads > 0 && n.cpl > 0)
      if (withLeads.length >= 2) {
        const bestCpl = withLeads.reduce((b, n) => (n.cpl < b.cpl ? n : b))
        insightText += ` · CPL 최저: "${bestCpl.name.slice(0, 15)}" ($${bestCpl.cpl.toFixed(2)})`
      }
    }

    return { treeData: nodes, colorMin: cMin, colorMax: cMax, insight: insightText }
  }, [ads, sizeMetric, colorMetric])

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
        <h3 className="font-semibold text-sm text-gray-900">캠페인 트리맵</h3>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-gray-500">면적:</label>
          <select
            value={sizeMetric}
            onChange={(e) => setSizeMetric(e.target.value as SizeMetric)}
            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          >
            {Object.entries(SIZE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className="text-gray-500">색상:</label>
          <select
            value={colorMetric}
            onChange={(e) => setColorMetric(e.target.value as ColorMetric)}
            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
          >
            {Object.entries(COLOR_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Color legend */}
      <div className="px-4 py-2 flex items-center gap-2 text-xs text-gray-400 border-b border-gray-50">
        {colorMetric === 'cpl' ? (
          <>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />효율 좋음
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 ml-1" />효율 나쁨
          </>
        ) : (
          <>
            <span className="inline-block w-2 h-2 rounded-full bg-blue-200" />낮음
            <span className="inline-block w-2 h-2 rounded-full bg-blue-700 ml-1" />높음
          </>
        )}
        <span className="ml-auto text-gray-300">면적 = {SIZE_LABELS[sizeMetric]} 비중</span>
      </div>

      {/* Click hint */}
      <div className="px-4 pt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
        <MousePointerClick className="h-3 w-3" />
        <span>캠페인을 클릭하면 해당 광고의 상세 성과를 확인할 수 있습니다</span>
      </div>

      {/* Treemap */}
      <div className="p-4 pt-2">
        <ResponsiveContainer width="100%" height={320}>
          <Treemap
            data={treeData}
            dataKey="size"
            stroke="#fff"
            content={
              <CustomTreemapContent
                _colorMin={colorMin}
                _colorMax={colorMax}
                _colorMetric={colorMetric}
              />
            }
            onClick={(node) => {
              if (onAdSelect && node?._ads?.length > 0) {
                onAdSelect(node._ads[0] as MetaAdData)
              }
            }}
          >
            <Tooltip content={<TreemapTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* Auto-insight */}
      {insight && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 text-xs text-gray-600 bg-rose-50 rounded-lg px-3 py-2 border border-rose-100">
            <Info className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
            <span>{insight}</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}
