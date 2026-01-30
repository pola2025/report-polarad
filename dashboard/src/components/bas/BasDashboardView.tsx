'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  TrendingUp,
  DollarSign,
  Target,
  MousePointerClick,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  Megaphone,
} from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import type {
  MetaPeriodDataResponse,
  MetaKPISummary,
  MetaDailyData,
  MetaWeeklyData,
  MetaMonthlyData,
  MetaAdData,
} from '@/types/meta-analytics'
import type { BasDashboardData } from '@/types/bas-analytics'

// BAS 전용 컴포넌트
import { BasKPICard } from './BasKPICard'
import { BasTrendChart } from './BasTrendChart'
import { BasPlatformChart } from './BasPlatformChart'
import { BasComparisonSection } from './BasComparisonSection'
import { BasExecutiveSummary } from './BasExecutiveSummary'
import { BasAIInsightBox } from './BasAIInsightBox'
import { BasDailyCards } from './BasDailyCards'
import { BasFilterBar } from './BasFilterBar'
import { BasExportButton } from './BasExportButton'
import { BasReportHistory } from './BasReportHistory'

// BAS API
import {
  calculateTrend,
  generateExecutiveSummary,
  generateAIInsightItems,
} from '@/lib/bas-api'

interface BasDashboardViewProps {
  clientSlug: string
  clientName: string
  isAdmin: boolean
  dateRange: { start: string; end: string }
}

// --- 내부 탭 UI ---
type TabId = 'overview' | 'period' | 'ads-detail' | 'reports' | 'ads-management'

interface TabDef {
  id: TabId
  label: string
}

const TABS: TabDef[] = [
  { id: 'overview', label: '개요' },
  { id: 'period', label: '기간별' },
  { id: 'ads-detail', label: '광고상세' },
  { id: 'reports', label: '리포트' },
  { id: 'ads-management', label: '광고관리' },
]

// --- 내부 기간별 데이터 테이블 ---
type ViewMode = 'monthly' | 'weekly' | 'daily'

