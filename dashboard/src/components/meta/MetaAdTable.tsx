'use client'

import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'
import {
  ChevronUp,
  ChevronDown,
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

export function MetaAdTable({ ads, loading, metricType = 'lead' }: MetaAdTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('spend_krw')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            광고별 성과 분석
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
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
