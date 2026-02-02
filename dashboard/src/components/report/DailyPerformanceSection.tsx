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
  metricType?: 'video' | 'lead'
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

export function DailyPerformanceSection({ daily, usdToKrw = 1500, metricType = 'lead' }: DailyPerformanceSectionProps) {
  const showLeads = metricType !== 'video'
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

  // 총합 계산
  const totals = {
    impressions: dailyWithCtr.reduce((s, d) => s + d.impressions, 0),
    clicks: dailyWithCtr.reduce((s, d) => s + d.clicks, 0),
    spend: dailyWithCtr.reduce((s, d) => s + d.spendKrw, 0),
  }

  return (
    <Card className="p-4 md:p-6 mb-6">
      <div className="flex items-center gap-2 text-base md:text-lg font-bold text-gray-800 mb-4">
        <span>📅</span>
        <span>일별 성과 추이</span>
      </div>

      {/* 모바일: 4x2 요약 그리드 */}
      <div className="md:hidden mb-4">
        <div className="grid grid-cols-4 gap-1.5">
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">총 노출</p>
            <p className="text-xs font-bold text-gray-800">{formatNumber(totals.impressions)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">총 클릭</p>
            <p className="text-xs font-bold text-gray-800">{formatNumber(totals.clicks)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">평균 CTR</p>
            <p className="text-xs font-bold text-gray-800">{avgCtr.toFixed(2)}%</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">총 지출</p>
            <p className="text-[10px] font-bold text-gray-800 whitespace-nowrap">{new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(totals.spend)}원</p>
          </div>
        </div>
      </div>

      {/* 모바일: 일별 카드 리스트 */}
      <div className="md:hidden space-y-2 mb-4">
        {dailyWithCtr.map((day) => {
          const isHighlight = day.clicks === maxClicks
          const isLow = day.clicks === minClicks && dailyWithCtr.length > 1

          return (
            <div
              key={day.date}
              className={`rounded-lg p-3 border ${
                isHighlight
                  ? 'border-green-400 bg-green-50'
                  : isLow
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${isHighlight ? 'text-green-600' : isLow ? 'text-red-600' : 'text-gray-800'}`}>
                    {formatDate(day.date)} ({getDayOfWeek(day.date)})
                  </span>
                  {isHighlight && <span>⭐</span>}
                  {isLow && <span>⚠️</span>}
                </div>
                <span className="text-sm font-bold text-gray-800">
                  {new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(day.spendKrw)}원
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div className="bg-white rounded px-2 py-1.5">
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">노출</p>
                  <p className="text-xs font-semibold text-gray-700">{formatNumber(day.impressions)}</p>
                </div>
                <div className="bg-white rounded px-2 py-1.5">
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">클릭</p>
                  <p className="text-xs font-semibold text-gray-700">{formatNumber(day.clicks)}</p>
                </div>
                <div className="bg-white rounded px-2 py-1.5">
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">CTR</p>
                  <p className={`text-xs font-semibold ${day.ctr >= avgCtr ? 'text-green-600' : 'text-amber-600'}`}>{day.ctr.toFixed(2)}%</p>
                </div>
                {showLeads && (
                <div className="bg-white rounded px-2 py-1.5">
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">전환</p>
                  <p className="text-xs font-semibold text-gray-700">{formatNumber(day.leads)}</p>
                </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 데스크톱: 일별 카드 그리드 */}
      <div className="hidden md:grid grid-cols-7 gap-2 mb-6">
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

      {/* 데스크톱: 일별 데이터 테이블 */}
      <div className="hidden md:block overflow-x-auto">
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
              <td className="py-2 px-3 text-right">{formatNumber(totals.impressions)}</td>
              <td className="py-2 px-3 text-right">{formatNumber(totals.clicks)}</td>
              <td className="py-2 px-3 text-right">{avgCtr.toFixed(2)}%</td>
              <td className="py-2 px-3 text-right">
                {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(totals.spend)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 인사이트 박스 */}
      <div className="rounded-lg p-3 md:p-4 mt-4 bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-blue-500">
        <p className="text-gray-700 text-xs md:text-sm font-medium mb-1">💡 인사이트:</p>
        {dailyWithCtr.length > 0 && (
          <ul className="text-xs md:text-sm text-gray-600 space-y-1 pl-4 list-disc">
            <li>
              <span>최고 성과: <strong>{formatDate(dailyWithCtr.find(d => d.clicks === maxClicks)?.date || '')} ({getDayOfWeek(dailyWithCtr.find(d => d.clicks === maxClicks)?.date || '')})</strong></span>
              <span className="block text-[11px] text-gray-500 mt-0.5">클릭 {formatNumber(maxClicks)}건</span>
            </li>
            {minClicks !== maxClicks && (
              <li>
                <span>최저 성과: <strong>{formatDate(dailyWithCtr.find(d => d.clicks === minClicks)?.date || '')} ({getDayOfWeek(dailyWithCtr.find(d => d.clicks === minClicks)?.date || '')})</strong></span>
                <span className="block text-[11px] text-gray-500 mt-0.5">예산 조정 검토 필요</span>
              </li>
            )}
          </ul>
        )}
      </div>
    </Card>
  )
}
