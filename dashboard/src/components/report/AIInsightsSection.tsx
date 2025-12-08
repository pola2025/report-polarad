'use client'

import { Card } from '@/components/ui/card'
import type { ReportAIInsights } from '@/types/report'

interface AIInsightsSectionProps {
  insights: ReportAIInsights | null
}

export function AIInsightsSection({ insights }: AIInsightsSectionProps) {
  if (!insights) {
    return (
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
          <span>🤖</span>
          <span>AI 분석 인사이트</span>
        </div>
        <div className="text-center py-8 text-gray-500">
          AI 분석이 아직 생성되지 않았습니다.
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
        <span>🤖</span>
        <span>AI 분석 인사이트</span>
        <span className="text-xs font-normal text-gray-400 ml-2">Powered by Gemini</span>
      </div>

      <div className="rounded-xl p-5 space-y-5 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
        {/* 요약 */}
        {insights.summary && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🔍</span>
              <span className="font-semibold text-gray-800">성과 분석</span>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed pl-7">
              {insights.summary}
            </p>
          </div>
        )}

        {/* 하이라이트 */}
        {insights.highlights && insights.highlights.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">✨</span>
              <span className="font-semibold text-gray-800">주요 포인트</span>
            </div>
            <div className="space-y-2 pl-7">
              {insights.highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-gray-400 mt-1">{index + 1}.</span>
                  <p className="text-gray-700 text-sm leading-relaxed">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 개선 제안 */}
        {insights.recommendations && insights.recommendations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💡</span>
              <span className="font-semibold text-gray-800">개선 제안</span>
            </div>
            <div className="space-y-3 pl-7">
              {insights.recommendations.map((rec, index) => (
                <div key={index} className="p-3 bg-white/60 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-purple-600 font-medium">
                      {rec.platform === 'meta' ? '🔵 Meta' : '🟢 네이버'}
                    </span>
                    <span className="font-medium text-gray-800">{rec.title}</span>
                  </div>
                  <div className="text-sm text-gray-600 ml-5">
                    {rec.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {insights.generatedAt && (
        <div className="mt-3 text-xs text-gray-400 text-right">
          분석 시간: {new Date(insights.generatedAt).toLocaleString('ko-KR')}
        </div>
      )}
    </Card>
  )
}
