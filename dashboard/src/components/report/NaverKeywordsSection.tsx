'use client'

import { Card } from '@/components/ui/card'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils'

interface KeywordData {
  keyword: string
  impressions: number
  clicks: number
  totalCost: number
  ctr: number
  avgCpc: number
  avgRank: number
}

interface NaverKeywordsSectionProps {
  keywords: KeywordData[]
}

export function NaverKeywordsSection({ keywords }: NaverKeywordsSectionProps) {
  // 비용 기준 정렬
  const sortedKeywords = [...keywords].sort((a, b) => b.totalCost - a.totalCost)
  const top5 = sortedKeywords.slice(0, 5)
  const totalCost = keywords.reduce((sum, k) => sum + k.totalCost, 0)

  return (
    <Card className="p-4 md:p-6 mb-6">
      <div className="flex items-center gap-2 text-base md:text-lg font-bold text-gray-800 mb-4">
        <span>🔍</span>
        <span>네이버 키워드 분석</span>
      </div>

      {/* 키워드별 비용 바 차트 - 모바일 최적화 */}
      <div className="space-y-2 md:space-y-3 mb-6">
        {top5.map((keyword, index) => {
          const percentage = totalCost > 0 ? (keyword.totalCost / totalCost) * 100 : 0
          const barWidth = Math.max(percentage, 8) // 최소 8%로 텍스트 표시 공간 확보
          return (
            <div key={keyword.keyword}>
              {/* 모바일: 수직 레이아웃 */}
              <div className="md:hidden">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[60%]" title={keyword.keyword}>
                    <span className="text-gray-400 mr-1">{index + 1}.</span>
                    {keyword.keyword}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatCurrency(keyword.totalCost, 'KRW')} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${barWidth}%`,
                      background: 'linear-gradient(90deg, #03C75A 0%, #00a549 100%)'
                    }}
                  />
                </div>
              </div>
              {/* 데스크톱: 수평 레이아웃 */}
              <div className="hidden md:flex items-center gap-4">
                <div className="w-28 text-sm font-medium text-gray-700 truncate" title={keyword.keyword}>
                  <span className="text-gray-400 mr-1">{index + 1}.</span>
                  {keyword.keyword}
                </div>
                <div className="flex-1 bg-gray-100 rounded-lg h-10 overflow-hidden relative">
                  <div
                    className="h-full rounded-lg flex items-center justify-end px-3"
                    style={{
                      width: `${barWidth}%`,
                      background: 'linear-gradient(90deg, #03C75A 0%, #00a549 100%)'
                    }}
                  >
                    {percentage >= 15 && (
                      <span className="text-sm font-semibold text-white whitespace-nowrap">
                        {formatCurrency(keyword.totalCost, 'KRW')} ({percentage.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                  {percentage < 15 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {formatCurrency(keyword.totalCost, 'KRW')} ({percentage.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 모바일: 키워드 카드 - 컴팩트 레이아웃 */}
      <div className="md:hidden space-y-2">
        {sortedKeywords.slice(0, 5).map((keyword, index) => (
          <div key={keyword.keyword} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            {/* 헤더: 순위 + 키워드명(고정폭) + 총비용(원화기호 정렬) */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-400 text-sm font-medium shrink-0 w-5">{index + 1}.</span>
              <span className={`font-semibold text-sm truncate w-24 ${keyword.keyword === '음식점' ? 'line-through text-gray-400' : 'text-gray-800'}`} title={keyword.keyword}>
                {keyword.keyword}
                {keyword.keyword === '음식점' && <span className="text-[10px] text-red-400 ml-1">(off)</span>}
              </span>
              <span className="text-sm font-bold text-green-600 w-20 text-right">
                {formatCurrency(keyword.totalCost, 'KRW')}
              </span>
            </div>
            {/* 지표들: 4열 그리드 */}
            <div className="grid grid-cols-4 gap-1 text-center">
              <div className="bg-white rounded px-2 py-1.5">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">노출</p>
                <p className="text-xs font-semibold text-gray-700">{formatNumber(keyword.impressions)}</p>
              </div>
              <div className="bg-white rounded px-2 py-1.5">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">클릭</p>
                <p className="text-xs font-semibold text-gray-700">{formatNumber(keyword.clicks)}</p>
              </div>
              <div className="bg-white rounded px-2 py-1.5">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">CTR</p>
                <p className={`text-xs font-semibold ${keyword.ctr > 3 ? 'text-green-600' : 'text-gray-700'}`}>{formatPercent(keyword.ctr)}</p>
              </div>
              <div className="bg-white rounded px-2 py-1.5">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">순위</p>
                <p className={`text-xs font-semibold ${keyword.avgRank <= 2 ? 'text-green-600' : 'text-gray-700'}`}>{keyword.avgRank.toFixed(1)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 데스크톱: 키워드 상세 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-3 px-3 text-left font-semibold text-gray-600">키워드</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">노출수</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">클릭수</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">CTR</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">평균CPC</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">총비용</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">평균순위</th>
            </tr>
          </thead>
          <tbody>
            {sortedKeywords.slice(0, 10).map((keyword) => (
              <tr key={keyword.keyword} className="border-b border-gray-100 hover:bg-gray-50">
                <td className={`py-2 px-3 font-medium ${keyword.keyword === '음식점' ? 'line-through text-gray-400' : ''}`}>
                  {keyword.keyword}
                  {keyword.keyword === '음식점' && <span className="text-xs text-red-400 ml-1">(off)</span>}
                </td>
                <td className="py-2 px-3 text-right">{formatNumber(keyword.impressions)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(keyword.clicks)}</td>
                <td className={`py-2 px-3 text-right ${keyword.ctr > 3 ? 'text-green-600 font-semibold' : ''}`}>
                  {formatPercent(keyword.ctr)}
                </td>
                <td className="py-2 px-3 text-right">{formatCurrency(keyword.avgCpc, 'KRW')}</td>
                <td className="py-2 px-3 text-right text-blue-600 font-medium">
                  {formatCurrency(keyword.totalCost, 'KRW')}
                </td>
                <td className={`py-2 px-3 text-right ${keyword.avgRank <= 2 ? 'text-green-600' : ''}`}>
                  {keyword.avgRank.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 인사이트 박스 */}
      <div className="mt-4 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-blue-500">
        <p className="text-gray-700 text-sm font-medium mb-2">키워드 성과 분석:</p>
        <ul className="text-sm text-gray-600 space-y-1 pl-4 list-disc">
          {sortedKeywords.length > 0 && sortedKeywords[0].ctr > 5 && (
            <li><strong>{sortedKeywords.find(k => k.ctr === Math.max(...sortedKeywords.map(k => k.ctr)))?.keyword}:</strong> CTR {formatPercent(Math.max(...sortedKeywords.map(k => k.ctr)))}로 높은 클릭 효율</li>
          )}
          {sortedKeywords.length > 0 && (
            <li><strong>{sortedKeywords[0].keyword}:</strong> 최다 비용 키워드, 광고비의 {((sortedKeywords[0].totalCost / totalCost) * 100).toFixed(1)}% 차지</li>
          )}
        </ul>
        <p className="text-xs text-gray-500 mt-3 italic">
          * 네이버 플레이스광고는 위치 기반 자동 키워드 배정으로, 제외 키워드 설정만 가능합니다.<br />
          * 네이버 키워드 데이터는 월 마감 후 익월에 업데이트됩니다.
        </p>
      </div>
    </Card>
  )
}
