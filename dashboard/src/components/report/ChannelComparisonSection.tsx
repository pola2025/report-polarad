'use client'

import { Card } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface MetaCampaign {
  campaign_name: string
  impressions: number
  clicks: number
  leads: number
  spend: number
  ctr: number
  cpl: number
}

interface NaverKeyword {
  keyword: string
  impressions: number
  clicks: number
  totalCost: number
  ctr: number
  avgCpc: number
  avgRank: number
}

interface ChannelComparisonSectionProps {
  metaCampaigns: MetaCampaign[]
  naverKeywords: NaverKeyword[]
  usdToKrw?: number
}

const COLORS = {
  meta: '#1877F2',
  naver: '#03C75A',
}

export function ChannelComparisonSection({
  metaCampaigns,
  naverKeywords,
  usdToKrw = 1500,
}: ChannelComparisonSectionProps) {
  // Meta 합계 계산
  const metaTotal = {
    impressions: metaCampaigns.reduce((sum, c) => sum + c.impressions, 0),
    clicks: metaCampaigns.reduce((sum, c) => sum + c.clicks, 0),
    leads: metaCampaigns.reduce((sum, c) => sum + c.leads, 0),
    spend: metaCampaigns.reduce((sum, c) => sum + c.spend, 0) * usdToKrw,
    ctr: 0,
    cpc: 0,
  }
  metaTotal.ctr = metaTotal.impressions > 0 ? (metaTotal.clicks / metaTotal.impressions) * 100 : 0
  metaTotal.cpc = metaTotal.clicks > 0 ? metaTotal.spend / metaTotal.clicks : 0

  // 네이버 합계 계산
  const naverTotal = {
    impressions: naverKeywords.reduce((sum, k) => sum + k.impressions, 0),
    clicks: naverKeywords.reduce((sum, k) => sum + k.clicks, 0),
    spend: naverKeywords.reduce((sum, k) => sum + k.totalCost, 0),
    ctr: 0,
    cpc: 0,
  }
  naverTotal.ctr = naverTotal.impressions > 0 ? (naverTotal.clicks / naverTotal.impressions) * 100 : 0
  naverTotal.cpc = naverTotal.clicks > 0 ? naverTotal.spend / naverTotal.clicks : 0

  // 총합
  const totalSpend = metaTotal.spend + naverTotal.spend
  const metaRatio = totalSpend > 0 ? (metaTotal.spend / totalSpend) * 100 : 0
  const naverRatio = 100 - metaRatio

  // 도넛 차트 데이터
  const pieData = [
    { name: 'Meta', value: metaTotal.spend, color: COLORS.meta },
    { name: '네이버', value: naverTotal.spend, color: COLORS.naver },
  ]

  // 데이터가 없으면 렌더링하지 않음
  if (metaCampaigns.length === 0 && naverKeywords.length === 0) {
    return null
  }

  return (
    <Card className="p-4 md:p-6 mb-6">
      <div className="flex items-center gap-2 text-base md:text-lg font-bold text-gray-800 mb-4 md:mb-6">
        <span>📊</span>
        <span>채널별 성과 분석</span>
      </div>

      {/* 모바일: 수평 바 차트 + 카드 */}
      <div className="md:hidden space-y-4">
        {/* 수평 바 차트 (지출 비율) */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">총 지출</span>
            <span className="text-sm font-bold text-gray-900">
              {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(totalSpend)}
            </span>
          </div>
          <div className="space-y-3">
            {/* Meta 바 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium" style={{ color: COLORS.meta }}>🔵 Meta</span>
                <span className="text-xs text-gray-600">{formatNumber(metaTotal.spend)}원 ({metaRatio.toFixed(0)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="h-2.5 rounded-full" style={{ width: `${metaRatio}%`, backgroundColor: COLORS.meta }}></div>
              </div>
            </div>
            {/* 네이버 바 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium" style={{ color: COLORS.naver }}>🟢 네이버</span>
                <span className="text-xs text-gray-600">{formatNumber(naverTotal.spend)}원 ({naverRatio.toFixed(0)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="h-2.5 rounded-full" style={{ width: `${naverRatio}%`, backgroundColor: COLORS.naver }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 채널별 카드 */}
        <div className="grid grid-cols-2 gap-3">
          {/* Meta 카드 */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold" style={{ color: COLORS.meta }}>🔵 Meta</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">노출</span>
                <span className="font-medium">{formatNumber(metaTotal.impressions)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">클릭</span>
                <span className="font-medium">{formatNumber(metaTotal.clicks)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">CTR</span>
                <span className="font-medium">{metaTotal.ctr.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">CPC</span>
                <span className="font-medium">{formatNumber(metaTotal.cpc)}원</span>
              </div>
            </div>
          </div>
          {/* 네이버 카드 */}
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold" style={{ color: COLORS.naver }}>🟢 네이버</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">노출</span>
                <span className="font-medium">{formatNumber(naverTotal.impressions)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">클릭</span>
                <span className="font-medium">{formatNumber(naverTotal.clicks)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">CTR</span>
                <span className="font-medium">{naverTotal.ctr.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">CPC</span>
                <span className="font-medium">{formatNumber(naverTotal.cpc)}원</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 데스크톱: 도넛 차트 + 테이블 */}
      <div className="hidden md:grid md:grid-cols-2 gap-6">
        {/* 도넛 차트 */}
        <div className="flex flex-col items-center">
          <div className="relative w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value)
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xs text-gray-500">총 지출</div>
                <div className="text-sm font-bold text-gray-800">
                  {new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 0 }).format(totalSpend)}원
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.meta }}></span>
              <span className="text-sm text-gray-600">Meta {metaRatio.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.naver }}></span>
              <span className="text-sm text-gray-600">네이버 {naverRatio.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* 채널 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 text-left font-semibold text-gray-600">채널</th>
                <th className="py-3 px-4 text-right font-semibold text-gray-600">노출수</th>
                <th className="py-3 px-4 text-right font-semibold text-gray-600">클릭수</th>
                <th className="py-3 px-4 text-right font-semibold text-gray-600">CTR</th>
                <th className="py-3 px-4 text-right font-semibold text-gray-600">CPC</th>
              </tr>
            </thead>
            <tbody>
              {/* Meta */}
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(24, 119, 242, 0.1)', color: COLORS.meta }}>
                    🔵 Meta
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="font-medium">{formatNumber(metaTotal.impressions)}</div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="font-medium">{formatNumber(metaTotal.clicks)}</div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="font-medium">{metaTotal.ctr.toFixed(2)}%</div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="font-medium">
                    {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(metaTotal.cpc)}
                  </div>
                </td>
              </tr>
              {/* 네이버 */}
              <tr className="hover:bg-gray-50">
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(3, 199, 90, 0.1)', color: COLORS.naver }}>
                    🟢 네이버
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="font-medium">{formatNumber(naverTotal.impressions)}</div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="font-medium">{formatNumber(naverTotal.clicks)}</div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="font-medium">{naverTotal.ctr.toFixed(2)}%</div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="font-medium">
                    {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(naverTotal.cpc)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 인사이트 */}
      <div className="rounded-lg p-4 mt-4 bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-blue-500">
        <p className="text-gray-700 text-sm">
          💡 <strong>인사이트:</strong>{' '}
          {metaTotal.spend > naverTotal.spend ? (
            <>Meta가 전체 지출의 {metaRatio.toFixed(0)}%를 차지하며, </>
          ) : (
            <>네이버가 전체 지출의 {naverRatio.toFixed(0)}%를 차지하며, </>
          )}
          {metaTotal.ctr > naverTotal.ctr ? (
            <>Meta의 CTR({metaTotal.ctr.toFixed(2)}%)이 네이버({naverTotal.ctr.toFixed(2)}%)보다 높습니다.</>
          ) : (
            <>네이버의 CTR({naverTotal.ctr.toFixed(2)}%)이 Meta({metaTotal.ctr.toFixed(2)}%)보다 높습니다.</>
          )}
          {metaTotal.cpc < naverTotal.cpc && metaTotal.clicks > 0 && naverTotal.clicks > 0 && (
            <> Meta가 클릭당 비용 효율이 더 좋습니다.</>
          )}
          {naverTotal.cpc < metaTotal.cpc && metaTotal.clicks > 0 && naverTotal.clicks > 0 && (
            <> 네이버가 클릭당 비용 효율이 더 좋습니다.</>
          )}
        </p>
      </div>
    </Card>
  )
}
