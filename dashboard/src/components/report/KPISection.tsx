'use client'

import { Card } from '@/components/ui/card'
import { formatNumber, formatCurrency, formatPercent, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPIData {
  impressions: number
  clicks: number
  spend: number
  ctr: number
  cpc: number
  leads: number  // 잠재고객 리드 (Meta)
  homepageLeads?: number  // 트래픽 리드 (홈페이지)
  cpl: number
  videoViews?: number
  avgWatchTime?: number
  budgetUsage?: number
  prevPeriod?: {
    impressions: number
    clicks: number
    spend: number
    leads: number
  }
}

interface KPISectionProps {
  data: KPIData
  metricType?: 'video' | 'lead'  // video: H.E.A 판교 (리드 숨김), lead: 나라똔 (리드 표시)
}

function TrendBadge({ current, previous, invert = false }: { current: number, previous?: number, invert?: boolean }) {
  if (previous === undefined || previous === 0) return null

  const change = ((current - previous) / previous) * 100
  const isPositive = invert ? change < 0 : change > 0
  const Icon = change >= 0 ? TrendingUp : TrendingDown

  return (
    <span className={cn(
      'flex items-center gap-0.5 text-[10px] md:text-sm font-medium',
      isPositive ? 'text-green-600' : 'text-red-600'
    )}>
      <Icon className="h-2.5 w-2.5 md:h-3 md:w-3" />
      {Math.abs(change).toFixed(1)}%
    </span>
  )
}

// 시간 포맷 (초 -> "Xm Ys" 또는 "Xs")
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}초`
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`
}

function KPICard({
  title,
  value,
  previousValue,
  format = 'number',
  invert = false,
  showProgress = false,
  progressValue = 0,
  valueColor,
}: {
  title: string
  value: number
  previousValue?: number
  format?: 'number' | 'currency' | 'percent' | 'time'
  invert?: boolean
  showProgress?: boolean
  progressValue?: number
  valueColor?: 'red' | 'green' | 'default'
}) {
  const formattedValue = format === 'currency'
    ? formatCurrency(value, 'KRW')
    : format === 'percent'
    ? formatPercent(value)
    : format === 'time'
    ? formatTime(value)
    : formatNumber(value)

  const valueColorClass = valueColor === 'red'
    ? 'text-red-600'
    : valueColor === 'green'
    ? 'text-green-600'
    : 'text-gray-900'

  return (
    <div className="rounded-lg border bg-white p-3 md:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-xs md:text-sm text-gray-500 mb-1">{title}</div>
      <div className={cn("text-base md:text-2xl font-bold truncate", valueColorClass)}>{formattedValue}</div>
      <div className="flex items-center gap-1 mt-1 md:mt-2">
        <TrendBadge current={value} previous={previousValue} invert={invert} />
      </div>
      {showProgress && (
        <div className="mt-2 md:mt-3 bg-gray-200 rounded-full h-1.5 md:h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full"
            style={{ width: `${Math.min(progressValue, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// 리드 복합 카드 (잠재고객 + 트래픽)
function LeadsCard({
  metaLeads,
  homepageLeads,
  previousLeads,
}: {
  metaLeads: number
  homepageLeads: number
  previousLeads?: number
}) {
  const totalLeads = metaLeads + homepageLeads

  return (
    <div className="rounded-lg border bg-white p-3 md:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-xs md:text-sm text-gray-500 mb-1">리드 (상담신청)</div>
      <div className="text-base md:text-2xl font-bold text-gray-900">
        {formatNumber(totalLeads)}
      </div>
      <div className="flex items-center gap-1 mt-1 md:mt-2">
        <TrendBadge current={totalLeads} previous={previousLeads} />
      </div>
      {/* 리드 유형별 분류 */}
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
        <div className="flex items-center justify-between text-xs md:text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-gray-600">잠재고객</span>
          </span>
          <span className="font-semibold text-red-600">{formatNumber(metaLeads)}</span>
        </div>
        <div className="flex items-center justify-between text-xs md:text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-gray-600">트래픽</span>
          </span>
          <span className="font-semibold text-green-600">{formatNumber(homepageLeads)}</span>
        </div>
      </div>
    </div>
  )
}

export function KPISection({ data, metricType = 'lead' }: KPISectionProps) {
  const showLeads = metricType !== 'video'  // H.E.A 판교(video)는 리드 숨김

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-6">
        <span>📈</span>
        <span>핵심 KPI</span>
        <span className="text-sm font-normal text-gray-500">(전월 대비)</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="총 노출"
          value={data.impressions}
          previousValue={data.prevPeriod?.impressions}
          showProgress
          progressValue={data.prevPeriod ? (data.impressions / data.prevPeriod.impressions) * 100 : 80}
        />
        <KPICard
          title="총 클릭"
          value={data.clicks}
          previousValue={data.prevPeriod?.clicks}
          showProgress
          progressValue={data.prevPeriod ? (data.clicks / data.prevPeriod.clicks) * 100 : 75}
        />
        <KPICard
          title="총 지출"
          value={data.spend}
          previousValue={data.prevPeriod?.spend}
          format="currency"
          showProgress
          progressValue={data.budgetUsage || 85}
        />
        <KPICard
          title="평균 CTR"
          value={data.ctr}
          format="percent"
          showProgress
          progressValue={Math.min(data.ctr * 30, 100)}
        />
      </div>

      <div className={`grid grid-cols-2 ${showLeads ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
        <KPICard
          title="클릭당 가격"
          value={data.cpc}
          format="currency"
          invert
        />
        {showLeads && (
          <>
            <LeadsCard
              metaLeads={data.leads || 0}
              homepageLeads={data.homepageLeads || 0}
              previousLeads={data.prevPeriod?.leads}
            />
            <KPICard
              title="리드당 비용 (CPL)"
              value={data.cpl || 0}
              format="currency"
              invert
            />
          </>
        )}
        <KPICard
          title="영상 조회수"
          value={data.videoViews || 0}
        />
        {metricType === 'video' && data.avgWatchTime && (
          <KPICard
            title="평균 시청시간"
            value={data.avgWatchTime}
            format="time"
          />
        )}
      </div>
    </Card>
  )
}
