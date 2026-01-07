'use client'

/**
 * 상관관계 카드 컴포넌트
 * 마케팅 지표 간 상관관계 표시
 */

import type { CorrelationData } from '@/types/ga4-analytics'

interface CorrelationCardProps {
  correlation: CorrelationData
}

function getCorrelationLabel(value: number): {
  label: string
  color: string
  description: string
} {
  const absValue = Math.abs(value)

  if (absValue >= 0.8) {
    return {
      label: '매우 강함',
      color: value > 0 ? 'text-green-600' : 'text-red-600',
      description: value > 0 ? '강한 양의 상관' : '강한 음의 상관',
    }
  }
  if (absValue >= 0.6) {
    return {
      label: '강함',
      color: value > 0 ? 'text-green-500' : 'text-red-500',
      description: value > 0 ? '양의 상관' : '음의 상관',
    }
  }
  if (absValue >= 0.4) {
    return {
      label: '보통',
      color: 'text-yellow-600',
      description: '중간 정도의 상관',
    }
  }
  if (absValue >= 0.2) {
    return {
      label: '약함',
      color: 'text-gray-500',
      description: '약한 상관',
    }
  }
  return {
    label: '없음',
    color: 'text-gray-400',
    description: '상관관계 없음',
  }
}

function CorrelationItem({
  label,
  value,
  description,
}: {
  label: string
  value: number
  description: string
}) {
  const { label: strengthLabel, color, description: strengthDesc } = getCorrelationLabel(value)

  // 상관계수 바 시각화
  const barWidth = Math.abs(value) * 100
  const barColor = value > 0 ? 'bg-green-500' : 'bg-red-500'

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${color}`}>
            {value > 0 ? '+' : ''}{value.toFixed(2)}
          </p>
          <p className={`text-xs ${color}`}>{strengthLabel}</p>
        </div>
      </div>

      {/* 상관계수 바 */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{strengthDesc}</p>
    </div>
  )
}

export function CorrelationCard({ correlation }: CorrelationCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        상관관계 분석
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        마케팅 지표 간의 관계를 분석합니다. 1에 가까울수록 강한 양의 상관, -1에 가까울수록 강한 음의 상관을 나타냅니다.
      </p>

      <div className="space-y-4">
        <CorrelationItem
          label="세션 → 접수"
          value={correlation.sessionsVsSubmissions}
          description="방문 세션이 증가하면 접수도 증가하는가?"
        />
        <CorrelationItem
          label="접수 → 리드"
          value={correlation.submissionsVsLeads}
          description="홈페이지 접수가 증가하면 광고 리드도 증가하는가?"
        />
        <CorrelationItem
          label="광고비 → 리드"
          value={correlation.spendVsLeads}
          description="광고비 지출이 증가하면 리드가 증가하는가?"
        />
      </div>

      {/* 해석 가이드 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">해석 가이드</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• <strong>0.8 이상</strong>: 매우 강한 상관 - 직접적인 인과관계 가능성</li>
          <li>• <strong>0.6~0.8</strong>: 강한 상관 - 유의미한 관계</li>
          <li>• <strong>0.4~0.6</strong>: 중간 상관 - 부분적 관계</li>
          <li>• <strong>0.4 미만</strong>: 약함/없음 - 다른 요인 탐색 필요</li>
        </ul>
      </div>
    </div>
  )
}
