'use client'

import { cn, formatNumber, formatCurrency, formatPercent } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: number
  previousValue?: number
  format?: 'number' | 'currency' | 'currencyKRW' | 'currencyUSD' | 'percent' | 'time'
  className?: string
}

export function KPICard({
  title,
  value,
  previousValue,
  format = 'number',
  className,
}: KPICardProps) {
  const formattedValue = (() => {
    switch (format) {
      case 'currency':
        return formatCurrency(value)
      case 'currencyKRW':
        return formatCurrency(value, 'KRW')
      case 'currencyUSD':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case 'percent':
        return formatPercent(value)
      case 'time': {
        if (value < 60) return `${value.toFixed(1)}초`
        const mins = Math.floor(value / 60)
        const secs = Math.round(value % 60)
        return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`
      }
      default:
        return formatNumber(value)
    }
  })()

  const change = previousValue !== undefined && previousValue !== 0
    ? ((value - previousValue) / previousValue) * 100
    : null

  const TrendIcon = change === null
    ? Minus
    : change > 0
    ? TrendingUp
    : change < 0
    ? TrendingDown
    : Minus

  const trendColor = change === null
    ? 'text-gray-400'
    : change > 0
    ? 'text-green-600'
    : change < 0
    ? 'text-red-600'
    : 'text-gray-400'

  return (
    <div className={cn('rounded-lg border bg-white p-6 shadow-sm', className)}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{formattedValue}</span>
        {change !== null && (
          <span className={cn('flex items-center text-sm font-medium', trendColor)}>
            <TrendIcon className="h-4 w-4 mr-1" />
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      {previousValue !== undefined && (
        <p className="mt-1 text-xs text-gray-400">
          이전: {format === 'currency' ? formatCurrency(previousValue) : format === 'currencyKRW' ? formatCurrency(previousValue, 'KRW') : format === 'currencyUSD' ? `$${previousValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : format === 'time' ? (previousValue < 60 ? `${previousValue.toFixed(1)}초` : `${Math.floor(previousValue / 60)}분 ${Math.round(previousValue % 60)}초`) : formatNumber(previousValue)}
        </p>
      )}
    </div>
  )
}
