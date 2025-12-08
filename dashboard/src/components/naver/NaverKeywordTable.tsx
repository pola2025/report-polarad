'use client'

import { useState, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'
import { Search, ArrowUpDown, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import type { NaverKeywordData } from '@/types/naver-analytics'

type SortField = 'keyword' | 'impressions' | 'clicks' | 'ctr' | 'avg_cpc' | 'total_cost' | 'avg_rank'
type SortOrder = 'asc' | 'desc'

interface NaverKeywordTableProps {
  keywords: NaverKeywordData[]
  loading?: boolean
  onKeywordClick?: (keyword: string) => void
  dateRange?: { start: string; end: string }
}

// 모바일 키워드 카드 컴포넌트
function MobileKeywordCard({ keyword, index, onKeywordClick }: { keyword: NaverKeywordData; index: number; onKeywordClick?: (keyword: string) => void }) {
  return (
    <div
      className={`flex-shrink-0 w-[85%] snap-center bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${onKeywordClick ? 'cursor-pointer' : ''}`}
      onClick={() => onKeywordClick?.(keyword.keyword)}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full text-green-600 text-xs font-bold flex-shrink-0">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm" title={keyword.keyword}>
            {keyword.keyword}
          </p>
          <p className="text-xs text-gray-500">{keyword.days_count}일 운영</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">노출수</p>
          <p className="font-medium">{formatNumber(keyword.impressions)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">클릭수</p>
          <p className="font-medium">{formatNumber(keyword.clicks)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">CTR</p>
          <p className={`font-medium ${keyword.ctr > 5 ? 'text-green-600' : keyword.ctr > 2 ? 'text-blue-600' : ''}`}>
            {keyword.ctr.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">평균 CPC</p>
          <p className="font-medium">{formatNumber(keyword.avg_cpc)}원</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">평균 순위</p>
          <p className={`font-medium ${keyword.avg_rank <= 3 ? 'text-green-600' : ''}`}>
            {keyword.avg_rank.toFixed(1)}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-gray-500 text-xs">총 비용</p>
        <p className="text-lg font-bold text-green-600">{formatNumber(keyword.total_cost)}원</p>
      </div>
    </div>
  )
}

export function NaverKeywordTable({
  keywords,
  loading,
  onKeywordClick,
  dateRange,
}: NaverKeywordTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('total_cost')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [mobileCardIndex, setMobileCardIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // 필터링 및 정렬 (클릭이 0인 키워드는 제외)
  const filteredKeywords = keywords
    .filter((k) => k.clicks > 0) // 클릭이 있는 키워드만 표시
    .filter((k) => k.keyword.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

  // 정렬 헤더 컴포넌트
  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-3 py-2 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-blue-600' : 'text-gray-400'}`} />
      </div>
    </th>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-500">키워드 데이터 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 스크롤 핸들러
  const handleScroll = () => {
    if (scrollContainerRef.current && filteredKeywords.length > 0) {
      const container = scrollContainerRef.current
      const cardWidth = container.scrollWidth / filteredKeywords.length
      const newIndex = Math.round(container.scrollLeft / cardWidth)
      setMobileCardIndex(newIndex)
    }
  }

  // 네비게이션 버튼 핸들러
  const scrollToCard = (index: number) => {
    if (scrollContainerRef.current && filteredKeywords.length > 0) {
      const container = scrollContainerRef.current
      const cardWidth = container.scrollWidth / filteredKeywords.length
      container.scrollTo({ left: cardWidth * index, behavior: 'smooth' })
      setMobileCardIndex(index)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Search className="h-5 w-5 flex-shrink-0" />
              <span className="whitespace-nowrap">키워드별 성과 분석</span>
            </CardTitle>
            {dateRange && (
              <p className="text-xs text-gray-500 mt-1 ml-7">
                {dateRange.start} ~ {dateRange.end}
              </p>
            )}
          </div>
          <div className="text-sm text-gray-500">
            총 {keywords.filter(k => k.clicks > 0).length}개 키워드 (클릭 발생)
          </div>
        </div>
        {/* 검색 */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="키워드 검색..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setMobileCardIndex(0) }}
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 모바일: 스와이프 카드 캐러셀 */}
        <div className="md:hidden">
          {filteredKeywords.length > 0 ? (
            <>
              {/* 캐러셀 컨테이너 */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-2 px-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {filteredKeywords.map((k, index) => (
                  <MobileKeywordCard
                    key={k.keyword}
                    keyword={k}
                    index={index}
                    onKeywordClick={onKeywordClick}
                  />
                ))}
              </div>

              {/* 네비게이션 컨트롤 */}
              <div className="flex items-center justify-center gap-4 mt-2">
                <button
                  onClick={() => scrollToCard(Math.max(0, mobileCardIndex - 1))}
                  disabled={mobileCardIndex === 0}
                  className="p-1 rounded-full bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>

                {/* 도트 인디케이터 */}
                <div className="flex gap-1.5">
                  {filteredKeywords.slice(0, Math.min(filteredKeywords.length, 10)).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToCard(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === mobileCardIndex ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                  {filteredKeywords.length > 10 && (
                    <span className="text-xs text-gray-400 ml-1">+{filteredKeywords.length - 10}</span>
                  )}
                </div>

                <button
                  onClick={() => scrollToCard(Math.min(filteredKeywords.length - 1, mobileCardIndex + 1))}
                  disabled={mobileCardIndex === filteredKeywords.length - 1}
                  className="p-1 rounded-full bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* 카드 카운터 */}
              <p className="text-center text-xs text-gray-400 mt-2">
                {mobileCardIndex + 1} / {filteredKeywords.length}
              </p>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? '검색 결과가 없습니다.' : '키워드 데이터가 없습니다.'}
            </div>
          )}
        </div>

        {/* 데스크톱: 기존 테이블 */}
        <div className="hidden md:block overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th
                  className="px-3 py-2 text-left font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('keyword')}
                >
                  <div className="flex items-center gap-1">
                    키워드
                    <ArrowUpDown className={`h-3 w-3 ${sortField === 'keyword' ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                </th>
                <SortHeader field="impressions" label="노출수" />
                <SortHeader field="clicks" label="클릭수" />
                <SortHeader field="ctr" label="CTR" />
                <SortHeader field="avg_cpc" label="평균CPC" />
                <SortHeader field="total_cost" label="총비용" />
                <SortHeader field="avg_rank" label="평균순위" />
                <th className="px-3 py-2 text-center font-medium text-gray-500">기간</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredKeywords.map((k, idx) => (
                <tr
                  key={k.keyword}
                  className={`hover:bg-gray-50 ${onKeywordClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onKeywordClick?.(k.keyword)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs w-5">{idx + 1}</span>
                      <span className="font-medium">{k.keyword}</span>
                      {onKeywordClick && (
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(k.impressions)}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(k.clicks)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={k.ctr > 5 ? 'text-green-600' : k.ctr > 2 ? 'text-blue-600' : 'text-gray-600'}>
                      {k.ctr.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(k.avg_cpc)}원</td>
                  <td className="px-3 py-2 text-right font-medium text-blue-600">
                    {formatNumber(k.total_cost)}원
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={k.avg_rank <= 3 ? 'text-green-600 font-medium' : 'text-gray-600'}>
                      {k.avg_rank.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">
                    {k.days_count}일
                  </td>
                </tr>
              ))}
              {filteredKeywords.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    {searchTerm ? '검색 결과가 없습니다.' : '키워드 데이터가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
