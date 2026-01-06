'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChannelComparisonChart, MetaSummaryCards, KeywordMonthlyTrendChart, MetaDayOfWeekChart, NaverKeywordDonutChart } from '@/components/charts'
import { DailyTrendChart } from '@/components/report'
import { Loader2, BarChart3, DollarSign, Settings } from 'lucide-react'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { NaverPeriodTable } from '@/components/naver/NaverPeriodTable'
import { NaverKeywordTable } from '@/components/naver/NaverKeywordTable'
import { BrandSearchTable } from '@/components/naver/BrandSearchTable'
import { MetaPeriodTable, MetaAdTable } from '@/components/meta'
import { ReportList } from '@/components/report/ReportList'
import type { NaverPeriodDataResponse } from '@/types/naver-analytics'
import type { MetaPeriodDataResponse } from '@/types/meta-analytics'
import type { BrandSearchAPIResponse } from '@/types/brand-search'

interface DashboardData {
  kpi: {
    totalImpressions: number
    previousTotalImpressions: number
    totalClicks: number
    previousTotalClicks: number
    totalSpend: number
    previousTotalSpend: number
    totalLeads: number
    previousTotalLeads: number
    avgCPL: number
    previousAvgCPL: number
  }
  meta: {
    current: { impressions: number; clicks: number; leads: number; spend: number; spend_krw?: number; video_views?: number }
    previous: { impressions: number; clicks: number; leads: number; spend: number; spend_krw?: number; video_views?: number }
  }
  exchange_rate?: number
  naver: {
    current: { impressions: number; clicks: number; spend: number }
    previous: { impressions: number; clicks: number; spend: number }
  }
  dailyTrend: Array<{
    date: string
    meta_impressions: number
    meta_clicks: number
    meta_spend: number
    meta_spend_krw?: number
    meta_leads: number
    naver_impressions: number
    naver_clicks: number
    naver_spend: number
    total_spend_krw?: number
  }>
  period: {
    start: string
    end: string
    label: string
  }
  keywordStats: Array<{
    year_month: string
    keyword: string
    pc_searches: number
    mobile_searches: number
    total_searches: number
  }>
}

interface Client {
  id: string
  client_name: string
  slug: string
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clientSlugFromUrl = searchParams.get('client')
  const tabFromUrl = searchParams.get('tab') as 'summary' | 'meta' | 'naver' | 'reports' | null