function PeriodDataSection({
  daily,
  weekly,
  monthly,
}: {
  daily: MetaDailyData[]
  weekly: MetaWeeklyData[]
  monthly: MetaMonthlyData[]
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')

  return (
    <div className="space-y-4">
      {/* 뷰 모드 선택 */}
      <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg w-fit">
        {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === mode
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {mode === 'daily' ? '일별' : mode === 'weekly' ? '주별' : '월별'}
          </button>
        ))}
      </div>

      {/* 데이터 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">기간</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">노출수</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">클릭수</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">CTR</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">지출</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">리드</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">CPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {viewMode === 'daily' &&
                [...daily].reverse().map((d) => (
                  <tr key={d.date} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{d.date}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(d.impressions)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(d.clicks)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{d.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right text-blue-600">${d.spend.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{d.leads}</td>
                    <td className="px-4 py-3 text-right text-purple-600">
                      {d.leads > 0 ? `$${d.cpl.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              {viewMode === 'weekly' &&
                [...weekly].reverse().map((w) => (
                  <tr key={w.week_label} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{w.week_label}</div>
                      <div className="text-xs text-gray-400">{w.week_start} ~ {w.week_end}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{formatNumber(w.impressions)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(w.clicks)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{w.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right text-blue-600">${w.spend.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{w.leads}</td>
                    <td className="px-4 py-3 text-right text-purple-600">
                      {w.leads > 0 ? `$${w.cpl.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              {viewMode === 'monthly' &&
                [...monthly].reverse().map((m) => (
                  <tr key={m.month} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{m.month_label}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(m.impressions)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(m.clicks)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{m.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right text-blue-600">${m.spend.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{m.leads}</td>
                    <td className="px-4 py-3 text-right text-purple-600">
                      {m.leads > 0 ? `$${m.cpl.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// --- 광고 상세 테이블 ---
type SortField = 'ad_name' | 'impressions' | 'clicks' | 'ctr' | 'spend' | 'leads' | 'cpl' | 'avg_watch_time' | 'days_count'
type SortDir = 'asc' | 'desc'

function AdsDetailSection({ ads }: { ads: MetaAdData[] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortedAds = useMemo(() => {
    let result = ads
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (ad) =>
          ad.ad_name.toLowerCase().includes(term) ||
          (ad.campaign_name && ad.campaign_name.toLowerCase().includes(term))
      )
    }
    return [...result].sort((a, b) => {
      const aVal = a[sortField] ?? 0
      const bVal = b[sortField] ?? 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
    })
  }, [ads, searchTerm, sortField, sortDir])

  const totals = useMemo(() => {
    const totalImpressions = sortedAds.reduce((s, a) => s + a.impressions, 0)
    const totalClicks = sortedAds.reduce((s, a) => s + a.clicks, 0)
    const totalSpend = sortedAds.reduce((s, a) => s + a.spend, 0)
    const totalLeads = sortedAds.reduce((s, a) => s + a.leads, 0)
    const watchTimeAds = sortedAds.filter((a) => a.avg_watch_time && a.avg_watch_time > 0)
    const avgWatchTime = watchTimeAds.length > 0
      ? watchTimeAds.reduce((s, a) => s + (a.avg_watch_time || 0), 0) / watchTimeAds.length
      : 0
    return {
      impressions: totalImpressions,
      clicks: totalClicks,
      spend: totalSpend,
      leads: totalLeads,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      avgWatchTime,
    }
  }, [sortedAds])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const formatWatchTime = (seconds: number | undefined) => {
    if (!seconds) return '-'
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    return `${Math.floor(seconds / 60)}:${Math.round(seconds % 60).toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* 검색 */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="광고 또는 캠페인 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      {/* 모바일: 정렬 선택 */}
      <div className="flex items-center gap-2 md:hidden">
        <span className="text-xs text-gray-500">정렬:</span>
        <select
          value={sortField}
          onChange={(e) => { setSortField(e.target.value as SortField); setSortDir('desc') }}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="spend">지출</option>
          <option value="leads">리드</option>
          <option value="cpl">CPL</option>
          <option value="avg_watch_time">시청시간</option>
          <option value="impressions">노출수</option>
          <option value="clicks">클릭수</option>
          <option value="ctr">CTR</option>
        </select>
        <button
          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        >
          {sortDir === 'desc' ? '높은순' : '낮은순'}
        </button>
      </div>

      {/* 모바일: 합계 요약 카드 */}
      {sortedAds.length > 0 && (
        <div className="grid grid-cols-4 gap-2 md:hidden">
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="text-[10px] text-blue-500">지출</div>
            <div className="text-xs font-bold text-blue-700">${totals.spend.toFixed(0)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">리드</div>
            <div className="text-xs font-bold text-gray-800">{totals.leads}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-2 text-center">
            <div className="text-[10px] text-purple-500">CPL</div>
            <div className="text-xs font-bold text-purple-700">{totals.leads > 0 ? `$${totals.cpl.toFixed(0)}` : '-'}</div>
          </div>
          <div className="bg-pink-50 rounded-lg p-2 text-center">
            <div className="text-[10px] text-pink-500">시청시간</div>
            <div className="text-xs font-bold text-pink-700">{formatWatchTime(totals.avgWatchTime || undefined)}</div>
          </div>
        </div>
      )}

      {/* 모바일: 카드 리스트 */}
      <div className="space-y-2 md:hidden">
        {sortedAds.map((ad, index) => (
          <div key={ad.ad_id} className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-start gap-2 mb-2">
              <span className="text-gray-400 text-xs mt-0.5">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-gray-900 truncate">{ad.ad_name}</div>
                {ad.campaign_name && (
                  <div className="text-xs text-gray-400 truncate">{ad.campaign_name}</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <div className="text-[10px] text-gray-400">지출</div>
                <div className="text-xs font-semibold text-blue-600">${ad.spend.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">리드</div>
                <div className="text-xs font-semibold">{ad.leads}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">CPL</div>
                <div className="text-xs font-semibold text-purple-600">{ad.leads > 0 ? `$${ad.cpl.toFixed(0)}` : '-'}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">시청시간</div>
                <div className="text-xs font-semibold text-pink-600">{formatWatchTime(ad.avg_watch_time)}</div>
              </div>
            </div>
            <div className="flex gap-3 mt-1.5 pt-1.5 border-t border-gray-100">
              <span className="text-[10px] text-gray-400">노출 {formatNumber(ad.impressions)}</span>
              <span className="text-[10px] text-gray-400">클릭 {formatNumber(ad.clicks)}</span>
              <span className="text-[10px] text-green-600">CTR {ad.ctr.toFixed(2)}%</span>
              <span className="text-[10px] text-gray-400">{ad.days_count}일</span>
            </div>
          </div>
        ))}
        {sortedAds.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            {searchTerm ? '검색 결과가 없습니다.' : '데이터가 없습니다.'}
          </div>
        )}
      </div>

      {/* 데스크탑: 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden md:block">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-500 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('ad_name')}>
                  <div className="flex items-center gap-1">광고 <SortIcon field="ad_name" /></div>
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('impressions')}>
                  <div className="flex items-center justify-end gap-1">노출수 <SortIcon field="impressions" /></div>
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('clicks')}>
                  <div className="flex items-center justify-end gap-1">클릭수 <SortIcon field="clicks" /></div>
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('ctr')}>
                  <div className="flex items-center justify-end gap-1">CTR <SortIcon field="ctr" /></div>
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('spend')}>
                  <div className="flex items-center justify-end gap-1">지출 <SortIcon field="spend" /></div>
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('leads')}>
                  <div className="flex items-center justify-end gap-1">리드 <SortIcon field="leads" /></div>
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('cpl')}>
                  <div className="flex items-center justify-end gap-1">CPL <SortIcon field="cpl" /></div>
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('avg_watch_time')}>
                  <div className="flex items-center justify-end gap-1">시청시간 <SortIcon field="avg_watch_time" /></div>
                </th>
                <th className="px-3 py-3 text-right font-medium text-gray-500">기간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedAds.map((ad, index) => (
                <tr key={ad.ad_id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">{index + 1}</span>
                      <Megaphone className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[200px]" title={ad.ad_name}>{ad.ad_name}</div>
                        {ad.campaign_name && (
                          <div className="text-xs text-gray-400 truncate max-w-[200px]" title={ad.campaign_name}>{ad.campaign_name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">{formatNumber(ad.impressions)}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(ad.clicks)}</td>
                  <td className="px-3 py-3 text-right text-green-600">{ad.ctr.toFixed(2)}%</td>
                  <td className="px-3 py-3 text-right text-blue-600 font-medium">${ad.spend.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{ad.leads}</td>
                  <td className="px-3 py-3 text-right text-purple-600">
                    {ad.leads > 0 ? `$${ad.cpl.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-3 py-3 text-right text-pink-600">
                    {formatWatchTime(ad.avg_watch_time)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-500 text-xs">{ad.days_count}일</td>
                </tr>
              ))}
              {sortedAds.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    {searchTerm ? '검색 결과가 없습니다.' : '데이터가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
            {sortedAds.length > 0 && (
              <tfoot className="bg-gray-100 border-t-2 border-gray-300 sticky bottom-0">
                <tr className="font-semibold">
                  <td className="px-3 py-3">합계 ({sortedAds.length}개)</td>
                  <td className="px-3 py-3 text-right">{formatNumber(totals.impressions)}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(totals.clicks)}</td>
                  <td className="px-3 py-3 text-right text-green-600">{totals.ctr.toFixed(2)}%</td>
                  <td className="px-3 py-3 text-right text-blue-600">${totals.spend.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right">{totals.leads}</td>
                  <td className="px-3 py-3 text-right text-purple-600">
                    {totals.leads > 0 ? `$${totals.cpl.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-3 py-3 text-right text-pink-600">
                    {formatWatchTime(totals.avgWatchTime || undefined)}
                  </td>
                  <td className="px-3 py-3 text-right">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// --- 광고 관리 탭 (Meta API effective_status 기반) ---

// 상태 타입
interface AdStatusItem {
  id: string
  name: string
  effective_status: string
  configured_status: string
  is_active: boolean
  status_label: string
}

interface AdSetStatusItem extends AdStatusItem {
  campaign_id: string
  ads: AdStatusItem[]
}

interface CampaignStatusItem extends AdStatusItem {
  adsets: AdSetStatusItem[]
}

interface AdsStatusResponse {
  campaigns: CampaignStatusItem[]
  summary: {
    total_campaigns: number
    active_campaigns: number
    total_adsets: number
    active_adsets: number
    total_ads: number
    active_ads: number
  }
}

// ON/OFF 배지
function StatusBadge({ isActive, label }: { isActive: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isActive
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-600'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-400'}`} />
      {isActive ? 'ON' : 'OFF'}
      {!isActive && label !== '일시중지' && (
        <span className="text-red-400 ml-0.5">({label})</span>
      )}
    </span>
  )
}

function AdsManagementSection({ clientSlug }: { clientSlug: string }) {
  const [statusData, setStatusData] = useState<AdsStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'inactive'>('all')

  // Meta API에서 실시간 상태 조회
  useEffect(() => {
    async function loadStatus() {
      setStatusLoading(true)
      setStatusError(null)
      try {
        const res = await fetch(`/api/meta/ads-status?clientSlug=${clientSlug}`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || '상태 조회 실패')
        }
        const data: AdsStatusResponse = await res.json()
        setStatusData(data)
        // 활성 캠페인은 기본 펼침
        const activeIds = new Set(
          data.campaigns.filter((c) => c.is_active).map((c) => c.id)
        )
        setExpandedCampaigns(activeIds)
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : '알 수 없는 오류')
      } finally {
        setStatusLoading(false)
      }
    }
    loadStatus()
  }, [clientSlug])

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAdset = (id: string) => {
    setExpandedAdsets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 로딩
  if (statusLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin mb-3" />
        <p className="text-sm text-gray-500">Meta API에서 광고 상태를 조회하는 중...</p>
      </div>
    )
  }

  // 에러
  if (statusError || !statusData) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium mb-2">{statusError || '상태 데이터를 불러올 수 없습니다.'}</p>
        <p className="text-sm text-gray-500">Meta API 토큰이 만료되었거나 권한이 부족할 수 있습니다.</p>
      </div>
    )
  }

  const { campaigns, summary } = statusData

  // 필터 적용
  const filteredCampaigns = campaigns.filter((c) => {
    if (filterMode === 'active') return c.is_active
    if (filterMode === 'inactive') return !c.is_active
    return true
  })

  return (
    <div className="space-y-4">
      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{summary.active_campaigns}/{summary.total_campaigns}</div>
          <div className="text-xs text-gray-500 mt-1">캠페인</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{summary.active_adsets}/{summary.total_adsets}</div>
          <div className="text-xs text-gray-500 mt-1">광고세트</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{summary.active_ads}/{summary.total_ads}</div>
          <div className="text-xs text-gray-500 mt-1">광고</div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg w-fit">
        {(['all', 'active', 'inactive'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filterMode === mode
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {mode === 'all' ? '전체' : mode === 'active' ? 'ON' : 'OFF'}
          </button>
        ))}
      </div>

      {/* 캠페인 계층 트리 */}
      <div className="space-y-3">
        {filteredCampaigns.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            {filterMode === 'active' ? '활성 캠페인이 없습니다.' : filterMode === 'inactive' ? '비활성 캠페인이 없습니다.' : '캠페인이 없습니다.'}
          </div>
        )}

        {filteredCampaigns.map((campaign) => {
          const isExpanded = expandedCampaigns.has(campaign.id)
          const activeAdsetCount = campaign.adsets.filter((a) => a.is_active).length
          const totalAdCount = campaign.adsets.reduce((s, a) => s + a.ads.length, 0)
          const activeAdCount = campaign.adsets.reduce(
            (s, a) => s + a.ads.filter((ad) => ad.is_active).length, 0
          )

          return (
            <div key={campaign.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* 캠페인 헤더 */}
              <button
                onClick={() => toggleCampaign(campaign.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0 rotate-90" />
                  )}
                  <Megaphone className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <div className="text-left min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{campaign.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      광고세트 {activeAdsetCount}/{campaign.adsets.length} &middot; 광고 {activeAdCount}/{totalAdCount}
                    </div>
                  </div>
                </div>
                <StatusBadge isActive={campaign.is_active} label={campaign.status_label} />
              </button>

              {/* 광고세트 목록 */}
              {isExpanded && campaign.adsets.length > 0 && (
                <div className="border-t border-gray-100">
                  {campaign.adsets.map((adset) => {
                    const adsetExpanded = expandedAdsets.has(adset.id)
                    const activeAdsInSet = adset.ads.filter((a) => a.is_active).length

                    return (
                      <div key={adset.id}>
                        {/* 광고세트 행 */}
                        <button
                          onClick={() => toggleAdset(adset.id)}
                          className="w-full flex items-center justify-between px-4 py-3 pl-10 hover:bg-gray-50 transition-colors border-b border-gray-50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {adset.ads.length > 0 ? (
                              adsetExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              ) : (
                                <ChevronUp className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 rotate-90" />
                              )
                            ) : (
                              <span className="w-3.5" />
                            )}
                            <div className="text-left min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate">{adset.name}</div>
                              <div className="text-xs text-gray-400">
                                광고 {activeAdsInSet}/{adset.ads.length}
                              </div>
                            </div>
                          </div>
                          <StatusBadge isActive={adset.is_active} label={adset.status_label} />
                        </button>

                        {/* 광고 목록 */}
                        {adsetExpanded && adset.ads.length > 0 && (
                          <div className="bg-gray-50">
                            {adset.ads.map((ad) => (
                              <div
                                key={ad.id}
                                className="flex items-center justify-between px-4 py-2.5 pl-16 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="text-sm text-gray-700 truncate min-w-0 flex-1">
                                  {ad.name}
                                </div>
                                <StatusBadge isActive={ad.is_active} label={ad.status_label} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 빈 캠페인 */}
              {isExpanded && campaign.adsets.length === 0 && (
                <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-400 pl-10">
                  광고세트가 없습니다.
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================
// 메인: BasDashboardView
// =============================
export function BasDashboardView({
  clientSlug,
  clientName,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isAdmin,
  dateRange,
}: BasDashboardViewProps) {
  const searchParams = useSearchParams()

  // 데이터 상태
  const [dashData, setDashData] = useState<BasDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // 필터 상태
  const compareMode = (searchParams.get('compare') as 'none' | 'weekly' | 'monthly') || 'none'
  const startDate = searchParams.get('start') || dateRange.start
  const endDate = searchParams.get('end') || dateRange.end

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 현재 기간 데이터 fetch
      const params = new URLSearchParams({ clientSlug, startDate, endDate })
      const res = await fetch(`/api/meta/analytics?${params}`)
      if (!res.ok) throw new Error('데이터를 불러오는데 실패했습니다')
      const data: MetaPeriodDataResponse = await res.json()

      // 스파크라인 데이터 계산
      const recentDaily = data.daily.slice(-14)
      const sparklineData = {
        leads: recentDaily.map((d) => d.leads),
        spend: recentDaily.map((d) => d.spend),
        cpl: recentDaily.map((d) => d.cpl),
        ctr: recentDaily.map((d) => d.ctr),
      }

      // 비교 데이터
      let comparisonSummary: MetaKPISummary | null = null
      let comparisonPeriod: BasDashboardData['comparisonPeriod'] = null

      if (compareMode !== 'none') {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const diffMs = end.getTime() - start.getTime()
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        const daysToSubtract = compareMode === 'weekly' ? 7 : diffDays

        const compStart = new Date(start)
        compStart.setDate(compStart.getDate() - daysToSubtract)
        const compEnd = new Date(end)
        compEnd.setDate(compEnd.getDate() - daysToSubtract)

        const formatDate = (d: Date) => d.toISOString().split('T')[0]

        try {
          const compParams = new URLSearchParams({
            clientSlug,
            startDate: formatDate(compStart),
            endDate: formatDate(compEnd),
          })
          const compRes = await fetch(`/api/meta/analytics?${compParams}`)
          if (compRes.ok) {
            const compData: MetaPeriodDataResponse = await compRes.json()
            comparisonSummary = compData.summary
            comparisonPeriod = {
              current: `${startDate} ~ ${endDate}`,
              previous: `${formatDate(compStart)} ~ ${formatDate(compEnd)}`,
            }
          }
        } catch {
          // 비교 데이터 실패 시 무시
        }
      }

      setDashData({
        summary: data.summary,
        daily: data.daily,
        weekly: data.weekly,
        monthly: data.monthly,
        ads: data.ads,
        sparklineData,
        comparisonSummary,
        comparisonPeriod,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }, [clientSlug, startDate, endDate, compareMode])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 탭 변경 핸들러
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
  }

  // 로딩 상태
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">{clientName} 대시보드</h1>
                <p className="text-amber-100 text-sm mt-1">BAS Meta Ads Analytics</p>
              </div>
            </div>
          </div>
        </div>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-4" />
            <p className="text-gray-500">데이터를 불러오는 중...</p>
          </div>
        </main>
      </div>
    )
  }

  // 에러 상태
  if (error || !dashData) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-xl sm:text-2xl font-bold">{clientName} 대시보드</h1>
          </div>
        </div>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-20">
            <p className="text-red-600 font-medium">{error || '데이터를 불러올 수 없습니다.'}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </main>
      </div>
    )
  }

  const {
    summary,
    daily,
    weekly,
    monthly,
    ads,
    sparklineData,
    comparisonSummary,
    comparisonPeriod,
  } = dashData

  // 경영 요약
  const executiveSummary = generateExecutiveSummary(summary, daily, ads)
  const aiInsight = generateAIInsightItems(summary, daily, ads)

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 헤더 - 황금색 배경 */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{clientName} 대시보드</h1>
              <p className="text-amber-100 text-sm mt-1">
                {summary.date_range.start} ~ {summary.date_range.end}
                {' '}({summary.data_days}일간)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <BasExportButton
                data={{
                  summary,
                  daily,
                  ads,
                  dateRange: { start: startDate, end: endDate },
                }}
                disabled={loading}
              />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          {/* BAS 필터 바 */}
          <BasFilterBar compareMode={compareMode} />

          {/* 경영 요약 */}
          <BasExecutiveSummary
            highlights={executiveSummary.highlights}
            warnings={executiveSummary.warnings}
            actions={executiveSummary.actions}
            summaryText={executiveSummary.summaryText}
          />

          {/* 일별 성과 카드 */}
          {daily.length > 0 && (
            <BasDailyCards
              data={daily.map((d) => ({
                date: d.date,
                leads: d.leads,
                cpl: d.cpl,
                spend: d.spend,
                clicks: d.clicks,
              }))}
            />
          )}

          {/* KPI 카드 영역 */}
          <section>
            <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4">주요 지표</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
              <BasKPICard
                title="총 리드"
                value={summary.total_leads}
                icon={Target}
                format="number"
                trend={calculateTrend(summary.total_leads, comparisonSummary?.total_leads)}
                sparklineData={sparklineData.leads}
                colorScheme="blue"
              />
              <BasKPICard
                title="총 지출"
                value={summary.total_spend}
                icon={DollarSign}
                format="currency"
                trend={calculateTrend(summary.total_spend, comparisonSummary?.total_spend)}
                sparklineData={sparklineData.spend}
                colorScheme="purple"
              />
              <BasKPICard
                title="리드당 가격"
                value={summary.avg_cpl}
                icon={TrendingUp}
                format="currency"
                trend={calculateTrend(summary.avg_cpl, comparisonSummary?.avg_cpl)}
                target={20}
                sparklineData={sparklineData.cpl}
                colorScheme="orange"
              />
              <BasKPICard
                title="평균 CTR"
                value={summary.avg_ctr}
                icon={MousePointerClick}
                format="percentage"
                trend={calculateTrend(summary.avg_ctr, comparisonSummary?.avg_ctr)}
                sparklineData={sparklineData.ctr}
                colorScheme="green"
              />
              <BasKPICard
                title="평균 시청시간"
                value={
                  summary.avg_watch_time
                    ? summary.avg_watch_time < 60
                      ? `${summary.avg_watch_time.toFixed(1)}s`
                      : `${Math.floor(summary.avg_watch_time / 60)}:${Math.round(summary.avg_watch_time % 60).toString().padStart(2, '0')}`
                    : '-'
                }
                icon={Clock}
                format="number"
                trend={calculateTrend(summary.avg_watch_time || 0, comparisonSummary?.avg_watch_time)}
                colorScheme="pink"
              />
            </div>
          </section>

          {/* 비교 분석 섹션 */}
          {compareMode !== 'none' && comparisonSummary && comparisonPeriod && (
            <BasComparisonSection
              current={summary}
              previous={comparisonSummary}
              currentPeriod={comparisonPeriod.current}
              previousPeriod={comparisonPeriod.previous}
              mode={compareMode as 'weekly' | 'monthly'}
            />
          )}

          {/* 탭 영역 */}
          <section>
            {/* 탭 네비게이션 */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-amber-500 text-amber-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* 탭 콘텐츠 */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 차트 영역 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <BasTrendChart data={daily} />
                  <BasPlatformChart
                    ads={ads}
                    dateRange={{ start: startDate, end: endDate }}
                  />
                </div>

                {/* AI 인사이트 */}
                {summary.total_leads > 0 && (
                  <BasAIInsightBox
                    summaryItems={aiInsight.summaryItems}
                    actionItems={aiInsight.actionItems}
                  />
                )}
              </div>
            )}

            {activeTab === 'period' && (
              <PeriodDataSection
                daily={daily}
                weekly={weekly}
                monthly={monthly}
              />
            )}

            {activeTab === 'ads-detail' && (
              <AdsDetailSection ads={ads} />
            )}

            {activeTab === 'reports' && (
              <BasReportHistory clientSlug={clientSlug} />
            )}

            {activeTab === 'ads-management' && (
              <AdsManagementSection clientSlug={clientSlug} />
            )}
          </section>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="mt-12 py-8 md:py-12 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between md:gap-6">
            <div className="text-xs md:text-sm text-gray-500 order-2 md:order-1">
              &copy; {new Date().getFullYear()} POLAR AD. All rights reserved.
            </div>
            <div className="flex flex-col items-center gap-1 md:flex-row md:gap-4 text-xs md:text-sm text-gray-500 order-1 md:order-2">
              <span>문의: mkt@polarad.co.kr</span>
              <span className="hidden md:inline text-gray-300">|</span>
              <span>
                데이터 기간: {summary.date_range.start} ~ {summary.date_range.end}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
