'use client'

interface DailyData {
  date: string
  leads: number
  cpl: number
  spend: number
  clicks: number
}

interface BasDailyCardsProps {
  data: DailyData[]
}

export function BasDailyCards({ data }: BasDailyCardsProps) {
  // 최근 7일만 표시
  const recentData = data.slice(-7)

  if (recentData.length === 0) return null

  // 최고/최저 일 찾기
  const maxLeadsDay = recentData.reduce((max, d) => (d.leads > max.leads ? d : max), recentData[0])
  const minLeadsDay = recentData
    .filter((d) => d.leads > 0)
    .reduce(
      (min, d) => (d.leads < min.leads ? d : min),
      recentData.find((d) => d.leads > 0) || recentData[0]
    )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">일별 성과 카드</h3>
        <span className="text-xs text-gray-500">최근 {recentData.length}일</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3">
        {recentData.map((day) => {
          const isMax = day.date === maxLeadsDay.date
          const isMin = day.date === minLeadsDay.date && day.leads > 0

          return (
            <div
              key={day.date}
              className={`p-3 rounded-lg border transition-colors ${
                isMax
                  ? 'border-green-300 bg-green-50'
                  : isMin
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">
                {day.date.slice(5)}
                {isMax && <span className="ml-1 text-green-600">최고</span>}
                {isMin && <span className="ml-1 text-amber-600">최저</span>}
              </div>
              <div className="text-lg font-bold text-gray-900">{day.leads}건</div>
              <div className="text-xs text-gray-500 mt-0.5">
                ${Math.round(day.cpl).toLocaleString('en-US')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
