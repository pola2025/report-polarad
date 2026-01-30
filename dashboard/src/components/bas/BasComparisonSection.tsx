'use client'

import type { MetaKPISummary } from '@/types/meta-analytics'

interface BasComparisonSectionProps {
  current: MetaKPISummary
  previous: MetaKPISummary
  currentPeriod: string
  previousPeriod: string
  mode: 'weekly' | 'monthly'
}

interface MetricRowProps {
  label: string
  current: number
  previous: number
  format: 'number' | 'currency' | 'percentage'
  invertTrend?: boolean
}

function MetricRow({ label, current, previous, format, invertTrend = false }: MetricRowProps) {
  const diff = current - previous
  const percentChange = previous !== 0 ? (diff / previous) * 100 : 0
  const isPositive = invertTrend ? diff < 0 : diff > 0

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      case 'percentage':
        return `${value.toFixed(2)}%`
      default:
        return value.toLocaleString('ko-KR')
    }
  }

  return (
    <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-100 hover:shadow-sm transition-shadow">
      <div className="text-xs sm:text-sm font-medium text-gray-500 mb-2">{label}</div>
      <div className="text-lg sm:text-2xl font-bold text-gray-900 mb-1">{formatValue(current)}</div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">이전: {formatValue(previous)}</span>
        <span
          className={`text-xs sm:text-sm font-semibold ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isPositive ? '\u2191' : '\u2193'} {Math.abs(percentChange).toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

export function BasComparisonSection({
  current,
  previous,
  currentPeriod,
  previousPeriod,
  mode,
}: BasComparisonSectionProps) {
  const modeLabel = mode === 'weekly' ? '주간' : '월간'

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
          {modeLabel} 비교 분석
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
          <span className="px-2 py-1 bg-white rounded-md font-medium">이전: {previousPeriod}</span>
          <span className="text-gray-400">{'\u2192'}</span>
          <span className="px-2 py-1 bg-blue-600 text-white rounded-md font-medium">
            현재: {currentPeriod}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricRow label="총 리드" current={current.total_leads} previous={previous.total_leads} format="number" />
        <MetricRow label="총 지출" current={current.total_spend} previous={previous.total_spend} format="currency" invertTrend />
        <MetricRow label="평균 CPL" current={current.avg_cpl} previous={previous.avg_cpl} format="currency" invertTrend />
        <MetricRow label="평균 CTR" current={current.avg_ctr} previous={previous.avg_ctr} format="percentage" />
      </div>

      {/* AI 인사이트 */}
      <div className="mt-4 bg-white rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <span>{'\ud83d\udca1'}</span>
          <h4 className="text-sm font-semibold text-gray-900">AI 인사이트</h4>
        </div>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
          {current.total_leads > previous.total_leads
            ? `리드가 ${((current.total_leads - previous.total_leads) / Math.max(previous.total_leads, 1) * 100).toFixed(1)}% 증가했습니다. `
            : `리드가 ${((previous.total_leads - current.total_leads) / Math.max(previous.total_leads, 1) * 100).toFixed(1)}% 감소했습니다. `}
          {current.avg_cpl < previous.avg_cpl
            ? 'CPL이 개선되어 비용 효율이 높아졌습니다.'
            : 'CPL이 상승했습니다. 캠페인 최적화를 고려해보세요.'}
        </p>
      </div>
    </div>
  )
}
