'use client'

import { useState, useMemo, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Megaphone,
} from 'lucide-react'
import type { MetaAdData } from '@/types/meta-analytics'

type SortField = 'ad_name' | 'impressions' | 'clicks' | 'ctr' | 'spend_krw' | 'video_views' | 'days_count'
type SortDirection = 'asc' | 'desc'

interface MetaAdTableProps {
  ads: MetaAdData[]
  loading?: boolean
  metricType?: 'lead' | 'video'
}

// 모바일 광고 카드 컴포넌트
interface MobileAdCardProps {
  ad: MetaAdData
  index: number
  metricType: 'lead' | 'video'
}

function MobileAdCard({ ad, index, metricType }: MobileAdCardProps) {
  return (
    <div className="flex-shrink-0 w-[85%] snap-center bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full text-blue-600 text-xs font-bold flex-shrink-0">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm truncate" title={ad.ad_name}>
            {ad.ad_name}
          </p>
          {ad.campaign_name && (
            <p className="text-xs text-gray-500 truncate" title={ad.campaign_name}>
              {ad.campaign_name}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">노출수</p>
          <p className="font-medium">{formatNumber(ad.impressions)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">클릭수</p>
          <p className="font-medium">{formatNumber(ad.clicks)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">CTR</p>
          <p className="font-medium text-green-600">{ad.ctr.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">{metricType === 'video' ? '영상조회' : '리드'}</p>
          <p className="font-medium">
            {metricType === 'video' ? formatNumber(ad.video_views || 0) : formatNumber(ad.leads)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">{metricType === 'video' ? '평균시청' : 'CPL'}</p>
          <p className="font-medium text-purple-600">
            {metricType === 'video' ? '-' : (ad.leads > 0 ? `${formatNumber(ad.cpl_krw)}원` : '-')}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">운영기간</p>
          <p className="font-medium">{ad.days_count}일</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-gray-500 text-xs">지출액</p>
        <p className="text-lg font-bold text-blue-600">{formatNumber(ad.spend_krw)}원</p>
      </div>
    </div>
  )
}

export function MetaAdTable({ ads, loading, metricType = 'lead' }: MetaAdTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('spend_krw')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [mobileCardIndex, setMobileCardIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 정렬 처리
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // 검색 및 정렬 적용
  const filteredAndSortedAds = useMemo(() => {
    let result = ads

    // 검색 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (ad) =>
          ad.ad_name.toLowerCase().includes(term) ||
          (ad.campaign_name && ad.campaign_name.toLowerCase().includes(term))
      )
    }

    // 정렬
    result = [...result].sort((a, b) => {
      let aVal: number | string = a[sortField]
      let bVal: number | string = b[sortField]

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
      }

      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
      }
    })

    return result
  }, [ads, searchTerm, sortField, sortDirection])

  // 정렬 아이콘
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-500">데이터 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 스크롤 핸들러
  const handleScroll = () => {
    if (scrollContainerRef.current && filteredAndSortedAds.length > 0) {
      const container = scrollContainerRef.current
      const cardWidth = container.scrollWidth / filteredAndSortedAds.length
      const newIndex = Math.round(container.scrollLeft / cardWidth)
      setMobileCardIndex(newIndex)
    }
  }

  // 네비게이션 버튼 핸들러
  const scrollToCard = (index: number) => {
    if (scrollContainerRef.current && filteredAndSortedAds.length > 0) {
      const container = scrollContainerRef.current
      const cardWidth = container.scrollWidth / filteredAndSortedAds.length
      container.scrollTo({ left: cardWidth * index, behavior: 'smooth' })
      setMobileCardIndex(index)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Megaphone className="h-5 w-5 flex-shrink-0" />
            <span className="whitespace-nowrap">광고별 성과 분석</span>
          </CardTitle>
          <span className="text-sm text-gray-500">총 {ads.length}개 광고</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* 검색 */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="광고 검색..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setMobileCardIndex(0) }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* 모바일: 스와이프 카드 캐러셀 */}
        <div className="md:hidden">
          {filteredAndSortedAds.length > 0 ? (
            <>
              {/* 캐러셀 컨테이너 */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-2 px-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {filteredAndSortedAds.map((ad, index) => (
                  <MobileAdCard
                    key={ad.ad_id}
                    ad={ad}
                    index={index}
                    metricType={metricType}
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
                  {filteredAndSortedAds.slice(0, Math.min(filteredAndSortedAds.length, 10)).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToCard(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === mobileCardIndex ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                  {filteredAndSortedAds.length > 10 && (
                    <span className="text-xs text-gray-400 ml-1">+{filteredAndSortedAds.length - 10}</span>
                  )}
                </div>

                <button
                  onClick={() => scrollToCard(Math.min(filteredAndSortedAds.length - 1, mobileCardIndex + 1))}
                  disabled={mobileCardIndex === filteredAndSortedAds.length - 1}
                  className="p-1 rounded-full bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* 카드 카운터 */}
              <p className="text-center text-xs text-gray-400 mt-2">
                {mobileCardIndex + 1} / {filteredAndSortedAds.length}
              </p>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? '검색 결과가 없습니다.' : '데이터가 없습니다.'}
            </div>
          )}
        </div>

        {/* 데스크톱: 기존 테이블 */}
        <div className="hidden md:block overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th
                  className="px-3 py-2 text-left font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('ad_name')}
                >
                  <div className="flex items-center gap-1">
                    광고 <SortIcon field="ad_name" />
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('impressions')}
                >
                  <div className="flex items-center justify-end gap-1">
                    노출수 <SortIcon field="impressions" />
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('clicks')}
                >
                  <div className="flex items-center justify-end gap-1">
                    클릭수 <SortIcon field="clicks" />
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('ctr')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CTR <SortIcon field="ctr" />
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('spend_krw')}
                >
                  <div className="flex items-center justify-end gap-1">
                    지출액 <SortIcon field="spend_krw" />
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('video_views')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {metricType === 'video' ? '영상조회' : '리드'} <SortIcon field="video_views" />
                  </div>
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  {metricType === 'video' ? '평균시청' : 'CPL'}
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">기간</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAndSortedAds.map((ad, index) => (
                <tr key={ad.ad_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">{index + 1}</span>
                      <Megaphone className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[200px]" title={ad.ad_name}>
                          {ad.ad_name}
                        </div>
                        {ad.campaign_name && (
                          <div className="text-xs text-gray-400 truncate max-w-[200px]" title={ad.campaign_name}>
                            {ad.campaign_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(ad.impressions)}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(ad.clicks)}</td>
                  <td className="px-3 py-2 text-right text-green-600">{ad.ctr.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right font-medium text-blue-600">
                    {formatNumber(ad.spend_krw)}원
                  </td>
                  <td className="px-3 py-2 text-right">
                    {metricType === 'video' ? formatNumber(ad.video_views || 0) : formatNumber(ad.leads)}
                  </td>
                  <td className="px-3 py-2 text-right text-purple-600">
                    {metricType === 'video' ? '-' : (ad.leads > 0 ? `${formatNumber(ad.cpl_krw)}원` : '-')}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500 text-xs">
                    {ad.days_count}일
                  </td>
                </tr>
              ))}
              {filteredAndSortedAds.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    {searchTerm ? '검색 결과가 없습니다.' : '데이터가 없습니다.'}
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
