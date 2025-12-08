'use client'

import { Card } from '@/components/ui/card'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils'

interface CampaignData {
  campaign_name: string
  impressions: number
  clicks: number
  leads: number
  spend: number
  ctr: number
  cpl: number
  video_views?: number
  avg_watch_time?: number
}

interface MetaCampaignsSectionProps {
  campaigns: CampaignData[]
}

// 시간 포맷 (초 -> "Xm Ys" 또는 "Xs")
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}초`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`
}

export function MetaCampaignsSection({ campaigns }: MetaCampaignsSectionProps) {
  const sortedCampaigns = [...campaigns].sort((a, b) => b.spend - a.spend)
  const top5 = sortedCampaigns.slice(0, 5)

  const medals = ['🥇', '🥈', '🥉', '4', '5']

  // 전체 합계 계산
  const totals = {
    impressions: campaigns.reduce((sum, c) => sum + c.impressions, 0),
    clicks: campaigns.reduce((sum, c) => sum + c.clicks, 0),
    spend: campaigns.reduce((sum, c) => sum + c.spend, 0),
    ctr: campaigns.length > 0
      ? campaigns.reduce((sum, c) => sum + c.impressions, 0) > 0
        ? (campaigns.reduce((sum, c) => sum + c.clicks, 0) / campaigns.reduce((sum, c) => sum + c.impressions, 0)) * 100
        : 0
      : 0,
    videoViews: campaigns.reduce((sum, c) => sum + (c.video_views || 0), 0),
    avgWatchTime: campaigns.length > 0
      ? campaigns.reduce((sum, c) => sum + (c.avg_watch_time || 0), 0) / campaigns.filter(c => c.avg_watch_time).length || 0
      : 0,
  }

  return (
    <Card className="p-4 md:p-6 mb-6">
      <div className="flex items-center gap-2 text-base md:text-lg font-bold text-gray-800 mb-4">
        <span>📱</span>
        <span>Meta 광고 성과 TOP 5</span>
      </div>

      {/* 모바일: 4x2 카드 그리드 요약 */}
      <div className="md:hidden mb-4">
        <div className="grid grid-cols-4 gap-1.5">
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">노출</p>
            <p className="text-xs font-bold text-gray-800">{formatNumber(totals.impressions)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">클릭</p>
            <p className="text-xs font-bold text-gray-800">{formatNumber(totals.clicks)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">CTR</p>
            <p className={`text-xs font-bold ${totals.ctr > 2 ? 'text-green-600' : 'text-gray-800'}`}>{formatPercent(totals.ctr)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">지출</p>
            <p className="text-xs font-bold text-gray-800">{formatCurrency(totals.spend, 'KRW')}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">영상조회</p>
            <p className="text-xs font-bold text-purple-700">{formatNumber(totals.videoViews)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">평균시청</p>
            <p className="text-xs font-bold text-purple-700">{formatTime(totals.avgWatchTime)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">전환</p>
            <p className="text-xs font-bold text-green-700">{formatNumber(campaigns.reduce((sum, c) => sum + c.leads, 0))}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-500 leading-none mb-1">CPL</p>
            <p className="text-xs font-bold text-green-700">
              {formatCurrency(
                campaigns.reduce((sum, c) => sum + c.leads, 0) > 0
                  ? totals.spend / campaigns.reduce((sum, c) => sum + c.leads, 0)
                  : 0,
                'KRW'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 모바일: TOP 5 캠페인 카드 리스트 */}
      <div className="md:hidden space-y-2">
        {top5.map((campaign, index) => (
          <div key={campaign.campaign_name} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
            <span className="text-lg shrink-0">{medals[index]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 truncate" title={campaign.campaign_name}>
                {campaign.campaign_name}
              </p>
              <p className="text-[10px] text-gray-500">
                {formatCurrency(campaign.spend, 'KRW')} · CTR {formatPercent(campaign.ctr)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 데스크톱: 테이블 */}
      <div
        className="hidden md:block overflow-x-auto -mx-4 px-4"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 px-3 text-left font-semibold text-gray-600 text-sm">순위</th>
              <th className="py-3 px-3 text-left font-semibold text-gray-600 text-sm">광고명</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600 text-sm">노출</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600 text-sm">클릭</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600 text-sm">CTR</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600 text-sm">영상조회</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600 text-sm">평균시청</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600 text-sm">지출</th>
            </tr>
          </thead>
          <tbody>
            {top5.map((campaign, index) => (
              <tr key={campaign.campaign_name} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3">
                  <span className="text-lg">{medals[index]}</span>
                </td>
                <td className="py-3 px-3 font-medium max-w-[200px] truncate text-sm" title={campaign.campaign_name}>
                  {campaign.campaign_name}
                </td>
                <td className="py-3 px-3 text-right text-sm">{formatNumber(campaign.impressions)}</td>
                <td className="py-3 px-3 text-right text-sm">{formatNumber(campaign.clicks)}</td>
                <td className={`py-3 px-3 text-right text-sm ${campaign.ctr > 2 ? 'text-green-600' : campaign.ctr < 1.5 ? 'text-red-600' : ''}`}>
                  {formatPercent(campaign.ctr)}
                </td>
                <td className="py-3 px-3 text-right text-sm text-purple-600">{formatNumber(campaign.video_views || 0)}</td>
                <td className="py-3 px-3 text-right text-sm text-purple-600">{formatTime(campaign.avg_watch_time || 0)}</td>
                <td className="py-3 px-3 text-right text-sm font-medium">{formatCurrency(campaign.spend, 'KRW')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 플랫폼/디바이스 분포 (정적 데이터 - 실제로는 API에서 받아야 함) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">플랫폼별 분포</div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-20 text-sm text-gray-600">Facebook</div>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: '68%', backgroundColor: '#1877F2' }} />
              </div>
              <div className="text-sm font-medium text-gray-700 w-12 text-right">68%</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 text-sm text-gray-600">Instagram</div>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: '32%', background: 'linear-gradient(90deg, #833AB4 0%, #FD1D1D 50%, #F77737 100%)' }}
                />
              </div>
              <div className="text-sm font-medium text-gray-700 w-12 text-right">32%</div>
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">디바이스별 분포</div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-20 text-sm text-gray-600">Mobile</div>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500" style={{ width: '89%' }} />
              </div>
              <div className="text-sm font-medium text-gray-700 w-12 text-right">89%</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 text-sm text-gray-600">Desktop</div>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className="h-full rounded-full bg-gray-500" style={{ width: '11%' }} />
              </div>
              <div className="text-sm font-medium text-gray-700 w-12 text-right">11%</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
