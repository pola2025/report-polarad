'use client'

interface ReportHeaderProps {
  clientName: string
  reportType: 'monthly' | 'weekly'
  year: number
  month?: number
  week?: number
  periodStart: string
  periodEnd: string
  createdAt: string
}

export function ReportHeader({
  clientName,
  reportType,
  year,
  month,
  periodStart,
  periodEnd,
  createdAt,
}: ReportHeaderProps) {
  const periodLabel = reportType === 'monthly'
    ? `${year}년 ${month}월`
    : `${year}년 ${month}월`

  const typeLabel = reportType === 'monthly' ? '월간 리포트' : '주간 리포트'
  const typeColor = reportType === 'monthly'
    ? 'bg-orange-100 text-orange-700'
    : 'bg-blue-100 text-blue-700'

  return (
    <header className="mb-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${typeColor}`}>
              {typeLabel}
            </span>
            <span className="text-sm text-gray-500">
              생성일: {new Date(createdAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{clientName}</h1>
          <p className="text-gray-600 mt-1">{periodLabel} 광고 성과 분석</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">분석 기간</div>
          <div className="text-lg font-semibold text-gray-800">
            {periodStart} ~ {periodEnd}
          </div>
        </div>
      </div>
    </header>
  )
}
