/**
 * AI 분석 API (Gemini)
 * POST /api/ai/analyze
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface AnalysisRequest {
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

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    const data: AnalysisRequest = await request.json()

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // 요일별 성과 분석
    const dailyByWeekday = analyzeDailyByWeekday(data.meta.daily)

    // 캠페인 성과 분석
    const campaignAnalysis = analyzeCampaigns(data.meta.campaigns)

    // 네이버 키워드 분석
    const keywordAnalysis = analyzeKeywords(data.naver.keywords)

    const metricLabel = data.metricType === 'video' ? '영상 조회수' : '리드'
    const metricValue = data.metricType === 'video' ? data.meta.videoViews : data.meta.leads

    // 일별 성과 분석
    const dailyAnalysis = analyzeDailyPerformance(data.meta.daily)

    const prompt = `당신은 디지털 광고 성과 분석 전문가입니다. 아래 데이터를 분석하여 마케팅 담당자에게 상세하고 실용적인 인사이트를 제공해주세요.

## 리포트 정보
- 고객사: ${data.clientName || '고객사'}
- 기간: ${data.period.start} ~ ${data.period.end}
- 타입: ${data.reportType === 'monthly' ? '월간' : '주간'} 리포트

## Meta 광고 성과
- 노출수: ${data.meta.impressions.toLocaleString()}회
- 클릭수: ${data.meta.clicks.toLocaleString()}회
- ${metricLabel}: ${(metricValue || 0).toLocaleString()}${data.metricType === 'video' ? '회' : '건'}
- 광고비: ${Math.round(data.meta.spend * 1500).toLocaleString()}원 (USD ${data.meta.spend.toFixed(2)})
- CTR: ${data.meta.ctr.toFixed(2)}%
- CPC: ${Math.round(data.meta.cpc).toLocaleString()}원
${data.metricType !== 'video' && data.meta.cpl > 0 ? `- CPL: ${Math.round(data.meta.cpl).toLocaleString()}원` : ''}
${data.meta.avgWatchTime ? `- 평균 시청시간: ${Math.round(data.meta.avgWatchTime)}초` : ''}

### 캠페인별 성과
${campaignAnalysis}

### 요일별 성과 패턴
${dailyByWeekday}

### 일별 성과 추이
${dailyAnalysis}

## 네이버 플레이스 광고 성과
- 노출수: ${data.naver.impressions.toLocaleString()}회
- 클릭수: ${data.naver.clicks.toLocaleString()}회
- 광고비: ${data.naver.spend.toLocaleString()}원
- CTR: ${data.naver.ctr.toFixed(2)}%
- 평균 CPC: ${Math.round(data.naver.avgCpc).toLocaleString()}원

### 키워드별 성과
${keywordAnalysis}

---

위 데이터를 **매우 상세하게** 분석하여 다음 JSON 형식으로 응답해주세요. 반드시 JSON만 출력하세요.

{
  "summary": "전체 성과에 대한 3-4문장 요약. 반드시 구체적인 수치(노출수, 클릭수, CTR, 광고비 등)를 포함하고, 업계 평균 대비 성과를 평가하세요.",
  "highlights": [
    "Meta 성과 분석: CTR ${data.meta.ctr.toFixed(2)}%는 업계 평균(0.9%) 대비 X% 높음/낮음. 구체적 수치와 의미 설명",
    "네이버 성과 분석: CTR, CPC, 키워드별 성과에 대한 구체적 분석",
    "비용 효율성: CPC ${Math.round(data.meta.cpc).toLocaleString()}원의 효율성 평가와 개선 방향",
    "요일별 패턴: 가장 성과 좋은/나쁜 요일과 그 차이 분석",
    "캠페인별 성과 차이와 최적화 포인트"
  ],
  "metaAnalysis": {
    "overallGrade": "A/B/C/D 중 선택",
    "ctrAnalysis": "CTR 상세 분석 (업계 평균 대비, 개선 방향)",
    "cpcAnalysis": "CPC 효율성 분석",
    "bestPerformance": "가장 성과 좋았던 부분",
    "worstPerformance": "개선이 필요한 부분"
  },
  "naverAnalysis": {
    "overallGrade": "A/B/C/D 중 선택",
    "keywordInsight": "핵심 키워드 성과 분석",
    "rankingAnalysis": "평균 순위 분석과 개선 방향",
    "costEfficiency": "비용 대비 효율 분석"
  },
  "weekdayInsight": "요일별 성과 차이에 대한 상세 분석 (평일 vs 주말, 최고/최저 성과 요일)",
  "recommendations": [
    {
      "platform": "meta",
      "priority": "high",
      "title": "즉시 실행 가능한 개선안",
      "description": "구체적인 실행 방법과 예상 효과",
      "expectedImpact": "예상되는 성과 개선 수치"
    },
    {
      "platform": "meta",
      "priority": "medium",
      "title": "중기 개선안",
      "description": "구체적인 실행 방법",
      "expectedImpact": "예상 효과"
    },
    {
      "platform": "naver",
      "priority": "high",
      "title": "네이버 핵심 개선안",
      "description": "구체적인 실행 방법과 예상 효과",
      "expectedImpact": "예상되는 성과 개선 수치"
    }
  ],
  "nextMonthStrategy": "다음 달 광고 운영 전략 제안 (2-3문장)"
}

분석 시 반드시 포함할 사항:
1. 모든 수치는 구체적으로 명시 (%, 원, 회 단위 포함)
2. 업계 평균 대비 비교 (Meta CTR 평균 0.9%, 네이버 플레이스 CTR 평균 2-3%)
3. 요일별/캠페인별 성과 차이의 원인 분석
4. 예산 재배분 제안 (고성과 영역 집중)
5. 실행 가능한 구체적 액션 아이템`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response')
    }

    const insights = JSON.parse(jsonMatch[0])
    insights.generatedAt = new Date().toISOString()

    return NextResponse.json({
      success: true,
      insights,
    })
  } catch (error) {
    console.error('AI analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI analysis failed' },
      { status: 500 }
    )
  }
}

function analyzeDailyByWeekday(daily: AnalysisRequest['meta']['daily']): string {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const byDay: Record<number, { impressions: number; clicks: number; spend: number; count: number }> = {}

  daily.forEach(d => {
    const dayIndex = new Date(d.date).getDay()
    if (!byDay[dayIndex]) {
      byDay[dayIndex] = { impressions: 0, clicks: 0, spend: 0, count: 0 }
    }
    byDay[dayIndex].impressions += d.impressions
    byDay[dayIndex].clicks += d.clicks
    byDay[dayIndex].spend += d.spend
    byDay[dayIndex].count += 1
  })

  return Object.entries(byDay)
    .map(([day, data]) => {
      const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0
      return `- ${weekdays[parseInt(day)]}요일: 노출 ${Math.round(data.impressions / data.count).toLocaleString()}, 클릭 ${Math.round(data.clicks / data.count)}, CTR ${ctr.toFixed(2)}%`
    })
    .join('\n')
}

function analyzeCampaigns(campaigns: AnalysisRequest['meta']['campaigns']): string {
  if (!campaigns || campaigns.length === 0) return '캠페인 데이터 없음'

  return campaigns
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5)
    .map(c => `- ${c.campaign_name}: 노출 ${c.impressions.toLocaleString()}, 클릭 ${c.clicks}, CTR ${c.ctr.toFixed(2)}%, 광고비 ${Math.round(c.spend * 1500).toLocaleString()}원`)
    .join('\n')
}

function analyzeKeywords(keywords: AnalysisRequest['naver']['keywords']): string {
  if (!keywords || keywords.length === 0) return '키워드 데이터 없음'

  return keywords
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5)
    .map(k => `- ${k.keyword}: 노출 ${k.impressions.toLocaleString()}, 클릭 ${k.clicks}, CTR ${k.ctr.toFixed(2)}%, 평균순위 ${k.avgRank.toFixed(1)}위`)
    .join('\n')
}

function analyzeDailyPerformance(daily: AnalysisRequest['meta']['daily']): string {
  if (!daily || daily.length === 0) return '일별 데이터 없음'

  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))

  // 최고/최저 성과일 찾기
  const byClicks = [...daily].sort((a, b) => b.clicks - a.clicks)
  const bestDay = byClicks[0]
  const worstDay = byClicks[byClicks.length - 1]

  // 평균 계산
  const avgImpressions = daily.reduce((sum, d) => sum + d.impressions, 0) / daily.length
  const avgClicks = daily.reduce((sum, d) => sum + d.clicks, 0) / daily.length

  return `- 데이터 기간: ${sorted[0]?.date} ~ ${sorted[sorted.length - 1]?.date} (${daily.length}일)
- 일 평균 노출: ${Math.round(avgImpressions).toLocaleString()}회
- 일 평균 클릭: ${Math.round(avgClicks)}회
- 최고 성과일: ${bestDay?.date} (클릭 ${bestDay?.clicks}회)
- 최저 성과일: ${worstDay?.date} (클릭 ${worstDay?.clicks}회)`
}
