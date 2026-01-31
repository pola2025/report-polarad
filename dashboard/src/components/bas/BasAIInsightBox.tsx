'use client'

interface SummaryItem {
  icon: string
  text: string
  type: 'success' | 'warning' | 'info'
}

interface ActionItem {
  title: string
  description: string
}

interface BasAIInsightBoxProps {
  summaryItems: SummaryItem[]
  actionItems: ActionItem[]
}

export function BasAIInsightBox({ summaryItems, actionItems }: BasAIInsightBoxProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <span className="text-lg">{'\ud83e\udd16'}</span>
        <h3 className="text-sm sm:text-base font-semibold text-gray-900">AI 인사이트</h3>
      </div>

      {/* 분석 항목 */}
      <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-5">
        {summaryItems.map((item, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg ${
              item.type === 'success'
                ? 'bg-green-50'
                : item.type === 'warning'
                  ? 'bg-amber-50'
                  : 'bg-blue-50'
            }`}
          >
            <span
              className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                item.type === 'success'
                  ? 'bg-green-200 text-green-700'
                  : item.type === 'warning'
                    ? 'bg-amber-200 text-amber-700'
                    : 'bg-blue-200 text-blue-700'
              }`}
            >
              {item.icon}
            </span>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>

      {/* 권장 액션 */}
      {actionItems.length > 0 && (
        <div className="border-t border-gray-100 pt-3 sm:pt-4">
          <h4 className="text-xs sm:text-sm font-medium text-gray-600 mb-2 sm:mb-3">{'\ud83d\udca1'} 권장 액션</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {actionItems.map((item, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-2.5 sm:p-3">
                <div className="text-xs sm:text-sm font-medium text-gray-900">{item.title}</div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-1">{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
