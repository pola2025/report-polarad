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

interface WeekdayHeatmapProps {
  daily: DailyData[]
  usdToKrw?: number
}

// 요일 인덱스 (0=일요일 ~ 6=토요일)
function getDayIndex(dateStr: string): number {
  return new Date(dateStr).getDay()
}

// 히트 레벨 계산 (0~3)
function getHeatLevel(value: number, max: number, min: number): number {
  if (max === min) return 2
  const range = max - min
  const ratio = (value - min) / range
  if (ratio >= 0.75) return 3 // high
  if (ratio >= 0.5) return 2 // medium-high
  if (ratio >= 0.25) return 1 // medium-low
  return 0 // low
}

// 히트 클래스 (낮음=회색, 적절=녹색, 높음=빨강)
function getHeatClass(level: number): string {
  const classes = [
    'bg-gray-100 text-gray-500',   // low - 회색
    'bg-green-100 text-green-700', // medium-low - 연한 녹색
    'bg-green-400 text-white',     // medium-high - 녹색
    'bg-red-400 text-white',       // high - 빨간색
  ]
  return classes[level] || classes[0]
}

export function WeekdayHeatmap({ daily, usdToKrw = 1500 }: WeekdayHeatmapProps) {
  if (daily.length === 0) return null

  const weekDays = [
    { name: '월', type: 'weekday' },
    { name: '화', type: 'weekday' },
    { name: '수', type: 'weekday' },
    { name: '목', type: 'weekday' },
    { name: '금', type: 'weekday' },
    { name: '토', type: 'weekend' },
    { name: '일', type: 'weekend' },
  ]
  const weekDayIndexMap = [1, 2, 3, 4, 5, 6, 0] // 월~일 순서로 표시

  // 요일별 데이터 집계
  const weekdayData = weekDayIndexMap.map((dayIndex) => {
    const dayData = daily.filter(d => getDayIndex(d.date) === dayIndex)
    if (dayData.length === 0) {
      return { impressions: 0, clicks: 0, ctr: 0, spend: 0 }
    }
    const impressions = dayData.reduce((sum, d) => sum + d.impressions, 0)
    const clicks = dayData.reduce((sum, d) => sum + d.clicks, 0)
    const spend = dayData.reduce((sum, d) => sum + d.spend, 0)
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    return { impressions, clicks, ctr, spend: spend * usdToKrw }
  })

  // min/max 계산
  const impressionValues = weekdayData.map(d => d.impressions)
  const clickValues = weekdayData.map(d => d.clicks)
  const ctrValues = weekdayData.map(d => d.ctr)

  const impressionMax = Math.max(...impressionValues)
  const impressionMin = Math.min(...impressionValues)
  const clickMax = Math.max(...clickValues)
  const clickMin = Math.min(...clickValues)
  const ctrMax = Math.max(...ctrValues)
  const ctrMin = Math.min(...ctrValues)

  // 최고/최저 성과 요일 찾기
  const bestCtrIndex = ctrValues.indexOf(ctrMax)
  const worstCtrIndex = ctrValues.indexOf(ctrMin)
  const avgCtr = ctrValues.reduce((sum, v) => sum + v, 0) / ctrValues.length

  // 평일 vs 주말 비교
  const weekdayAvg = {
    impressions: weekdayData.slice(0, 5).reduce((sum, d) => sum + d.impressions, 0) / 5,
    clicks: weekdayData.slice(0, 5).reduce((sum, d) => sum + d.clicks, 0) / 5,
    ctr: weekdayData.slice(0, 5).reduce((sum, d) => sum + d.ctr, 0) / 5,
  }
  const weekendAvg = {
    impressions: weekdayData.slice(5, 7).reduce((sum, d) => sum + d.impressions, 0) / 2,
    clicks: weekdayData.slice(5, 7).reduce((sum, d) => sum + d.clicks, 0) / 2,
    ctr: weekdayData.slice(5, 7).reduce((sum, d) => sum + d.ctr, 0) / 2,
  }

  // 값 포맷팅
  function formatValue(value: number, type: 'impressions' | 'clicks' | 'ctr'): string {
    if (type === 'ctr') return `${value.toFixed(2)}%`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return formatNumber(value)
  }

  return (
    <Card className="p-4 md:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-base md:text-lg font-bold text-gray-800">
          <span>🗓️</span>
          <span>요일별 성과 패턴</span>
        </div>
        <span className="text-xs text-gray-400 md:hidden">← 스와이프 →</span>
      </div>

      {/* 터치 스와이프 가능한 가로 스크롤 */}
      <div
        className="overflow-x-auto -mx-4 px-4"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <table className="w-full min-w-[500px]">
          <thead>
            {/* 계층 헤더: 평일 / 주말 */}
            <tr>
              <th className="py-1 px-2 md:px-3 w-14 md:w-20"></th>
              <th colSpan={5} className="py-1 px-2 text-center text-xs font-medium text-gray-500 bg-blue-50 border-b border-blue-100">
                평일
              </th>
              <th colSpan={2} className="py-1 px-2 text-center text-xs font-medium text-orange-600 bg-orange-50 border-b border-orange-100">
                주말
              </th>
            </tr>
            {/* 요일 헤더 */}
            <tr>
              <th className="py-2 px-2 md:px-3 text-left text-xs md:text-sm font-medium text-gray-600 w-14 md:w-20"></th>
              {weekDays.map((day) => (
                <th
                  key={day.name}
                  className={`py-2 px-1.5 md:px-3 text-center text-xs md:text-sm font-medium ${
                    day.type === 'weekend' ? 'text-orange-600 bg-orange-50/50' : 'text-gray-600'
                  }`}
                >
                  {day.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 노출 행 */}
            <tr>
              <td className="py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-gray-600">노출</td>
              {weekdayData.map((data, i) => (
                <td key={i} className="py-1.5 md:py-2 px-1 md:px-2">
                  <div
                    className={`w-full h-8 md:h-10 rounded-md flex items-center justify-center text-[10px] md:text-xs font-medium ${getHeatClass(
                      getHeatLevel(data.impressions, impressionMax, impressionMin)
                    )}`}
                  >
                    {formatValue(data.impressions, 'impressions')}
                  </div>
                </td>
              ))}
            </tr>
            {/* 클릭 행 */}
            <tr>
              <td className="py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-gray-600">클릭</td>
              {weekdayData.map((data, i) => (
                <td key={i} className="py-1.5 md:py-2 px-1 md:px-2">
                  <div
                    className={`w-full h-8 md:h-10 rounded-md flex items-center justify-center text-[10px] md:text-xs font-medium ${getHeatClass(
                      getHeatLevel(data.clicks, clickMax, clickMin)
                    )}`}
                  >
                    {formatValue(data.clicks, 'clicks')}
                  </div>
                </td>
              ))}
            </tr>
            {/* CTR 행 */}
            <tr>
              <td className="py-2 px-2 md:px-3 text-xs md:text-sm font-medium text-gray-600">CTR</td>
              {weekdayData.map((data, i) => (
                <td key={i} className="py-1.5 md:py-2 px-1 md:px-2">
                  <div
                    className={`w-full h-8 md:h-10 rounded-md flex items-center justify-center text-[10px] md:text-xs font-medium ${getHeatClass(
                      getHeatLevel(data.ctr, ctrMax, ctrMin)
                    )}`}
                  >
                    {formatValue(data.ctr, 'ctr')}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="flex gap-2 md:gap-4 justify-center mt-4 flex-wrap">
        <div className="flex items-center gap-1 md:gap-2">
          <div className="w-4 md:w-6 h-3 md:h-4 rounded bg-gray-100 border border-gray-200"></div>
          <span className="text-[10px] md:text-xs text-gray-600">낮음</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <div className="w-4 md:w-6 h-3 md:h-4 rounded bg-green-100 border border-green-200"></div>
          <span className="text-[10px] md:text-xs text-gray-600">적절</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <div className="w-4 md:w-6 h-3 md:h-4 rounded bg-green-400"></div>
          <span className="text-[10px] md:text-xs text-gray-600">양호</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <div className="w-4 md:w-6 h-3 md:h-4 rounded bg-red-400"></div>
          <span className="text-[10px] md:text-xs text-gray-600">높음</span>
        </div>
      </div>

      {/* 인사이트 */}
      <div className="rounded-lg p-3 md:p-4 mt-4 bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-blue-500">
        <p className="text-gray-700 text-xs md:text-sm font-medium mb-2">💡 인사이트:</p>
        <ul className="text-xs md:text-sm text-gray-600 mt-2 space-y-2 pl-4 md:pl-6 list-disc">
          <li>
            <span>최고 성과 요일: <strong>{weekDays[bestCtrIndex].name}</strong></span>
            <span className="block text-[11px] text-gray-500 mt-0.5 pl-0">
              CTR {ctrValues[bestCtrIndex].toFixed(2)}%, 평균 대비 +{((ctrValues[bestCtrIndex] - avgCtr) / avgCtr * 100).toFixed(0)}%
            </span>
          </li>
          <li>
            <span>최저 성과 요일: <strong>{weekDays[worstCtrIndex].name}</strong></span>
            <span className="block text-[11px] text-gray-500 mt-0.5 pl-0">
              CTR {ctrValues[worstCtrIndex].toFixed(2)}%, 평균 대비 {((ctrValues[worstCtrIndex] - avgCtr) / avgCtr * 100).toFixed(0)}%
            </span>
          </li>
          <li>
            <span>평일 평균 CTR: <strong>{weekdayAvg.ctr.toFixed(2)}%</strong> / 주말: <strong>{weekendAvg.ctr.toFixed(2)}%</strong></span>
            {weekendAvg.ctr > weekdayAvg.ctr ? (
              <span className="block text-[11px] text-orange-600 mt-0.5">→ 주말이 {((weekendAvg.ctr - weekdayAvg.ctr) / weekdayAvg.ctr * 100).toFixed(0)}% 높음</span>
            ) : (
              <span className="block text-[11px] text-blue-600 mt-0.5">→ 평일이 {((weekdayAvg.ctr - weekendAvg.ctr) / weekendAvg.ctr * 100).toFixed(0)}% 높음</span>
            )}
          </li>
          {ctrMax / ctrMin > 1.5 && (
            <li>
              <span><strong>권장:</strong> 저성과 → 고성과 요일 예산 재배분</span>
              <span className="block text-[11px] text-gray-500 mt-0.5">
                {weekDays[worstCtrIndex].name}요일 예산을 {weekDays[bestCtrIndex].name}요일로 이동
              </span>
            </li>
          )}
        </ul>
      </div>
    </Card>
  )
}
