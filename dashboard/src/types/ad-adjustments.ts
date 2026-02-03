/**
 * 광고조정일 마커 타입 정의
 */

export type AdjustmentType =
  | 'budget_change'
  | 'creative_swap'
  | 'targeting_change'
  | 'campaign_on_off'
  | 'other'

export type ImpactDirection = 'positive' | 'negative' | 'neutral'

export interface AdAdjustment {
  id: string
  client_slug: string
  date: string // YYYY-MM-DD
  type: AdjustmentType
  description: string
  impact_direction: ImpactDirection
  created_by: string
  created_at: string
}

export const ADJUSTMENT_TYPE_CONFIG: Record<
  AdjustmentType,
  { label: string; shortLabel: string; color: string; bgClass: string; textClass: string; borderClass: string }
> = {
  budget_change: {
    label: '예산 변경',
    shortLabel: '예산',
    color: '#8B5CF6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    borderClass: 'border-violet-300',
  },
  creative_swap: {
    label: '소재 교체',
    shortLabel: '소재',
    color: '#3B82F6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-300',
  },
  targeting_change: {
    label: '타겟 변경',
    shortLabel: '타겟',
    color: '#F59E0B',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-300',
  },
  campaign_on_off: {
    label: '캠페인 ON/OFF',
    shortLabel: 'ON/OFF',
    color: '#EF4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    borderClass: 'border-red-300',
  },
  other: {
    label: '기타',
    shortLabel: '기타',
    color: '#6B7280',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-700',
    borderClass: 'border-gray-300',
  },
}

export const ADJUSTMENT_TYPES: AdjustmentType[] = [
  'budget_change',
  'creative_swap',
  'targeting_change',
  'campaign_on_off',
  'other',
]
