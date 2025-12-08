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
}

interface MetaCampaignsSectionProps {
  campaigns: CampaignData[]
}

export function MetaCampaignsSection({ campaigns }: MetaCampaignsSectionProps) {
  const sortedCampaigns = [...campaigns].sort((a, b) => b.spend - a.spend)
  const top5 = sortedCampaigns.slice(0, 5)

  const medals = ['🥇', '🥈', '🥉', '4', '5']

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
        <span>📱</span>
        <span>Meta 광고 성과 TOP 5</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 px-3 text-left font-semibold text-gray-600">순위</th>
              <th className="py-3 px-3 text-left font-semibold text-gray-600">광고명</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">노출</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">클릭</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">CTR</th>
              <th className="py-3 px-3 text-right font-semibold text-gray-600">지출</th>
            </tr>
          </thead>
          <tbody>
            {top5.map((campaign, index) => (
              <tr key={campaign.campaign_name} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3">
                  <span className="text-lg">{medals[index]}</span>
                </td>
                <td className="py-3 px-3 font-medium max-w-[200px] truncate" title={campaign.campaign_name}>
                  {campaign.campaign_name}
                </td>
                <td className="py-3 px-3 text-right">{formatNumber(campaign.impressions)}</td>
                <td className="py-3 px-3 text-right">{formatNumber(campaign.clicks)}</td>
                <td className={`py-3 px-3 text-right ${campaign.ctr > 2 ? 'text-green-600' : campaign.ctr < 1.5 ? 'text-red-600' : ''}`}>
                  {formatPercent(campaign.ctr)}
                </td>
                <td className="py-3 px-3 text-right">{formatCurrency(campaign.spend, 'KRW')}</td>
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
