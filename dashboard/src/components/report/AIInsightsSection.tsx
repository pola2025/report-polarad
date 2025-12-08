'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Sparkles, TrendingUp, TrendingDown, Calendar, Target, BarChart3 } from 'lucide-react'
import type { ReportAIInsights } from '@/types/report'

interface AIInsightsSectionProps {
  insights: ReportAIInsights | null
  isAdmin?: boolean  // 관리자만 재분석 가능
  // 실시간 분석용 데이터
  analysisData?: {
    reportType: 'monthly' | 'weekly'
    period: {
      start: string
      end: string
      year: number
      month?: number
      week?: number
    }
    meta: {
      impressions: number
      clicks: number
      leads: number
      spend: number
      ctr: number
      cpc: number
      cpl: number
      videoViews?: number
      avgWatchTime?: number
      campaigns: Array<{
        campaign_name: string
        impressions: number
        clicks: number
        leads: number
        spend: number
        ctr: number
      }>
      daily: Array<{
        date: string
        impressions: number
        clicks: number
        leads: number
        spend: number
      }>
    }
    naver: {
      impressions: number
      clicks: number
      spend: number
      ctr: number
      avgCpc: number
      keywords: Array<{
        keyword: string
        impressions: number
        clicks: number
        totalCost: number
        ctr: number
        avgCpc: number
        avgRank: number
      }>
    }
    clientName?: string
    metricType?: 'lead' | 'video'
  }
}

// 그레이드 뱃지 컴포넌트
function GradeBadge({ grade }: { grade: 'A' | 'B' | 'C' | 'D' }) {
  const colors = {
    A: 'bg-green-500 text-white',
    B: 'bg-blue-500 text-white',
    C: 'bg-yellow-500 text-white',
    D: 'bg-red-500 text-white',
  }
  const labels = {
    A: '우수',
    B: '양호',
    C: '보통',
    D: '개선필요',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${colors[grade]}`}>
      {grade} <span className="font-normal hidden sm:inline">({labels[grade]})</span>
    </span>
  )
}

// 우선순위 뱃지 컴포넌트
function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  const labels = {
    high: '긴급',
    medium: '중요',
    low: '참고',
  }
  return (
    <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium border ${colors[priority]}`}>
      {labels[priority]}
    </span>
  )
}

