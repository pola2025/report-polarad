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

interface DateHeatmapProps {
  daily: DailyData[]
  usdToKrw?: number
}

// 히트 레벨 계산 (0~4)
function getHeatLevel(value: number, max: number, min: number): number {
  if (max === min) return 2
  const range = max - min
  const ratio = (value - min) / range
  if (ratio >= 0.8) return 4  // 최고
  if (ratio >= 0.6) return 3  // 높음
  if (ratio >= 0.4) return 2  // 보통
  if (ratio >= 0.2) return 1  // 낮음
  return 0  // 최저
}

// 히트 클래스 (낮음=회색, 적절=녹색, 높음=빨강)
function getHeatClass(level: number): string {
  const classes = [
    'bg-gray-100 text-gray-400',   // 최저 - 회색
    'bg-gray-200 text-gray-500',   // 낮음 - 진한 회색
    'bg-green-100 text-green-700', // 보통 - 연한 녹색
    'bg-green-400 text-white',     // 높음 - 녹색
    'bg-red-400 text-white',       // 최고 - 빨강
  ]
  return classes[level] || classes[0]
}

export function DateHeatmap({ daily }: DateHeatmapProps) {
  if (daily.length === 0) return null

  // 날짜별 데이터 맵 생성
  const dataMap = new Map<number, DailyData>()
  daily.forEach(d => {
    const day = new Date(d.date).getDate()
    const existing = dataMap.get(day)
    if (existing) {
      existing.impressions += d.impressions
      existing.clicks += d.clicks
      existing.leads += d.leads
      existing.spend += d.spend
    } else {
      dataMap.set(day, { ...d })
    }
  })

  // 1~31일 배열 생성
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  // min/max 계산
  const values = Array.from(dataMap.values())
  const impressionValues = values.map(d => d.impressions)
  const clickValues = values.map(d => d.clicks)

  const impressionMax = Math.max(...impressionValues, 1)
  const impressionMin = Math.min(...impressionValues)
  const clickMax = Math.max(...clickValues, 1)
  const clickMin = Math.min(...clickValues)

  // 상위/하위 날짜 찾기
  const sortedByClicks = [...values].sort((a, b) => b.clicks - a.clicks)
  const topDays = sortedByClicks.slice(0, 3)
  const bottomDays = sortedByClicks.slice(-3).reverse()

  // 값 포맷팅
  function formatValue(value: number): string {
    if (value >= 10000) return `${(value / 1000).toFixed(0)}K`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return formatNumber(value)
  }

  // 5일씩 그룹으로 나누기
  const groups = [
    { label: '1~5일', start: 1, end: 5 },
    { label: '6~10일', start: 6, end: 10 },
    { label: '11~15일', start: 11, end: 15 },
    { label: '16~20일', start: 16, end: 20 },
    { label: '21~25일', start: 21, end: 25 },
    { label: '26~31일', start: 26, end: 31 },
  ]

  return (
    <Card className="p-4 md:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-base md:text-lg font-bold text-gray-800">
          <span>📅</span>
          <span>날짜별 성과 패턴</span>
          <span className="text-xs font-normal text-gray-400 ml-1 md:ml-2">(월간)</span>
        </div>
        <span className="text-xs text-gray-400 md:hidden">← 스와이프 →</span>
      </div>

      {/* 터치 스와이프 가능한 가로 스크롤 */}
      <div
        className="overflow-x-auto -mx-4 px-4"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <table className="w-full min-w-[800px]">
          <thead>
            {/* 그룹 헤더 */}
            <tr>
              <th className="py-1 px-2 w-16"></th>
              {groups.map(g => (
                <th
                  key={g.label}
                  colSpan={g.end - g.start + 1}
                  className="py-1 px-1 text-center text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200"
                >
                  {g.label}
                </th>
              ))}
            </tr>
            {/* 날짜 헤더 */}
            <tr>
              <th className="py-2 px-2 text-left text-sm font-medium text-gray-600 w-16"></th>
              {days.map(day => (
                <th key={day} className="py-2 px-0.5 text-center text-xs font-medium text-gray-500 w-8">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 노출 행 */}
            <tr>
              <td className="py-2 px-2 text-sm font-medium text-gray-600">노출</td>
              {days.map(day => {
                const data = dataMap.get(day)
                if (!data) {
                  return (
                    <td key={day} className="py-1 px-0.5">
                      <div className="w-full h-8 rounded flex items-center justify-center text-[10px] bg-gray-50 text-gray-300">
                        -
                      </div>
                    </td>
                  )
                }
                return (
                  <td key={day} className="py-1 px-0.5">
                    <div
                      className={`w-full h-8 rounded flex items-center justify-center text-[10px] font-medium ${getHeatClass(
                        getHeatLevel(data.impressions, impressionMax, impressionMin)
                      )}`}
                      title={`${day}일: ${data.impressions.toLocaleString()}회 노출`}
                    >
                      {formatValue(data.impressions)}
                    </div>
                  </td>
                )
              })}
            </tr>
            {/* 클릭 행 */}
            <tr>
              <td className="py-2 px-2 text-sm font-medium text-gray-600">클릭</td>
              {days.map(day => {
                const data = dataMap.get(day)
                if (!data) {
                  return (
                    <td key={day} className="py-1 px-0.5">
                      <div className="w-full h-8 rounded flex items-center justify-center text-[10px] bg-gray-50 text-gray-300">
                        -
                      </div>
                    </td>
                  )
                }
                return (
                  <td key={day} className="py-1 px-0.5">
                    <div
                      className={`w-full h-8 rounded flex items-center justify-center text-[10px] font-medium ${getHeatClass(
                        getHeatLevel(data.clicks, clickMax, clickMin)
                      )}`}
                      title={`${day}일: ${data.clicks.toLocaleString()}회 클릭`}
                    >
                      {data.clicks}
                    </div>
                  </td>
                )
              })}
            </tr>
            {/* CTR 행 */}
            <tr>
              <td className="py-2 px-2 text-sm font-medium text-gray-600">CTR</td>
              {days.map(day => {
                const data = dataMap.get(day)
                if (!data) {
                  return (
                    <td key={day} className="py-1 px-0.5">
                      <div className="w-full h-8 rounded flex items-center justify-center text-[10px] bg-gray-50 text-gray-300">
                        -
                      </div>
                    </td>
                  )
                }
                const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0
                const ctrMax = values.reduce((max, v) => {
                  const c = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0
                  return Math.max(max, c)
                }, 0)
                const ctrMin = values.reduce((min, v) => {
                  const c = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0
                  return Math.min(min, c)
                }, Infinity)
                return (
                  <td key={day} className="py-1 px-0.5">
                    <div
                      className={`w-full h-8 rounded flex items-center justify-center text-[10px] font-medium ${getHeatClass(
                        getHeatLevel(ctr, ctrMax, ctrMin)
                      )}`}
                      title={`${day}일: CTR ${ctr.toFixed(2)}%`}
                    >
                      {ctr.toFixed(1)}
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="flex gap-3 justify-center mt-4">
        <div className="flex items-center gap-1">
          <div className="w-5 h-3 rounded bg-gray-100 border border-gray-200"></div>
          <span className="text-[10px] text-gray-500">최저</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-5 h-3 rounded bg-gray-200"></div>
          <span className="text-[10px] text-gray-500">낮음</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-5 h-3 rounded bg-green-100 border border-green-200"></div>
          <span className="text-[10px] text-gray-500">보통</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-5 h-3 rounded bg-green-400"></div>
          <span className="text-[10px] text-gray-500">높음</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-5 h-3 rounded bg-red-400"></div>
          <span className="text-[10px] text-gray-500">최고</span>
        </div>
      </div>

      {/* 상위/하위 분석 */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="rounded-lg p-3 bg-green-50 border border-green-200">
          <p className="text-sm font-medium text-green-700 mb-2">🏆 클릭수 상위 3일</p>
          <div className="space-y-1">
            {topDays.map((d, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-600">{new Date(d.date).getDate()}일</span>
                <span className="font-medium text-green-700">{d.clicks}회</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg p-3 bg-gray-50 border border-gray-200">
          <p className="text-sm font-medium text-gray-600 mb-2">📉 클릭수 하위 3일</p>
          <div className="space-y-1">
            {bottomDays.map((d, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-600">{new Date(d.date).getDate()}일</span>
                <span className="font-medium text-gray-500">{d.clicks}회</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
