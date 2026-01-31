'use client'

interface SummaryItem {
  emoji: string
  title: string
  content: string
}

interface BasExecutiveSummaryProps {
  highlights: SummaryItem
  warnings: SummaryItem
  actions: SummaryItem
  summaryText?: string
}

export function BasExecutiveSummary({
  highlights,
  warnings,
  actions,
  summaryText,
}: BasExecutiveSummaryProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4">
        <span>{'\ud83d\udcca'}</span>
        <span>핵심 성과 요약</span>
      </div>

      {summaryText && (
        <div
          className="rounded-lg p-3 sm:p-5 mb-3 sm:mb-4 border-l-4 border-blue-500"
          style={{
            background:
              'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
          }}
        >
          <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{summaryText}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-green-50 rounded-lg border border-green-100">
          <span className="text-xl sm:text-2xl">{highlights.emoji}</span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-medium text-gray-600">{highlights.title}</div>
            <div className="text-sm sm:text-base text-gray-900 font-semibold">{highlights.content}</div>
          </div>
        </div>

        <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-100">
          <span className="text-xl sm:text-2xl">{warnings.emoji}</span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-medium text-gray-600">{warnings.title}</div>
            <div className="text-sm sm:text-base text-gray-900 font-semibold">{warnings.content}</div>
          </div>
        </div>

        <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-100">
          <span className="text-xl sm:text-2xl">{actions.emoji}</span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-medium text-gray-600">{actions.title}</div>
            <div className="text-sm sm:text-base text-gray-900 font-semibold">{actions.content}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