export function AIInsightsSection({ insights: initialInsights, analysisData, isAdmin = false }: AIInsightsSectionProps) {
  const [insights, setInsights] = useState<ReportAIInsights | null>(initialInsights)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 초기 로드 시 AI 분석 실행 (관리자만, DB에 저장된 인사이트가 없고 데이터가 있는 경우)
  useEffect(() => {
    if (isAdmin && !initialInsights && analysisData && !isLoading) {
      generateInsights()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generateInsights = async () => {
    if (!analysisData) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'AI 분석 실패')
      }

      const result = await response.json()
      setInsights(result.insights)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 분석 중 오류 발생')
    } finally {
      setIsLoading(false)
    }
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <span>AI 분석 인사이트</span>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
          <p className="text-sm">Gemini AI가 데이터를 분석하고 있습니다...</p>
          <p className="text-xs text-gray-400 mt-1">약 5-10초 소요</p>
        </div>
      </Card>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <span>AI 분석 인사이트</span>
        </div>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          {isAdmin && analysisData && (
            <Button
              onClick={generateInsights}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              다시 시도
            </Button>
          )}
        </div>
      </Card>
    )
  }

  // 인사이트 없음
  if (!insights) {
    return (
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <span>AI 분석 인사이트</span>
        </div>
        <div className="text-center py-8 text-gray-500">
          {isAdmin && analysisData ? (
            <div>
              <p className="mb-4">AI 분석을 실행하여 인사이트를 생성하세요.</p>
              <Button
                onClick={generateInsights}
                className="gap-2 bg-purple-500 hover:bg-purple-600"
              >
                <Sparkles className="w-4 h-4" />
                AI 분석 시작
              </Button>
            </div>
          ) : (
            <p>AI 분석이 아직 생성되지 않았습니다.</p>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 sm:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg font-bold text-gray-800">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
          <span>AI 분석 인사이트</span>
          <span className="text-[10px] sm:text-xs font-normal text-gray-400 ml-1 sm:ml-2 hidden sm:inline">Powered by Gemini</span>
        </div>
        {isAdmin && analysisData && (
          <Button
            onClick={generateInsights}
            variant="ghost"
            size="sm"
            className="gap-1 text-gray-500 hover:text-purple-600 text-xs sm:text-sm px-2 sm:px-3"
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">재분석</span>
          </Button>
        )}
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* 요약 */}
        {insights.summary && (
          <div className="rounded-xl p-3 sm:p-5 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <span className="text-base sm:text-lg">🔍</span>
              <span className="font-semibold text-gray-800 text-sm sm:text-base">성과 분석 요약</span>
            </div>
            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed pl-5 sm:pl-7">
              {insights.summary}
            </p>
          </div>
        )}

        {/* Meta & 네이버 분석 카드 */}
        {(insights.metaAnalysis || insights.naverAnalysis) && (
          <div className="grid grid-cols-1 gap-4">
            {/* Meta 분석 */}
            {insights.metaAnalysis && (
              <div className="rounded-xl p-3 sm:p-4 bg-blue-50 border border-blue-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-base sm:text-lg">🔵</span>
                    <span className="font-semibold text-gray-800 text-sm sm:text-base">Meta 광고</span>
                  </div>
                  <GradeBadge grade={insights.metaAnalysis.overallGrade} />
                </div>
                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                  <div>
                    <div className="flex items-center gap-1 text-blue-700 font-medium mb-1">
                      <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      CTR 분석
                    </div>
                    <p className="text-gray-600 pl-4 sm:pl-5">{insights.metaAnalysis.ctrAnalysis}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-blue-700 font-medium mb-1">
                      <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      CPC 분석
                    </div>
                    <p className="text-gray-600 pl-4 sm:pl-5">{insights.metaAnalysis.cpcAnalysis}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-100">
                    <div className="p-1.5 sm:p-2 bg-green-50 rounded">
                      <div className="text-[10px] sm:text-xs text-green-600 font-medium mb-1">Best</div>
                      <p className="text-[10px] sm:text-xs text-gray-600">{insights.metaAnalysis.bestPerformance}</p>
                    </div>
                    <div className="p-1.5 sm:p-2 bg-red-50 rounded">
                      <div className="text-[10px] sm:text-xs text-red-600 font-medium mb-1">개선필요</div>
                      <p className="text-[10px] sm:text-xs text-gray-600">{insights.metaAnalysis.worstPerformance}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 네이버 분석 */}
            {insights.naverAnalysis && (
              <div className="rounded-xl p-3 sm:p-4 bg-green-50 border border-green-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-base sm:text-lg">🟢</span>
                    <span className="font-semibold text-gray-800 text-sm sm:text-base">네이버 플레이스</span>
                  </div>
                  <GradeBadge grade={insights.naverAnalysis.overallGrade} />
                </div>
                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                  <div>
                    <div className="flex items-center gap-1 text-green-700 font-medium mb-1">
                      <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      키워드 인사이트
                    </div>
                    <p className="text-gray-600 pl-4 sm:pl-5">{insights.naverAnalysis.keywordInsight}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-green-700 font-medium mb-1">
                      <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      순위 분석
                    </div>
                    <p className="text-gray-600 pl-4 sm:pl-5">{insights.naverAnalysis.rankingAnalysis}</p>
                  </div>
                  <div className="pt-2 border-t border-green-100">
                    <div className="p-1.5 sm:p-2 bg-white/60 rounded">
                      <div className="text-[10px] sm:text-xs text-green-600 font-medium mb-1">비용 효율</div>
                      <p className="text-[10px] sm:text-xs text-gray-600">{insights.naverAnalysis.costEfficiency}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 전주 대비 비교 (주간 리포트용) */}
        {insights.weeklyComparison && (
          <div className="rounded-xl p-3 sm:p-4 bg-cyan-50 border border-cyan-100">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-3">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" />
              <span className="font-semibold text-gray-800 text-sm sm:text-base">전주 대비 성과</span>
            </div>
            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed pl-5 sm:pl-7 mb-3">
              {insights.weeklyComparison.summary}
            </p>
            {insights.weeklyComparison.changes && insights.weeklyComparison.changes.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pl-5 sm:pl-7">
                {insights.weeklyComparison.changes.map((change, index) => (
                  <div key={index} className="p-1.5 sm:p-2 bg-white/70 rounded-lg text-center">
                    <div className="text-[10px] sm:text-xs text-gray-500 mb-1">{change.metric}</div>
                    <div className={`flex items-center justify-center gap-0.5 sm:gap-1 text-sm sm:text-base font-semibold ${
                      change.direction === 'up' ? 'text-green-600' :
                      change.direction === 'down' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {change.direction === 'up' ? <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> :
                       change.direction === 'down' ? <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : null}
                      {change.change > 0 ? '+' : ''}{change.change.toFixed(1)}%
                    </div>
                    {change.note && (
                      <div className="text-[10px] sm:text-xs text-gray-400 mt-1 line-clamp-1">{change.note}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 요일별 특이사항 (주간 리포트용) */}
        {insights.dailyInsights && insights.dailyInsights.length > 0 && (
          <div className="rounded-xl p-3 sm:p-4 bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
              <span className="font-semibold text-gray-800 text-sm sm:text-base">요일별 특이사항</span>
            </div>
            <div className="space-y-2 pl-5 sm:pl-7">
              {insights.dailyInsights.map((insight, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-2 text-xs sm:text-sm">
                  <span className="font-medium text-amber-700 sm:min-w-[100px]">{insight.day}</span>
                  <span className="text-gray-700">{insight.note}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 요일별 인사이트 (기존 월간용) */}
        {insights.weekdayInsight && (
          <div className="rounded-xl p-3 sm:p-4 bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
              <span className="font-semibold text-gray-800 text-sm sm:text-base">요일별 성과 패턴</span>
            </div>
            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed pl-5 sm:pl-7">
              {insights.weekdayInsight}
            </p>
          </div>
        )}

        {/* 하이라이트 */}
        {insights.highlights && insights.highlights.length > 0 && (
          <div className="rounded-xl p-3 sm:p-5 bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-3">
              <span className="text-base sm:text-lg">✨</span>
              <span className="font-semibold text-gray-800 text-sm sm:text-base">주요 포인트</span>
            </div>
            <div className="space-y-2 pl-5 sm:pl-7">
              {insights.highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-1.5 sm:gap-2">
                  <span className="text-purple-500 mt-0.5 font-bold text-xs sm:text-sm">{index + 1}.</span>
                  <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 개선 제안 */}
        {insights.recommendations && insights.recommendations.length > 0 && (
          <div className="rounded-xl p-3 sm:p-5 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              <span className="text-base sm:text-lg">💡</span>
              <span className="font-semibold text-gray-800 text-sm sm:text-base">개선 제안</span>
            </div>
            <div className="space-y-2 sm:space-y-3 pl-0 sm:pl-7">
              {insights.recommendations.map((rec, index) => (
                <div key={index} className="p-2 sm:p-3 bg-white/80 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-1 sm:gap-2 mb-2 flex-wrap">
                    <span className={`text-xs sm:text-sm font-medium ${
                      rec.platform === 'meta' ? 'text-blue-600' : 'text-green-600'
                    }`}>
                      {rec.platform === 'meta' ? '🔵 Meta' : '🟢 네이버'}
                    </span>
                    {rec.priority && <PriorityBadge priority={rec.priority} />}
                    <span className="font-medium text-gray-800 text-xs sm:text-sm">{rec.title}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-2">{rec.description}</p>
                  {rec.expectedImpact && (
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-purple-600 bg-purple-50 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 w-fit">
                      <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      예상 효과: {rec.expectedImpact}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 다음 달 전략 */}
        {insights.nextMonthStrategy && (
          <div className="rounded-xl p-3 sm:p-4 bg-indigo-50 border border-indigo-100">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-3">
              <Target className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              <span className="font-semibold text-gray-800 text-sm sm:text-base">다음 달 전략 제안</span>
            </div>
            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed pl-5 sm:pl-7">
              {insights.nextMonthStrategy}
            </p>
          </div>
        )}
      </div>

      {insights.generatedAt && (
        <div className="mt-4 text-xs text-gray-400 text-right">
          분석 시간: {new Date(insights.generatedAt).toLocaleString('ko-KR')}
        </div>
      )}
    </Card>
  )
}
