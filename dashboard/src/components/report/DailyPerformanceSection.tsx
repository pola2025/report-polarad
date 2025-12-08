'use client'

import { Card } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'

interface DailyData {
  date: string
  impressions: number
  clicks: number
  leads: number
  spend: number
}

interface DailyPerformanceSectionProps {
  daily: DailyData[]
  usdToKrw?: number
}

// 요일 변환
function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return days[date.getDay()]
}

// 날짜 포맷 (MM/DD)
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate().toString().padStart(2, '0')}`
}

export function DailyPerformanceSection({ daily, usdToKrw = 1500 }: DailyPerformanceSectionProps) {
  if (daily.length === 0) return null

  // 일별 CTR 계산
  const dailyWithCtr = daily.map(d => ({
    ...d,
    ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
    spendKrw: d.spend * usdToKrw,
  }))

  // 최고/최저 성과 찾기
  const maxClicks = Math.max(...dailyWithCtr.map(d => d.clicks))
  const minClicks = Math.min(...dailyWithCtr.map(d => d.clicks))
  const avgCtr = dailyWithCtr.reduce((sum, d) => sum + d.ctr, 0) / dailyWithCtr.length

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
        <span>📅</span>
        <span>일별 성과 추이</span>
      </div>

      {/* 일별 카드 */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {dailyWithCtr.map((day) => {
          const isHighlight = day.clicks === maxClicks
          const isLow = day.clicks === minClicks && dailyWithCtr.length > 1

          let cardClass = 'rounded-lg p-3 text-center border transition-all'
          if (isHighlight) {
            cardClass += ' border-green-400 bg-gradient-to-b from-green-50 to-green-25'
          } else if (isLow) {
            cardClass += ' border-red-300 bg-gradient-to-b from-red-50 to-red-25'
          } else {
            cardClass += ' border-gray-200 bg-white'
          }

          return (
            <div key={day.date} className={cardClass}>
              <div className="text-xs text-gray-500 mb-1">{formatDate(day.date)}</div>
              <div className={`font-bold ${isHighlight ? 'text-green-600' : isLow ? 'text-red-600' : 'text-gray-700'}`}>
                {getDayOfWeek(day.date)}
                {isHighlight && ' ⭐'}
                {isLow && ' ⚠️'}
              </div>
              <div className="text-lg font-bold text-gray-900 mt-2">{formatNumber(day.clicks)}</div>
              <div className="text-xs text-gray-500">클릭</div>
              <div className={`text-sm font-medium mt-1 ${day.ctr >= avgCtr ? 'text-green-600' : 'text-amber-600'}`}>
                {day.ctr.toFixed(2)}%
              </div>
            </div>
          )
        })}
      </div>

      {/* 일별 데이터 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-2 px-3 text-left font-semibold text-gray-600">날짜</th>
              <th className="py-2 px-3 text-right font-semibold text-gray-600">노출</th>
              <th className="py-2 px-3 text-right font-semibold text-gray-600">클릭</th>
              <th className="py-2 px-3 text-right font-semibold text-gray-600">CTR</th>
              <th className="py-2 px-3 text-right font-semibold text-gray-600">지출</th>
            </tr>
          </thead>
          <tbody>
            {dailyWithCtr.map((day) => (
              <tr key={day.date} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 font-medium">
                  {formatDate(day.date)} ({getDayOfWeek(day.date)})
                </td>
                <td className="py-2 px-3 text-right">{formatNumber(day.impressions)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(day.clicks)}</td>
                <td className={`py-2 px-3 text-right ${day.ctr >= avgCtr ? 'text-green-600' : ''}`}>
                  {day.ctr.toFixed(2)}%
                </td>
                <td className="py-2 px-3 text-right">
                  {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(day.spendKrw)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold">
              <td className="py-2 px-3">합계</td>
              <td className="py-2 px-3 text-right">{formatNumber(dailyWithCtr.reduce((s, d) => s + d.impressions, 0))}</td>
              <td className="py-2 px-3 text-right">{formatNumber(dailyWithCtr.reduce((s, d) => s + d.clicks, 0))}</td>
              <td className="py-2 px-3 text-right">{avgCtr.toFixed(2)}%</td>
              <td className="py-2 px-3 text-right">
                {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(
                  dailyWithCtr.reduce((s, d) => s + d.spendKrw, 0)
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 인사이트 박스 */}
      <div className="rounded-lg p-4 mt-4 bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-blue-500">
        <p className="text-gray-700 text-sm">
          💡 <strong>인사이트:</strong>{' '}
          {dailyWithCtr.length > 0 && (
            <>
              {formatDate(dailyWithCtr.find(d => d.clicks === maxClicks)?.date || '')} ({getDayOfWeek(dailyWithCtr.find(d => d.clicks === maxClicks)?.date || '')})
              클릭 {maxClicks}건으로 주간 최고 성과.
              {minClicks !== maxClicks && (
                <> {formatDate(dailyWithCtr.find(d => d.clicks === minClicks)?.date || '')}은 평균 대비 낮은 성과로 예산 조정 검토 필요.</>
              )}
            </>
          )}
        </p>
      </div>
    </Card>
  )
}
