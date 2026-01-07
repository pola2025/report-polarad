'use client'

/**
 * 마케팅 퍼널 분석 섹션
 * GA4 + Meta 통합 퍼널 분석 UI
 */

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { FunnelChart } from './FunnelChart'
import { CorrelationCard } from './CorrelationCard'
import { ChannelTable } from './ChannelTable'
import type { FunnelAnalysisResponse } from '@/types/ga4-analytics'

interface FunnelSectionProps {
  clientSlug: string
  startDate: string
  endDate: string
}

// 전환율 KPI 카드
function ConversionRateCard({
  label,
  value,
  description,
}: {
  label: string
  value: number
  description: string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-purple-600">{value}%</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  )
}

export function FunnelSection({ clientSlug, startDate, endDate }: FunnelSectionProps) {
  const [data, setData] = useState<FunnelAnalysisResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'funnel' | 'trend' | 'channel' | 'correlation'>('funnel')

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          clientSlug,
          startDate,
          endDate,
        })

        const response = await fetch(`/api/funnel/analysis?${params}`)
        const result: FunnelAnalysisResponse = await response.json()

        if (!result.success) {
          throw new Error(result.error || '퍼널 데이터 조회 실패')
        }

        setData(result.data || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
      } finally {
        setLoading(false)
      }
    }

    if (clientSlug === 'naratton') {
      fetchData()
    } else {
      setLoading(false)
      setError('퍼널 분석은 현재 나라똔만 지원됩니다')
    }
  }, [clientSlug, startDate, endDate])

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="text-center py-8">
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-sm text-gray-500">
            퍼널 분석 데이터를 불러올 수 없습니다
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="text-center py-8 text-gray-500">
          퍼널 데이터가 없습니다
        </div>
      </div>
    )
  }

  const { funnel, trend, correlation, byChannel } = data

  return (
    <div className="space-y-6">
      {/* 전환율 KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ConversionRateCard
          label="방문 → 접수"
          value={funnel.conversionRates.visitToSubmit}
          description="세션 대비 홈페이지 접수 비율"
        />
        <ConversionRateCard
          label="접수 → 리드"
          value={funnel.conversionRates.submitToLead}
          description="홈페이지 접수 대비 광고 리드 비율"
        />
        <ConversionRateCard
          label="전체 전환율"
          value={funnel.conversionRates.overallConversion}
          description="유입 사용자 대비 최종 리드 비율"
        />
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'funnel', label: '퍼널 분석' },
              { id: 'trend', label: '추이 분석' },
              { id: 'channel', label: '채널별 분석' },
              { id: 'correlation', label: '상관관계' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* 퍼널 분석 탭 */}
          {activeTab === 'funnel' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                마케팅 퍼널
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                유입부터 최종 리드까지의 전환 흐름을 시각화합니다
              </p>
              <FunnelChart stages={funnel.stages} height={320} />
            </div>
          )}

          {/* 추이 분석 탭 */}
          {activeTab === 'trend' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                일별 추이
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                기간 내 퍼널 단계별 일별 변화를 확인합니다
              </p>

              {trend.daily.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  추이 데이터가 없습니다
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trend.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      fontSize={12}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                      }}
                      formatter={(value: number) => value.toLocaleString()}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="sessions"
                      name="세션"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="submissions"
                      name="접수"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="leads"
                      name="리드"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* 채널별 분석 탭 */}
          {activeTab === 'channel' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                채널별 성과
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                유입 채널별 퍼널 성과를 비교합니다
              </p>
              <ChannelTable channels={byChannel} />
            </div>
          )}

          {/* 상관관계 탭 */}
          {activeTab === 'correlation' && (
            <CorrelationCard correlation={correlation} />
          )}
        </div>
      </div>

      {/* 데이터 부족 안내 (접수 데이터가 0인 경우) */}
      {funnel.stages.find(s => s.metric === 'submissions')?.value === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">
            홈페이지 접수 데이터 수집 중
          </h4>
          <p className="text-sm text-yellow-700">
            GA4 폼 제출 이벤트가 최근에 설정되었습니다.
            이벤트 데이터가 쌓이면 퍼널 분석이 더 정확해집니다.
            (최소 7일 이상의 데이터 권장)
          </p>
        </div>
      )}
    </div>
  )
}
