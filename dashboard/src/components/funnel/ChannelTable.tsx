'use client'

/**
 * 채널별 퍼널 성과 테이블
 */

import type { ChannelFunnelData } from '@/types/ga4-analytics'

interface ChannelTableProps {
  channels: ChannelFunnelData[]
}

export function ChannelTable({ channels }: ChannelTableProps) {
  if (channels.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        채널 데이터가 없습니다
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-700">채널</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">사용자</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">세션</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">접수</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">리드</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">지출</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">CPL</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">전환율</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((channel) => (
            <tr
              key={channel.channel}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="py-3 px-4">
                <span className="font-medium text-gray-900">
                  {channel.channel}
                </span>
              </td>
              <td className="text-right py-3 px-4 text-gray-600">
                {channel.users.toLocaleString()}
              </td>
              <td className="text-right py-3 px-4 text-gray-600">
                {channel.sessions.toLocaleString()}
              </td>
              <td className="text-right py-3 px-4 text-gray-600">
                {channel.submissions.toLocaleString()}
              </td>
              <td className="text-right py-3 px-4">
                <span className={channel.leads > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                  {channel.leads.toLocaleString()}
                </span>
              </td>
              <td className="text-right py-3 px-4 text-gray-600">
                {channel.spend > 0
                  ? `₩${channel.spend.toLocaleString()}`
                  : '-'}
              </td>
              <td className="text-right py-3 px-4">
                {channel.cpl !== null ? (
                  <span className="text-blue-600 font-medium">
                    ₩{channel.cpl.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="text-right py-3 px-4">
                <span className={channel.conversionRate > 0 ? 'text-purple-600 font-medium' : 'text-gray-400'}>
                  {channel.conversionRate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-medium">
            <td className="py-3 px-4 text-gray-900">합계</td>
            <td className="text-right py-3 px-4 text-gray-900">
              {channels.reduce((sum, c) => sum + c.users, 0).toLocaleString()}
            </td>
            <td className="text-right py-3 px-4 text-gray-900">
              {channels.reduce((sum, c) => sum + c.sessions, 0).toLocaleString()}
            </td>
            <td className="text-right py-3 px-4 text-gray-900">
              {channels.reduce((sum, c) => sum + c.submissions, 0).toLocaleString()}
            </td>
            <td className="text-right py-3 px-4 text-green-600">
              {channels.reduce((sum, c) => sum + c.leads, 0).toLocaleString()}
            </td>
            <td className="text-right py-3 px-4 text-gray-900">
              ₩{channels.reduce((sum, c) => sum + c.spend, 0).toLocaleString()}
            </td>
            <td className="text-right py-3 px-4 text-gray-400">-</td>
            <td className="text-right py-3 px-4 text-gray-400">-</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
