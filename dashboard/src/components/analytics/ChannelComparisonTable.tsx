'use client'

import type { ChannelComparisonData } from '@/types/integrated-analytics'

interface ChannelComparisonTableProps {
  data: ChannelComparisonData[]
}

/**
 * 채널 비교 테이블
 */
export function ChannelComparisonTable({ data }: ChannelComparisonTableProps) {
  const formatValue = (metric: string, value: number) => {
    if (metric === '광고비' || metric === 'CPC') {
      return `₩${Math.round(value).toLocaleString()}`
    }
    if (metric === 'CTR') {
      return `${value.toFixed(2)}%`
    }
    return value.toLocaleString()
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              지표
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Meta
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              네이버
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              차이
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => {
            const isPositive = row.metric === 'CPC' ? row.difference_percent < 0 : row.difference_percent > 0
            return (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {row.metric}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                  {formatValue(row.metric, row.meta_value)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                  {formatValue(row.metric, row.naver_value)}
                </td>
                <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                  row.difference_percent === 0 ? 'text-gray-500' : isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {row.difference_percent > 0 ? '+' : ''}{row.difference_percent.toFixed(1)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
