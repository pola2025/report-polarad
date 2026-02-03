/**
 * BAS 전용 API 함수
 * polarad-meta의 /api/meta/analytics 호출 후 BasDashboardData로 변환
 */

import type {
  MetaPeriodDataResponse,
  MetaKPISummary,
  MetaDailyData,
  MetaAdData,
} from '@/types/meta-analytics'
import type { BasDashboardData } from '@/types/bas-analytics'
import type { AdAdjustment } from '@/types/ad-adjustments'
import { ADJUSTMENT_TYPE_CONFIG } from '@/types/ad-adjustments'

/**
 * BAS 대시보드 전체 데이터를 로드
 */
export async function fetchBasDashboardData(
  clientSlug: string,
  startDate: string,
  endDate: string,
  compareMode: 'none' | 'weekly' | 'monthly' = 'none'
): Promise<BasDashboardData> {
  // 1. 현재 기간 데이터 fetch
  const params = new URLSearchParams({ clientSlug, startDate, endDate })
  const res = await fetch(`/api/meta/analytics?${params}`)
  if (!res.ok) throw new Error('Failed to fetch BAS data')
  const data: MetaPeriodDataResponse = await res.json()

  // 2. 스파크라인 데이터 계산 (최근 14일)
  const recentDaily = data.daily.slice(-14)
  const sparklineData = {
    leads: recentDaily.map((d) => d.leads),
    spend: recentDaily.map((d) => d.spend),
    cpl: recentDaily.map((d) => d.cpl),
    ctr: recentDaily.map((d) => d.ctr),
  }

  // 3. 비교 기간 데이터 (선택적)
  let comparisonSummary: MetaKPISummary | null = null
  let comparisonPeriod: BasDashboardData['comparisonPeriod'] = null

  if (compareMode !== 'none') {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffMs = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const daysToSubtract = compareMode === 'weekly' ? 7 : diffDays

    const compStart = new Date(start)
    compStart.setDate(compStart.getDate() - daysToSubtract)
    const compEnd = new Date(end)
    compEnd.setDate(compEnd.getDate() - daysToSubtract)

    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    const compParams = new URLSearchParams({
      clientSlug,
      startDate: formatDate(compStart),
      endDate: formatDate(compEnd),
    })

    try {
      const compRes = await fetch(`/api/meta/analytics?${compParams}`)
      if (compRes.ok) {
        const compData: MetaPeriodDataResponse = await compRes.json()
        comparisonSummary = compData.summary
        comparisonPeriod = {
          current: `${startDate} ~ ${endDate}`,
          previous: `${formatDate(compStart)} ~ ${formatDate(compEnd)}`,
        }
      }
    } catch {
      // 비교 데이터 실패 시 무시
    }
  }

  return {
    summary: data.summary,
    daily: data.daily,
    weekly: data.weekly,
    monthly: data.monthly,
    ads: data.ads,
    sparklineData,
    comparisonSummary,
    comparisonPeriod,
  }
}

/**
 * KPI 변화율 계산
 */
export function calculateTrend(
  current: number,
  previous: number | undefined
): { value: number; isPositive: boolean } | undefined {
  if (!previous || previous === 0) return undefined
  const change = ((current - previous) / previous) * 100
  return {
    value: change,
    isPositive: change >= 0,
  }
}

/**
 * 경영 요약 텍스트 생성
 */