  // 관리자 인증 상태
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientSlug, setSelectedClientSlug] = useState<string>('')

  // 실제 사용할 clientSlug (URL 파라미터 또는 관리자가 선택한 것)
  const clientSlug = clientSlugFromUrl || selectedClientSlug
  const isClientView = !!clientSlugFromUrl // URL에서 온 경우만 클라이언트 뷰
  const isAdminView = !clientSlugFromUrl && isAuthenticated // 관리자가 선택한 경우

  const [data, setData] = useState<DashboardData | null>(null)
  const [clientInfo, setClientInfo] = useState<{
    name: string;
    slug: string;
    clientType: string;
    metaMetricType: 'lead' | 'video';
    naverType: 'place' | 'brand_search';
    naver: {
      enabled: boolean;
      type: 'place' | 'brand_search';
      show_keywords: boolean;
      show_detail_tab: boolean;
      fixed_budget: number | null;
    };
    ga: {
      enabled: boolean;
      property_id: string | null;
    };
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metricView, setMetricView] = useState<'impressions' | 'clicks' | 'spend'>('impressions')
  const [activeTab, setActiveTab] = useState<'summary' | 'meta' | 'naver' | 'reports'>(() => {
    const validTabs = ['summary', 'meta', 'naver', 'reports'] as const
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      return tabFromUrl
    }
    return 'summary'
  })

  // 탭 변경 시 URL 업데이트
  const handleTabChange = useCallback((tab: 'summary' | 'meta' | 'naver' | 'reports') => {
    setActiveTab(tab)

    // URL 파라미터 업데이트
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'summary') {
      params.delete('tab') // summary는 기본값이므로 파라미터 제거
    } else {
      params.set('tab', tab)
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '/'
    router.replace(newUrl, { scroll: false })
  }, [searchParams, router])
  const [naverData, setNaverData] = useState<NaverPeriodDataResponse | null>(null)
  const [naverLoading, setNaverLoading] = useState(false)
  const [brandSearchData, setBrandSearchData] = useState<BrandSearchAPIResponse | null>(null)
  const [brandSearchLoading, setBrandSearchLoading] = useState(false)
  const [metaData, setMetaData] = useState<MetaPeriodDataResponse | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)

  // 날짜 범위 상태
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 29)
    const formatDate = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    return { start: formatDate(start), end: formatDate(end) }
  })

  // 관리자 키 확인 및 클라이언트 목록 조회
  const fetchClients = useCallback(async (key: string) => {
    try {
      const response = await fetch('/api/admin/clients', {
        headers: { 'x-admin-key': key },
      })
      if (response.ok) {
        const result = await response.json()
        setClients(result.clients || [])
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  // 초기화: 저장된 관리자 키 확인
  useEffect(() => {
    if (clientSlugFromUrl) {
      // URL에 클라이언트 슬러그가 있으면 바로 로딩
      setLoading(true)
    } else {
      // 관리자 모드: 저장된 키 확인
      const savedKey = localStorage.getItem('polarad_admin_key')
      if (savedKey) {
        setAdminKey(savedKey)
        fetchClients(savedKey).then(success => {
          if (success) {
            setIsAuthenticated(true)
          }
        })
      }
    }
  }, [clientSlugFromUrl, fetchClients])

  // 관리자 로그인
  const handleLogin = async () => {
    const success = await fetchClients(adminKey)
    if (success) {
      localStorage.setItem('polarad_admin_key', adminKey)
      setIsAuthenticated(true)
    } else {
      alert('관리자 키가 올바르지 않습니다.')
    }
  }

  // 클라이언트 정보 조회
  useEffect(() => {
    async function fetchClientInfo() {
      if (!clientSlug) return
      try {
        const res = await fetch(`/api/client?slug=${clientSlug}`)
        const json = await res.json()
        if (json.success && json.client) {
          const defaultNaver = {
            enabled: true,
            type: 'place' as const,
            show_keywords: true,
            show_detail_tab: true,
            fixed_budget: null,
          }
          const defaultGa = {
            enabled: false,
            property_id: null,
          }
          setClientInfo({
            name: json.client.client_name,
            slug: json.client.slug,
            clientType: json.client.client_type || 'general',
            metaMetricType: json.client.meta_metric_type || 'lead',
            naverType: json.client.naver?.type || json.client.naver_type || 'place',
            naver: json.client.naver || defaultNaver,
            ga: json.client.ga || defaultGa,
          })
        } else {
          // API 실패 시에도 기본값으로 설정
          setClientInfo({
            name: clientSlug,
            slug: clientSlug,
            clientType: 'general',
            metaMetricType: 'lead',
            naverType: 'brand_search', // 기본값을 brand_search로 (나라똔 등)
            naver: { enabled: true, type: 'brand_search', show_keywords: true, show_detail_tab: true, fixed_budget: 1320000 },
            ga: { enabled: false, property_id: null },
          })
        }
      } catch {
        setClientInfo({
          name: clientSlug,
          slug: clientSlug,
          clientType: 'general',
          metaMetricType: 'lead',
          naverType: 'place',
          naver: { enabled: true, type: 'place', show_keywords: true, show_detail_tab: true, fixed_budget: null },
          ga: { enabled: false, property_id: null },
        })
      }
    }

    if (clientSlug) {
      fetchClientInfo()
    }
  }, [clientSlug])

  // 대시보드 데이터 조회
  useEffect(() => {
    async function fetchDashboardData() {
      if (!clientSlug) return

      setLoading(true)
      try {
        const res = await fetch(`/api/dashboard?startDate=${dateRange.start}&endDate=${dateRange.end}&client=${clientSlug}`)
        const json = await res.json()
        if (json.success) {
          setData(json)
          setError(null)
        } else {
          setError(json.error || 'Failed to fetch data')
        }
      } catch {
        setError('네트워크 오류가 발생했습니다')
      } finally {
        setLoading(false)
      }
    }

    if (clientSlug) {
      fetchDashboardData()
    }
  }, [dateRange, clientSlug])

  // 네이버 상세 데이터 조회 (탭 전환 시)
  // 기간별 성과는 날짜 범위와 관계없이 현재 연도 전체 데이터 표시
  useEffect(() => {
    async function fetchNaverData() {
      if (activeTab !== 'naver' || !clientSlug || !data) return

      setNaverLoading(true)
      try {
        // 전체 데이터 조회 (기간별 성과에서 모든 월 표시)
        // 날짜 범위를 넓게 설정하여 모든 데이터 포함
        const params = new URLSearchParams({
          clientSlug,
          startDate: '2024-01-01',
          endDate: '2026-12-31',
        })
        const res = await fetch(`/api/naver/analytics?${params}`)
        const json = await res.json()
        if (!json.error) {
          setNaverData(json)
        }
      } catch (err) {
        console.error('네이버 데이터 조회 실패:', err)
      } finally {
        setNaverLoading(false)
      }
    }

    fetchNaverData()
  }, [activeTab, clientSlug, data])

  // 브랜드검색 데이터 조회 (탭 전환 시 또는 날짜 변경 시)
  useEffect(() => {
    async function fetchBrandSearchData() {
      // 브랜드검색 타입이 아니면 스킵 (통합 요약, 네이버 탭 모두에서 조회)
      if (!clientSlug || !clientInfo || clientInfo.naverType !== 'brand_search') return

      setBrandSearchLoading(true)
      try {
        // clientInfo에서 id를 가져와야 함
        const clientRes = await fetch(`/api/client?slug=${clientSlug}`)
        const clientJson = await clientRes.json()
        if (!clientJson.success || !clientJson.client) return

        const params = new URLSearchParams({
          clientId: clientJson.client.id,
          startDate: dateRange.start,
          endDate: dateRange.end,
        })
        const res = await fetch(`/api/naver/brand-search?${params}`)
        const json = await res.json()
        if (json.success) {
          setBrandSearchData(json)
        }
      } catch (err) {
        console.error('브랜드검색 데이터 조회 실패:', err)
      } finally {
        setBrandSearchLoading(false)
      }
    }

    fetchBrandSearchData()
  }, [activeTab, clientSlug, clientInfo, dateRange])

  // Meta 상세 데이터 조회 (탭 전환 시)
  // 기간별 성과는 날짜 범위와 관계없이 전체 데이터 표시
  useEffect(() => {
    async function fetchMetaData() {
      if (activeTab !== 'meta' || !clientSlug || !data) return

      setMetaLoading(true)
      try {
        // 전체 데이터 조회 (기간별 성과에서 모든 월 표시)
        const params = new URLSearchParams({
          clientSlug,
          startDate: '2024-01-01',
          endDate: '2026-12-31',
        })
        const res = await fetch(`/api/meta/analytics?${params}`)
        const json = await res.json()
        if (!json.error) {
          setMetaData(json)
        }
      } catch (err) {
        console.error('Meta 데이터 조회 실패:', err)
      } finally {
        setMetaLoading(false)
      }
    }

    fetchMetaData()
  }, [activeTab, clientSlug, data])

  // 관리자 로그인 화면 (URL에 클라이언트 슬러그 없고, 인증 안 됨)
  if (!clientSlugFromUrl && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Image
                src="/images/logo.png"
                alt="Polarad"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <CardTitle>Polarad Report 관리자</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="관리자 키 입력"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-[#F5A623] focus:border-transparent"
              />
              <Button onClick={handleLogin} className="w-full bg-[#F5A623] hover:bg-[#E09000]">
                로그인
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 관리자: 클라이언트 선택 화면
  if (!clientSlugFromUrl && isAuthenticated && !selectedClientSlug) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-[#F5A623] border-b border-[#E09000]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Image
                  src="/images/logo.png"
                  alt="Polarad"
                  width={48}
                  height={48}
                  className="rounded-lg"
                />
                <div>
                  <h1 className="text-xl font-bold text-white">Polarad Report</h1>
                  <p className="text-sm text-white/80">관리자 모드</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/admin')}
                className="text-white hover:bg-white/20"
              >
                <Settings className="h-5 w-5 mr-2" />
                관리
              </Button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardHeader>
              <CardTitle>클라이언트 선택</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientSlug(client.slug)}
                    className="p-4 border rounded-lg hover:bg-gray-50 hover:border-[#F5A623] transition-colors text-left"
                  >
                    <div className="font-medium">{client.client_name}</div>
                    <div className="text-sm text-gray-500">{client.slug}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // 탭이 보여야 하는 조건: 클라이언트 뷰 또는 관리자가 클라이언트를 선택한 경우
  const showTabs = isClientView || isAdminView

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#F5A623] border-b border-[#E09000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
          {/* 모바일: 2줄 레이아웃 */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/images/logo.png"
                  alt="Polarad"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
                <div>
                  <h1 className="text-lg font-bold text-white whitespace-nowrap">Polarad Report</h1>
                  <p className="text-xs text-white/80 whitespace-nowrap">폴라애드 공식 광고 성과 리포트</p>
                </div>
              </div>
              <div className="text-xs font-medium text-white bg-white/20 px-2 py-1 rounded-full whitespace-nowrap">
                {clientInfo?.name || clientSlug}
              </div>
            </div>
            <div className="flex items-center justify-between">
              {isAdminView && (
                <button
                  onClick={() => {
                    setSelectedClientSlug('')
                    setData(null)
                    setActiveTab('summary')
                  }}
                  className="text-xs text-white/80 hover:text-white underline whitespace-nowrap"
                >
                  클라이언트 변경
                </button>
              )}
              <div className={isAdminView ? '' : 'ml-auto'}>
                <DateRangePicker
                  startDate={dateRange.start}
                  endDate={dateRange.end}
                  onDateChange={(start, end) => setDateRange({ start, end })}
                />
              </div>
            </div>
          </div>

          {/* 데스크톱: 1줄 레이아웃 */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/images/logo.png"
                alt="Polarad"
                width={48}
                height={48}
                className="rounded-lg"
              />
              <div>
                <h1 className="text-xl font-bold text-white">Polarad Report</h1>
                <p className="text-sm text-white/80">폴라애드 공식 광고 성과 리포트</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isAdminView && (
                <button
                  onClick={() => {
                    setSelectedClientSlug('')
                    setData(null)
                    setActiveTab('summary')
                  }}
                  className="text-sm text-white/80 hover:text-white underline"
                >
                  클라이언트 변경
                </button>
              )}
              <DateRangePicker
                startDate={dateRange.start}
                endDate={dateRange.end}
                onDateChange={(start, end) => setDateRange({ start, end })}
              />
              <div className="text-sm font-medium text-white bg-white/20 px-3 py-1.5 rounded-full">
                {clientInfo?.name || clientSlug}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#F5A623]" />
            <span className="ml-2 text-gray-600">데이터를 불러오는 중...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        ) : data ? (
          <>
            {/* 탭 네비게이션 */}
            {showTabs && (
              <div className="grid grid-cols-4 gap-1 border-b border-gray-200 mb-6">
                <button
                  onClick={() => handleTabChange('summary')}
                  className={`px-2 md:px-4 py-2 text-xs md:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                    activeTab === 'summary'
                      ? 'bg-white text-[#F5A623] border-b-2 border-[#F5A623]'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  통합 요약
                </button>
                <button
                  onClick={() => handleTabChange('meta')}
                  className={`px-2 md:px-4 py-2 text-xs md:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                    activeTab === 'meta'
                      ? 'bg-white text-[#F5A623] border-b-2 border-[#F5A623]'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Meta 상세
                </button>
                {/* 네이버 상세 탭 - show_detail_tab이 true일 때만 표시 */}
                {clientInfo?.naver?.show_detail_tab !== false && (
                  <button
                    onClick={() => handleTabChange('naver')}
                    className={`px-2 md:px-4 py-2 text-xs md:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                      activeTab === 'naver'
                        ? 'bg-white text-[#F5A623] border-b-2 border-[#F5A623]'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    네이버 상세
                  </button>
                )}
                <button
                  onClick={() => handleTabChange('reports')}
                  className={`px-2 md:px-4 py-2 text-xs md:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                    activeTab === 'reports'
                      ? 'bg-white text-[#F5A623] border-b-2 border-[#F5A623]'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  리포트
                </button>
              </div>
            )}

            {/* 통합 요약 탭 */}
            {activeTab === 'summary' && (
            <>
            {/* KPI Cards */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">통합 KPI 요약</h2>
                <p className="text-sm text-gray-500">
                  {data.period.start} ~ {data.period.end}
                </p>
              </div>

              {/* 모바일: 총 지출액 상단 + 2x2 그리드 */}
              <div className="md:hidden space-y-3">
                {/* 총 지출액 - 전체 너비 */}
                <KPICard
                  title="총 지출액"
                  value={data.kpi.totalSpend + (clientInfo?.naverType === 'brand_search' ? (brandSearchData?.data?.fixed_budget?.total || 0) : 0)}
                  previousValue={data.kpi.previousTotalSpend}
                  format="currencyKRW"
                />
                {/* 나머지 4개 - 2x2 그리드 */}
                <div className="grid grid-cols-2 gap-3">
                  <KPICard
                    title="총 노출수"
                    value={data.kpi.totalImpressions + (clientInfo?.naverType === 'brand_search' ? (brandSearchData?.data?.summary?.total_impressions || 0) : 0)}
                    previousValue={data.kpi.previousTotalImpressions}
                  />
                  <KPICard
                    title="총 클릭수"
                    value={data.kpi.totalClicks + (clientInfo?.naverType === 'brand_search' ? (brandSearchData?.data?.summary?.total_clicks || 0) : 0)}
                    previousValue={data.kpi.previousTotalClicks}
                  />
                  <KPICard
                    title="Meta 클릭수"
                    value={data.meta.current.clicks}
                    previousValue={data.meta.previous.clicks}
                  />
                  <KPICard
                    title="평균 CPC"
                    value={(() => {
                      const totalClicks = data.kpi.totalClicks + (clientInfo?.naverType === 'brand_search' ? (brandSearchData?.data?.summary?.total_clicks || 0) : 0)
                      const totalSpend = data.kpi.totalSpend + (clientInfo?.naverType === 'brand_search' ? (brandSearchData?.data?.fixed_budget?.total || 0) : 0)
                      return totalClicks > 0 ? totalSpend / totalClicks : 0
                    })()}
                    previousValue={data.meta.previous.clicks > 0 ? data.meta.previous.spend / data.meta.previous.clicks : 0}
                    format="currencyKRW"
                  />
                </div>
              </div>

              {/* 데스크톱: 기존 5열 그리드 */}
              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard
                  title="총 노출수"
                  value={data.kpi.totalImpressions + (clientInfo?.naverType === 'brand_search' ? (brandSearchData?.data?.summary?.total_impressions || 0) : 0)}
                  previousValue={data.kpi.previousTotalImpressions}
                />
                <KPICard
                  title="총 클릭수"
                  value={data.kpi.totalClicks + (clientInfo?.naverType === 'brand_search' ? (brandSearchData?.data?.summary?.total_clicks || 0) : 0)}
                  previousValue={data.kpi.previousTotalClicks}
                />
                <KPICard
                  title="총 지출액"
                  value={data.kpi.totalSpend + (clientInfo?.naverType === 'brand_search' ? (brandSearchData?.data?.fixed_budget?.total || 0) : 0)}
                  previousValue={data.kpi.previousTotalSpend}
                  format="currencyKRW"
                />
                <KPICard
                  title="Meta 클릭수"
                  value={data.meta.current.clicks}
                  previousValue={data.meta.previous.clicks}
                />
                <KPICard
                  title="평균 CPC"
                  value={(() => {
                    const totalClicks = data.kpi.totalClicks + (clientInfo?.naverType === 'brand_search' ? (brandSearchData?.data?.summary?.total_clicks || 0) : 0)
                    const totalSpend = data.kpi.totalSpend + (clientInfo?.naverType === 'brand_search' ? (brandSearchData?.data?.fixed_budget?.total || 0) : 0)
                    return totalClicks > 0 ? totalSpend / totalClicks : 0
                  })()}
                  previousValue={data.meta.previous.clicks > 0 ? data.meta.previous.spend / data.meta.previous.clicks : 0}
                  format="currencyKRW"
                />
              </div>

              {/* 광고비 요약 - 모바일: 카드, 데스크톱: 테이블 */}
              <div className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-[#F5A623]" />
                      광고비 상세
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* 모바일 카드 뷰 */}
                    <div className="md:hidden space-y-4">
                      {/* Meta */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span className="font-semibold text-blue-700">Meta</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">노출수</span>
                            <p className="font-medium">{data.meta.current.impressions.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">클릭수</span>
                            <p className="font-medium">{data.meta.current.clicks.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">CTR</span>
                            <p className="font-medium">
                              {data.meta.current.impressions > 0
                                ? ((data.meta.current.clicks / data.meta.current.impressions) * 100).toFixed(2)
                                : 0}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">CPC</span>
                            <p className="font-medium">
                              {data.meta.current.clicks > 0
                                ? Math.round((data.meta.current.spend_krw || data.meta.current.spend * (data.exchange_rate || 1350)) / data.meta.current.clicks).toLocaleString()
                                : 0}원
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <span className="text-gray-500 text-sm">광고비</span>
                          <p className="font-bold text-blue-600 text-lg">
                            {(data.meta.current.spend_krw || Math.round(data.meta.current.spend * (data.exchange_rate || 1350))).toLocaleString()}원
                          </p>
                        </div>
                      </div>

                      {/* 네이버 */}
                      <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span className="font-semibold text-green-700">
                            네이버{clientInfo?.naverType === 'brand_search' ? ' (브랜드검색)' : ''}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">노출수</span>
                            <p className="font-medium">
                              {clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_impressions || 0).toLocaleString()
                                : data.naver.current.impressions.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">클릭수</span>
                            <p className="font-medium">
                              {clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_clicks || 0).toLocaleString()
                                : data.naver.current.clicks.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">CTR</span>
                            <p className="font-medium">
                              {clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_ctr || 0).toFixed(2)
                                : data.naver.current.impressions > 0
                                  ? ((data.naver.current.clicks / data.naver.current.impressions) * 100).toFixed(2)
                                  : 0}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">CPC</span>
                            <p className="font-medium">
                              {clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_clicks || 0) > 0
                                  ? Math.round((brandSearchData?.data?.fixed_budget?.total || 1320000) / (brandSearchData?.data?.summary?.total_clicks || 1)).toLocaleString()
                                  : 0
                                : data.naver.current.clicks > 0
                                  ? Math.round(data.naver.current.spend / data.naver.current.clicks).toLocaleString()
                                  : 0}원
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <span className="text-gray-500 text-sm">광고비</span>
                          <p className="font-bold text-green-600 text-lg">
                            {clientInfo?.naverType === 'brand_search'
                              ? (brandSearchData?.data?.fixed_budget?.total || 1320000).toLocaleString()
                              : data.naver.current.spend.toLocaleString()}원
                          </p>
                        </div>
                      </div>

                      {/* 합계 */}
                      <div className="bg-[#FFF8E7] rounded-lg p-4 border border-[#F5A623]/30">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 rounded-full bg-[#F5A623]"></div>
                          <span className="font-semibold text-[#D48C00]">합계</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">노출수</span>
                            <p className="font-medium">
                              {(data.meta.current.impressions + (clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_impressions || 0)
                                : data.naver.current.impressions)).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">클릭수</span>
                            <p className="font-medium">
                              {(data.meta.current.clicks + (clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_clicks || 0)
                                : data.naver.current.clicks)).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">CTR</span>
                            <p className="font-medium">
                              {(() => {
                                const naverImpressions = clientInfo?.naverType === 'brand_search'
                                  ? (brandSearchData?.data?.summary?.total_impressions || 0)
                                  : data.naver.current.impressions;
                                const naverClicks = clientInfo?.naverType === 'brand_search'
                                  ? (brandSearchData?.data?.summary?.total_clicks || 0)
                                  : data.naver.current.clicks;
                                const totalImpressions = data.meta.current.impressions + naverImpressions;
                                const totalClicks = data.meta.current.clicks + naverClicks;
                                return totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
                              })()}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">CPC</span>
                            <p className="font-medium">
                              {(() => {
                                const metaSpend = data.meta.current.spend_krw || Math.round(data.meta.current.spend * (data.exchange_rate || 1350));
                                const naverSpend = clientInfo?.naverType === 'brand_search'
                                  ? (brandSearchData?.data?.fixed_budget?.total || 1320000)
                                  : data.naver.current.spend;
                                const naverClicks = clientInfo?.naverType === 'brand_search'
                                  ? (brandSearchData?.data?.summary?.total_clicks || 0)
                                  : data.naver.current.clicks;
                                const totalClicks = data.meta.current.clicks + naverClicks;
                                return totalClicks > 0 ? Math.round((metaSpend + naverSpend) / totalClicks).toLocaleString() : 0;
                              })()}원
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-[#F5A623]/30">
                          <span className="text-gray-500 text-sm">총 광고비</span>
                          <p className="font-bold text-[#D48C00] text-xl">
                            {(() => {
                              const metaSpend = data.meta.current.spend_krw || Math.round(data.meta.current.spend * (data.exchange_rate || 1350));
                              const naverSpend = clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.fixed_budget?.total || 1320000)
                                : data.naver.current.spend;
                              return (metaSpend + naverSpend).toLocaleString();
                            })()}원
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 데스크톱 테이블 뷰 */}
                    <div className="hidden md:block">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-500">채널</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500">노출수</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500">클릭수</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500">CTR</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500">광고비</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500">CPC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                Meta
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">{data.meta.current.impressions.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">{data.meta.current.clicks.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              {data.meta.current.impressions > 0
                                ? ((data.meta.current.clicks / data.meta.current.impressions) * 100).toFixed(2)
                                : 0}%
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-blue-600">
                              {(data.meta.current.spend_krw || Math.round(data.meta.current.spend * (data.exchange_rate || 1350))).toLocaleString()}원
                            </td>
                            <td className="px-4 py-3 text-right">
                              {data.meta.current.clicks > 0
                                ? Math.round((data.meta.current.spend_krw || data.meta.current.spend * (data.exchange_rate || 1350)) / data.meta.current.clicks).toLocaleString()
                                : 0}원
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                네이버{clientInfo?.naverType === 'brand_search' ? ' (브랜드검색)' : ''}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_impressions || 0).toLocaleString()
                                : data.naver.current.impressions.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_clicks || 0).toLocaleString()
                                : data.naver.current.clicks.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_ctr || 0).toFixed(2)
                                : data.naver.current.impressions > 0
                                  ? ((data.naver.current.clicks / data.naver.current.impressions) * 100).toFixed(2)
                                  : 0}%
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-green-600">
                              {clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.fixed_budget?.total || 1320000).toLocaleString()
                                : data.naver.current.spend.toLocaleString()}원
                            </td>
                            <td className="px-4 py-3 text-right">
                              {clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_clicks || 0) > 0
                                  ? Math.round((brandSearchData?.data?.fixed_budget?.total || 1320000) / (brandSearchData?.data?.summary?.total_clicks || 1)).toLocaleString()
                                  : 0
                                : data.naver.current.clicks > 0
                                  ? Math.round(data.naver.current.spend / data.naver.current.clicks).toLocaleString()
                                  : 0}원
                            </td>
                          </tr>
                          <tr className="bg-gray-100 font-semibold">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#F5A623]"></div>
                                합계
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(data.meta.current.impressions + (clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_impressions || 0)
                                : data.naver.current.impressions)).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(data.meta.current.clicks + (clientInfo?.naverType === 'brand_search'
                                ? (brandSearchData?.data?.summary?.total_clicks || 0)
                                : data.naver.current.clicks)).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(() => {
                                const naverImpressions = clientInfo?.naverType === 'brand_search'
                                  ? (brandSearchData?.data?.summary?.total_impressions || 0)
                                  : data.naver.current.impressions;
                                const naverClicks = clientInfo?.naverType === 'brand_search'
                                  ? (brandSearchData?.data?.summary?.total_clicks || 0)
                                  : data.naver.current.clicks;
                                const totalImpressions = data.meta.current.impressions + naverImpressions;
                                const totalClicks = data.meta.current.clicks + naverClicks;
                                return totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
                              })()}%
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-[#F5A623]">
                              {(() => {
                                const metaSpend = data.meta.current.spend_krw || Math.round(data.meta.current.spend * (data.exchange_rate || 1350));
                                const naverSpend = clientInfo?.naverType === 'brand_search'
                                  ? (brandSearchData?.data?.fixed_budget?.total || 1320000)
                                  : data.naver.current.spend;
                                return (metaSpend + naverSpend).toLocaleString();
                              })()}원
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(() => {
                                const metaSpend = data.meta.current.spend_krw || Math.round(data.meta.current.spend * (data.exchange_rate || 1350));
                                const naverSpend = clientInfo?.naverType === 'brand_search'
                                  ? (brandSearchData?.data?.fixed_budget?.total || 1320000)
                                  : data.naver.current.spend;
                                const naverClicks = clientInfo?.naverType === 'brand_search'
                                  ? (brandSearchData?.data?.summary?.total_clicks || 0)
                                  : data.naver.current.clicks;
                                const totalClicks = data.meta.current.clicks + naverClicks;
                                return totalClicks > 0 ? Math.round((metaSpend + naverSpend) / totalClicks).toLocaleString() : 0;
                              })()}원
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Channel Comparison Chart */}
            <section className="mb-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>채널별 성과 비교 (Meta vs 네이버)</CardTitle>
                    <select
                      value={metricView}
                      onChange={(e) => setMetricView(e.target.value as 'impressions' | 'clicks' | 'spend')}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="impressions">노출수</option>
                      <option value="clicks">클릭수</option>
                      <option value="spend">지출액</option>
                    </select>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* 브랜드검색 타입일 때 */}
                  {clientInfo?.naverType === 'brand_search' ? (
                    brandSearchData?.data?.daily && brandSearchData.data.daily.length > 0 ? (
                      <ChannelComparisonChart
                        data={(() => {
                          // 브랜드검색 데이터와 Meta dailyTrend를 병합
                          const brandSearchMap = new Map(brandSearchData.data.daily.map(d => [d.date, d]));
                          return data.dailyTrend.map(d => ({
                            ...d,
                            naver_impressions: brandSearchMap.get(d.date)?.total_impressions || 0,
                            naver_clicks: brandSearchMap.get(d.date)?.total_clicks || 0,
                            naver_spend: 0, // 브랜드검색은 월 고정 비용
                          }));
                        })()}
                        metric={metricView}
                      />
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        브랜드검색 데이터가 없습니다.
                      </div>
                    )
                  ) : (
                    data.dailyTrend.length > 0 ? (
                      <ChannelComparisonChart data={data.dailyTrend} metric={metricView} />
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        해당 기간에 데이터가 없습니다.
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Meta 일별 성과 추이 (통합 차트) */}
            {data.dailyTrend.length > 0 && (
              <section className="mb-6">
                <DailyTrendChart
                  daily={data.dailyTrend.map(d => ({
                    date: d.date,
                    impressions: d.meta_impressions,
                    clicks: d.meta_clicks,
                    leads: d.meta_leads,
                    spend: d.meta_spend_krw || d.meta_spend * (data.exchange_rate || 1350),
                  }))}
                  usdToKrw={1}
                  showLeads={clientSlug === 'naratton' || clientInfo?.clientType === 'consulting'}
                  showClicks={clientSlug === 'hea-pangyo' || clientInfo?.clientType === 'restaurant'}
                  channel="meta"
                />
              </section>
            )}

            {/* Naver 일별 성과 추이 (통합 차트) - 네이버 데이터가 있을 때만 */}
            {data.dailyTrend.length > 0 && clientInfo?.naver?.enabled !== false && (
              <section className="mb-6">
                <DailyTrendChart
                  daily={data.dailyTrend.map(d => ({
                    date: d.date,
                    impressions: d.naver_impressions,
                    clicks: d.naver_clicks,
                    leads: 0,  // 네이버는 리드수 없음
                    spend: d.naver_spend,
                  }))}
                  usdToKrw={1}
                  showLeads={false}
                  showSpend={clientSlug === 'hea-pangyo' || clientInfo?.clientType === 'restaurant'}
                  channel="naver"
                  barMetric="clicks"
                />
              </section>
            )}

            {/* Channel Performance - 요약 카드 */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Meta 광고 성과</CardTitle>
                    <span className="text-xs text-gray-500">{dateRange.start} ~ {dateRange.end}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {data.meta.current.impressions > 0 || data.meta.current.spend > 0 ? (
                    <MetaSummaryCards
                      current={data.meta.current}
                      previous={data.meta.previous}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      해당 기간에 Meta 데이터가 없습니다.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 네이버 광고 성과 - naver.enabled가 true일 때만 표시 */}
              {clientInfo?.naver?.enabled !== false && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle>{clientInfo?.naverType === 'brand_search' ? '네이버 브랜드검색 광고 성과' : '네이버 플레이스 광고 성과'}</CardTitle>
                      <span className="text-xs text-gray-500">{dateRange.start} ~ {dateRange.end}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* 브랜드검색 타입일 때 */}
                    {clientInfo?.naverType === 'brand_search' ? (
                      brandSearchData?.data ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">노출수</p>
                            <p className="text-lg font-semibold">{brandSearchData.data.summary.total_impressions.toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">클릭수</p>
                            <p className="text-lg font-semibold">{brandSearchData.data.summary.total_clicks.toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">지출액</p>
                            <p className="text-lg font-semibold">{brandSearchData.data.fixed_budget.total.toLocaleString()}원</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">CTR</p>
                            <p className="text-lg font-semibold">{brandSearchData.data.summary.total_ctr.toFixed(2)}%</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">CPC</p>
                            <p className="text-lg font-semibold">
                              {brandSearchData.data.summary.total_clicks > 0
                                ? Math.round(brandSearchData.data.fixed_budget.total / brandSearchData.data.summary.total_clicks).toLocaleString()
                                : 0}원
                            </p>
                          </div>
                        </div>
                      ) : brandSearchLoading ? (
                        <div className="text-center py-8 text-gray-500">
                          <p>브랜드검색 데이터를 불러오는 중...</p>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>브랜드검색 데이터가 없습니다.</p>
                        </div>
                      )
                    ) : (
                      /* 플레이스 타입일 때 */
                      data.naver.current.impressions > 0 || data.naver.current.spend > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">노출수</p>
                            <p className="text-lg font-semibold">{data.naver.current.impressions.toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">클릭수</p>
                            <p className="text-lg font-semibold">{data.naver.current.clicks.toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">지출액</p>
                            <p className="text-lg font-semibold">{clientInfo?.naver?.fixed_budget ? clientInfo.naver.fixed_budget.toLocaleString() : data.naver.current.spend.toLocaleString()}원</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">CTR</p>
                            <p className="text-lg font-semibold">
                              {data.naver.current.impressions > 0
                                ? ((data.naver.current.clicks / data.naver.current.impressions) * 100).toFixed(2)
                                : 0}%
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">CPC</p>
                            <p className="text-lg font-semibold">
                              {data.naver.current.clicks > 0
                                ? Math.round((clientInfo?.naver?.fixed_budget || data.naver.current.spend) / data.naver.current.clicks).toLocaleString()
                                : 0}원
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>네이버 데이터가 없습니다.</p>
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Keyword Stats */}
            <section>
              {data.keywordStats && data.keywordStats.length > 0 ? (
                <KeywordMonthlyTrendChart data={data.keywordStats} title="상호명 검색량 추이" />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>상호명 검색량 추이</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12 text-gray-500">
                      <p>키워드 통계 데이터가 없습니다.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
            </>
            )}

            {/* Meta 상세 탭 */}
            {activeTab === 'meta' && showTabs && (
              <div className="space-y-6">
                {metaLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-[#F5A623]" />
                    <span className="ml-2 text-gray-600">Meta 데이터를 불러오는 중...</span>
                  </div>
                ) : metaData ? (
                  <>
                    {/* 전체 기간 KPI */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-gray-400"></span>
                        전체 기간 ({metaData.summary.date_range.start} ~ {metaData.summary.date_range.end})
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-gray-50 border-gray-200">
                          <CardContent className="pt-4 pb-3">
                            <div className="text-xl font-bold text-gray-700">
                              {metaData.summary.total_impressions.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">총 노출수</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-gray-50 border-gray-200">
                          <CardContent className="pt-4 pb-3">
                            <div className="text-xl font-bold text-gray-700">
                              {metaData.summary.total_clicks.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">총 클릭수</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-gray-50 border-gray-200">
                          <CardContent className="pt-4 pb-3">
                            <div className="text-xl font-bold text-gray-700">
                              {metaData.summary.total_spend_krw.toLocaleString()}원
                            </div>
                            <div className="text-xs text-gray-500">총 지출 (KRW)</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-gray-50 border-gray-200">
                          <CardContent className="pt-4 pb-3">
                            <div className="text-xl font-bold text-gray-700">
                              {metaData.summary.data_days}일
                            </div>
                            <div className="text-xs text-gray-500">데이터 일수</div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* 선택 기간 KPI */}
                    <div>
                      <h3 className="text-sm font-medium text-blue-600 mb-3 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                        선택 기간 ({data.period.start} ~ {data.period.end})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="border-blue-200">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-2xl font-bold text-blue-600">
                                  {data.meta.current.impressions.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-500">노출수</div>
                              </div>
                              <div className="p-3 rounded-lg bg-blue-100">
                                <BarChart3 className="h-6 w-6 text-blue-600" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-green-200">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-2xl font-bold text-green-600">
                                  {data.meta.current.clicks.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-500">클릭수</div>
                              </div>
                              <div className="p-3 rounded-lg bg-green-100">
                                <BarChart3 className="h-6 w-6 text-green-600" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-purple-200">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-2xl font-bold text-purple-600">
                                  {(data.meta.current.spend_krw || Math.round(data.meta.current.spend * (data.exchange_rate || 1350))).toLocaleString()}원
                                </div>
                                <div className="text-sm text-gray-500">지출 (KRW)</div>
                              </div>
                              <div className="p-3 rounded-lg bg-purple-100">
                                <BarChart3 className="h-6 w-6 text-purple-600" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-orange-200">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-2xl font-bold text-orange-600">
                                  {data.meta.current.impressions > 0
                                    ? ((data.meta.current.clicks / data.meta.current.impressions) * 100).toFixed(2)
                                    : '0.00'}%
                                </div>
                                <div className="text-sm text-gray-500">CTR</div>
                              </div>
                              <div className="p-3 rounded-lg bg-orange-100">
                                <BarChart3 className="h-6 w-6 text-orange-600" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-indigo-600">
                              ${data.meta.current.spend.toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-500">지출 (USD)</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-teal-600">
                              {clientInfo?.metaMetricType === 'video'
                                ? (data.meta.current.video_views?.toLocaleString() || 0)
                                : (data.meta.current.leads?.toLocaleString() || 0)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {clientInfo?.metaMetricType === 'video' ? '영상조회' : '리드'}
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-pink-600">
                              {data.meta.current.clicks > 0
                                ? Math.round((data.meta.current.spend_krw || data.meta.current.spend * (data.exchange_rate || 1350)) / data.meta.current.clicks).toLocaleString()
                                : 0}원
                            </div>
                            <div className="text-sm text-gray-500">CPC (KRW)</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-gray-600">
                              {data.dailyTrend.filter(d => d.meta_impressions > 0).length}일
                            </div>
                            <div className="text-sm text-gray-500">데이터 일수</div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* 요일별 추이 그래프 */}
                    <Card>
                      <CardHeader>
                        <CardTitle>요일별 지출 추이 (주별 비교)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {data && data.dailyTrend.length > 0 ? (
                          <MetaDayOfWeekChart data={data.dailyTrend} metric="spend" />
                        ) : (
                          <div className="h-[300px] flex items-center justify-center text-gray-400">
                            데이터 없음
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* 기간별 테이블 */}
                    <MetaPeriodTable
                      daily={metaData.daily}
                      weekly={metaData.weekly}
                      monthly={metaData.monthly}
                      loading={false}
                      metricType={clientInfo?.metaMetricType || 'lead'}
                      summary={metaData.summary}
                    />

                    {/* 광고 테이블 */}
                    <MetaAdTable
                      ads={metaData.ads}
                      loading={false}
                      metricType={clientInfo?.metaMetricType || 'lead'}
                    />
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Meta 광고 데이터가 없습니다.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* 네이버 상세 탭 - show_detail_tab이 true일 때만 표시 */}
            {activeTab === 'naver' && showTabs && clientInfo?.naver?.show_detail_tab !== false && (
              <div className="space-y-6">
                {/* 브랜드검색 타입일 때 */}
                {clientInfo?.naverType === 'brand_search' ? (
                  brandSearchLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="h-8 w-8 animate-spin text-[#F5A623]" />
                      <span className="ml-2 text-gray-600">브랜드검색 데이터를 불러오는 중...</span>
                    </div>
                  ) : brandSearchData?.data ? (
                    <BrandSearchTable
                      daily={brandSearchData.data.daily}
                      monthly={brandSearchData.data.monthly}
                      monthlyBudget={brandSearchData.data.fixed_budget}
                      isManualDataOnly={clientSlug === '나라똔'}
                    />
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-20">
                        <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">브랜드검색 데이터가 없습니다.</p>
                        <p className="text-sm text-gray-400 mt-2">Admin에서 CSV를 업로드해주세요.</p>
                      </CardContent>
                    </Card>
                  )
                ) : naverLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-[#F5A623]" />
                    <span className="ml-2 text-gray-600">네이버 데이터를 불러오는 중...</span>
                  </div>
                ) : naverData ? (
                  <>
                    {/* 전체 기간 KPI */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-gray-400"></span>
                        전체 기간 ({naverData.summary.date_range.start} ~ {naverData.summary.date_range.end})
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-gray-50 border-gray-200">
                          <CardContent className="pt-4 pb-3">
                            <div className="text-xl font-bold text-gray-700">
                              {naverData.summary.total_impressions.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">총 노출수</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-gray-50 border-gray-200">
                          <CardContent className="pt-4 pb-3">
                            <div className="text-xl font-bold text-gray-700">
                              {naverData.summary.total_clicks.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">총 클릭수</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-gray-50 border-gray-200">
                          <CardContent className="pt-4 pb-3">
                            <div className="text-xl font-bold text-gray-700">
                              {naverData.summary.total_cost.toLocaleString()}원
                            </div>
                            <div className="text-xs text-gray-500">총 비용</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-gray-50 border-gray-200">
                          <CardContent className="pt-4 pb-3">
                            <div className="text-xl font-bold text-gray-700">
                              {naverData.summary.data_days}일
                            </div>
                            <div className="text-xs text-gray-500">데이터 일수</div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* 선택 기간 KPI - 모바일: 2x4, 데스크톱: 4열 */}
                    <div>
                      <h3 className="text-sm font-medium text-green-600 mb-3 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                        선택 기간 ({data.period.start} ~ {data.period.end})
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        <Card className="border-blue-200">
                          <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4">
                            <div className="text-xl md:text-2xl font-bold text-blue-600">
                              {data.naver.current.impressions.toLocaleString()}
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">노출수</div>
                          </CardContent>
                        </Card>
                        <Card className="border-green-200">
                          <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4">
                            <div className="text-xl md:text-2xl font-bold text-green-600">
                              {data.naver.current.clicks.toLocaleString()}
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">클릭수</div>
                          </CardContent>
                        </Card>
                        <Card className="border-purple-200">
                          <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4">
                            <div className="text-xl md:text-2xl font-bold text-purple-600">
                              {data.naver.current.spend.toLocaleString()}원
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">비용</div>
                          </CardContent>
                        </Card>
                        <Card className="border-orange-200">
                          <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4">
                            <div className="text-xl md:text-2xl font-bold text-orange-600">
                              {data.naver.current.impressions > 0
                                ? ((data.naver.current.clicks / data.naver.current.impressions) * 100).toFixed(2)
                                : '0.00'}%
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">CTR</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4">
                            <div className="text-xl md:text-2xl font-bold text-indigo-600">
                              {data.naver.current.clicks > 0
                                ? Math.round(data.naver.current.spend / data.naver.current.clicks).toLocaleString()
                                : 0}원
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">CPC</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4">
                            <div className="text-xl md:text-2xl font-bold text-teal-600">
                              {naverData.summary.avg_rank.toFixed(1)}
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">평균 순위</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4">
                            <div className="text-xl md:text-2xl font-bold text-pink-600">
                              {naverData.summary.unique_keywords}개
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">고유 키워드</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 md:pt-6 pb-3 md:pb-4">
                            <div className="text-xl md:text-2xl font-bold text-gray-600">
                              {data.dailyTrend.filter(d => d.naver_impressions > 0).length}일
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">데이터 일수</div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* 키워드별 지출 도넛 차트 (플레이스만) */}
                    <Card>
                      <CardHeader>
                        <CardTitle>키워드별 광고비 분포</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {naverData.keywords && naverData.keywords.length > 0 ? (
                          <NaverKeywordDonutChart keywords={naverData.keywords} />
                        ) : (
                          <div className="h-[300px] flex items-center justify-center text-gray-400">
                            데이터 없음
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* 기간별 테이블 */}
                    <NaverPeriodTable
                      daily={naverData.daily}
                      weekly={naverData.weekly}
                      monthly={naverData.monthly}
                      loading={false}
                      naverType={clientInfo?.naverType}
                    />

                    {/* 키워드 테이블 (플레이스만) */}
                    <NaverKeywordTable
                      keywords={naverData.keywords}
                      loading={false}
                      dateRange={naverData.summary?.date_range}
                      clientSlug={clientSlug}
                      availableMonths={naverData.monthly?.map(m => ({
                        value: m.month,
                        label: m.month_label
                      })) || []}
                    />
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">네이버 광고 데이터가 없습니다.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* 리포트 탭 */}
            {activeTab === 'reports' && showTabs && (
              <ReportList clientSlug={clientSlug} isAdmin={isAdminView} />
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#F5A623]" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
