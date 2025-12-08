'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'
import { Search, ArrowUpDown, ExternalLink } from 'lucide-react'
import type { NaverKeywordData } from '@/types/naver-analytics'

type SortField = 'keyword' | 'impressions' | 'clicks' | 'ctr' | 'avg_cpc' | 'total_cost' | 'avg_rank'
type SortOrder = 'asc' | 'desc'

interface NaverKeywordTableProps {
  keywords: NaverKeywordData[]
  loading?: boolean
  onKeywordClick?: (keyword: string) => void
}

export function NaverKeywordTable({
  keywords,
  loading,
  onKeywordClick,
}: NaverKeywordTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('total_cost')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            키워드별 성과 분석
          </CardTitle>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[500px]">
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