export function generateExecutiveSummary(
  summary: MetaKPISummary,
  daily: MetaDailyData[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ads: MetaAdData[]
): {
  highlights: { emoji: string; title: string; content: string }
  warnings: { emoji: string; title: string; content: string }
  actions: { emoji: string; title: string; content: string }
  summaryText?: string
} {
  const highlights = {
    emoji: '\u2728',
    title: '\ud575\uc2ec \uc131\uacfc',
    content:
      daily.length > 0
        ? `${daily.reduce((max, d) => (d.leads > max.leads ? d : max), daily[0])?.date?.slice(5) || '-'} \ucd5c\uace0 ${Math.max(...daily.map((d) => d.leads))}\uac74 \ub2ec\uc131`
        : '\ub370\uc774\ud130 \uc5c6\uc74c',
  }

  const warnings = {
    emoji: '\u26a0\ufe0f',
    title: '\uc8fc\uc758 \ud544\uc694',
    content:
      summary.avg_cpl > 0
        ? summary.avg_cpl > 30
          ? `\ub9ac\ub4dc\ub2f9 $${Math.round(summary.avg_cpl).toLocaleString()} \ub192\uc74c`
          : daily.length > 0 &&
              Math.min(...daily.filter((d) => d.leads > 0).map((d) => d.leads)) < 3
            ? '\uc77c\ubd80 \uc77c\uc790 \ub9ac\ub4dc \uc800\uc870'
            : '\ud2b9\uc774\uc0ac\ud56d \uc5c6\uc74c'
        : '\ub370\uc774\ud130 \uc5c6\uc74c',
  }

  const actions = {
    emoji: '\ud83d\udca1',
    title: '\uad8c\uc7a5 \uc561\uc158',
    content:
      summary.avg_cpl > 30
        ? '\ud0c0\uac9f\ud305 \ucd5c\uc801\ud654 \uac80\ud1a0'
        : summary.total_leads < 10
          ? '\uc608\uc0b0 \uc99d\uc561 \uac80\ud1a0'
          : '\ud604 \uc804\ub7b5 \uc720\uc9c0',
  }

  const summaryText =
    summary.total_leads > 0
      ? `이번 기간 총 광고비 $${summary.total_spend.toLocaleString()}으로 리드 ${summary.total_leads}건을 확보했습니다. 평균 리드당 가격은 $${Math.round(summary.avg_cpl).toLocaleString()}입니다.`
      : undefined

  return { highlights, warnings, actions, summaryText }
}

/**
 * AI 인사이트 항목 생성
 */
export function generateAIInsightItems(
  summary: MetaKPISummary,
  daily: MetaDailyData[],
  ads: MetaAdData[],
  adjustments: AdAdjustment[] = []
): {
  summaryItems: Array<{ icon: string; text: string; type: 'success' | 'warning' | 'info' }>
  actionItems: Array<{ title: string; description: string }>
} {
  const summaryItems: Array<{ icon: string; text: string; type: 'success' | 'warning' | 'info' }> = [
    {
      icon: '\u2713',
      text:
        summary.avg_cpl < 25
          ? `리드당 가격 $${Math.round(summary.avg_cpl).toLocaleString()}으로 효율적 운영 중`
          : `리드당 가격 $${Math.round(summary.avg_cpl).toLocaleString()} - 최적화 검토 필요`,
      type: summary.avg_cpl < 25 ? 'success' : 'warning',
    },
    {
      icon: '\u2713',
      text: `총 ${summary.total_leads}건 리드 확보`,
      type: 'success',
    },
    {
      icon: '!',
      text:
        daily.length > 0 &&
        Math.max(...daily.map((d) => d.leads)) >
          Math.min(...daily.filter((d) => d.leads > 0).map((d) => d.leads)) * 2
          ? '일별 성과 편차 큼 - 일정한 운영 필요'
          : '일별 성과 안정적 유지 중',
      type:
        daily.length > 0 &&
        Math.max(...daily.map((d) => d.leads)) >
          Math.min(...daily.filter((d) => d.leads > 0).map((d) => d.leads)) * 2
          ? 'warning'
          : 'success',
    },
  ]

  // 광고조정일 전후 데이터 변화 분석
  if (adjustments.length > 0 && daily.length >= 4) {
    const sortedDaily = [...daily].sort((a, b) => a.date.localeCompare(b.date))

    for (const adj of adjustments) {
      const adjDate = adj.date
      const cfg = ADJUSTMENT_TYPE_CONFIG[adj.type]
      const beforeDays = sortedDaily.filter((d) => d.date < adjDate).slice(-3)
      const afterDays = sortedDaily.filter((d) => d.date > adjDate).slice(0, 3)

      if (beforeDays.length < 2 || afterDays.length < 2) continue

      const avgBefore = {
        leads: beforeDays.reduce((s, d) => s + d.leads, 0) / beforeDays.length,
        spend: beforeDays.reduce((s, d) => s + d.spend, 0) / beforeDays.length,
        cpl: 0,
      }
      avgBefore.cpl = avgBefore.leads > 0 ? avgBefore.spend / avgBefore.leads : 0

      const avgAfter = {
        leads: afterDays.reduce((s, d) => s + d.leads, 0) / afterDays.length,
        spend: afterDays.reduce((s, d) => s + d.spend, 0) / afterDays.length,
        cpl: 0,
      }
      avgAfter.cpl = avgAfter.leads > 0 ? avgAfter.spend / avgAfter.leads : 0

      const dateShort = adjDate.slice(5) // MM-DD
      const parts: string[] = []

      // 리드 변화
      if (avgBefore.leads > 0) {
        const leadChange = ((avgAfter.leads - avgBefore.leads) / avgBefore.leads) * 100
        if (Math.abs(leadChange) >= 15) {
          parts.push(`리드 ${leadChange > 0 ? '+' : ''}${Math.round(leadChange)}%`)
        }
      } else if (avgAfter.leads > 0) {
        parts.push(`리드 ${avgAfter.leads.toFixed(1)}건/일 발생`)
      }

      // CPL 변화
      if (avgBefore.cpl > 0 && avgAfter.cpl > 0) {
        const cplChange = ((avgAfter.cpl - avgBefore.cpl) / avgBefore.cpl) * 100
        if (Math.abs(cplChange) >= 10) {
          parts.push(`CPL ${cplChange > 0 ? '+' : ''}${Math.round(cplChange)}%`)
        }
      }

      // 지출 변화
      if (avgBefore.spend > 0) {
        const spendChange = ((avgAfter.spend - avgBefore.spend) / avgBefore.spend) * 100
        if (Math.abs(spendChange) >= 20) {
          parts.push(`지출 ${spendChange > 0 ? '+' : ''}${Math.round(spendChange)}%`)
        }
      }

      if (parts.length > 0) {
        const changeText = parts.join(', ')
        // 리드 증가 or CPL 감소 = 긍정적
        const leadUp = avgAfter.leads > avgBefore.leads
        const cplDown = avgAfter.cpl < avgBefore.cpl && avgAfter.cpl > 0
        const isPositive = leadUp || cplDown

        summaryItems.push({
          icon: isPositive ? '\u2191' : '\u2193',
          text: `${dateShort} ${cfg.label} 이후: ${changeText}`,
          type: isPositive ? 'success' : 'warning',
        })
      } else {
        summaryItems.push({
          icon: '\u2192',
          text: `${dateShort} ${cfg.label} 이후: 유의미한 변화 미감지 (안정 유지)`,
          type: 'info',
        })
      }
    }
  }

  const topAd = ads.length > 0 ? ads.reduce((top, ad) => (ad.leads > top.leads ? ad : top), ads[0]) : null

  const actionItems = [
    {
      title: summary.avg_cpl > 30 ? '타겟팅 재검토' : '현 전략 유지',
      description: summary.avg_cpl > 30 ? '예상 리드당 가격 개선: 10~15%' : '안정적 성과 지속',
    },
    {
      title:
        topAd && topAd.leads > summary.total_leads * 0.3
          ? '주력 광고 예산 증액'
          : '신규 소재 테스트',
      description:
        topAd && topAd.leads > summary.total_leads * 0.3
          ? '예상 추가 리드: +20%'
          : '다양한 메시지 실험',
    },
  ]

  return { summaryItems, actionItems }
}
