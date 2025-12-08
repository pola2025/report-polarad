'use client'

import { formatSpendWithKrw } from '@/lib/constants'

interface SpendDisplayProps {
  usd: number
  krw?: number
  showBoth?: boolean
  className?: string
}

/**
 * USD/KRW 광고비 표시 컴포넌트
 * 예: $150.00 (₩225,000)
 */
export function SpendDisplay({ usd, krw, showBoth = true, className = '' }: SpendDisplayProps) {
  if (showBoth) {
    return (
      <span className={className}>
        {formatSpendWithKrw(usd)}
      </span>
    )
  }

  // KRW만 표시
  if (krw !== undefined) {
    return (
      <span className={className}>
        ₩{krw.toLocaleString()}
      </span>
    )
  }

  // USD만 표시
  return (
    <span className={className}>
      ${usd.toFixed(2)}
    </span>
  )
}
