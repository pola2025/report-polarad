'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import { formatSpendWithKrw } from '@/lib/constants'
import {
  ArrowLeft,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  DollarSign,
  MousePointer,
  Eye,
  Target,
} from 'lucide-react'
import Link from 'next/link'
import { NaverPeriodTable } from '@/components/naver/NaverPeriodTable'
import { NaverKeywordTable } from '@/components/naver/NaverKeywordTable'
import {
  ChannelRatioChart,
  CombinedTrendChart,
  ChannelComparisonTable,
} from '@/components/analytics'
import type { IntegratedAnalyticsResponse } from '@/types/integrated-analytics'

interface Client {
  id: string
  client_name: string
  slug: string
}

type TabType = 'summary' | 'meta' | 'naver' | 'comparison'

export default function IntegratedAnalyticsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('summary')

  // 기간 설정
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 데이터
  const [data, setData] = useState<IntegratedAnalyticsResponse | null>(null)

  // 차트 옵션
  const [trendMetric, setTrendMetric] = useState<'spend' | 'impressions' | 'clicks'>('spend')
  const [chartType, setChartType] = useState<'stacked' | 'line' | 'combined'>('stacked')

  // 초기화
  useEffect(() => {
    const savedKey = localStorage.getItem('polarad_admin_key')
    if (savedKey) {
      setAdminKey(savedKey)
      setIsAuthenticated(true)
    }

    // 기본 날짜 설정 (최근 30일)
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }, [])

  // 클라이언트 목록 조회
  const fetchClients = useCallback(async () => {
    if (!adminKey) return

    try {
      const response = await fetch('/api/admin/clients', {
        headers: { 'x-admin-key': adminKey },
      })

      if (response.ok) {
        const result = await response.json()
        setClients(result.clients || [])
      }
    } catch (error) {
      console.error('클라이언트 조회 실패:', error)
    }
  }, [adminKey])

  useEffect(() => {
    if (adminKey) {
      fetchClients()
    }
  }, [adminKey, fetchClients])

  // 데이터 조회
  const fetchData = useCallback(async () => {
    if (!adminKey || !selectedClientId || !startDate || !endDate) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        clientId: selectedClientId,
        startDate,
        endDate,
      })

      const response = await fetch(`/api/analytics/integrated?${params}`, {
        headers: { 'x-admin-key': adminKey },
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('데이터 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [adminKey, selectedClientId, startDate, endDate])

  useEffect(() => {
    if (selectedClientId && startDate && endDate) {
      fetchData()
    }
  }, [selectedClientId, startDate, endDate, fetchData])

  const handleLogin = () => {
    if (adminKey) {
      localStorage.setItem('polarad_admin_key', adminKey)
      setIsAuthenticated(true)
      fetchClients()
    }
  }

  // 기간 프리셋
  const setPeriodPreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }

  // Excel 내보내기
  const handleExportExcel = async () => {
    if (!data) return

    const rows: string[][] = []

    // 통합 요약
    rows.push(['통합 광고 분석 리포트'])
    rows.push(['기간', `${data.period.start} ~ ${data.period.end}`])
    rows.push(['환율', `1 USD = ${data.exchange_rate} KRW`])
    rows.push([])

    // 통합 KPI
    rows.push(['통합 KPI'])
    rows.push(['총 광고비(KRW)', data.summary.total_spend_krw.toString()])
    rows.push(['총 노출수', data.summary.total_impressions.toString()])
    rows.push(['총 클릭수', data.summary.total_clicks.toString()])
    rows.push(['평균 CTR', `${data.summary.avg_ctr}%`])
    rows.push(['평균 CPC(KRW)', data.summary.avg_cpc_krw.toString()])
    rows.push([])

    // 채널별 비중
    rows.push(['채널별 비용 비중'])
    rows.push(['Meta', `${data.summary.channel_ratio.meta_percent}%`, `₩${data.summary.meta_spend_krw}`])
    rows.push(['네이버', `${data.summary.channel_ratio.naver_percent}%`, `₩${data.summary.naver_spend_krw}`])
    rows.push([])

    // 일별 통합 데이터
    rows.push(['일별 통합 데이터'])
    rows.push(['날짜', 'Meta 노출', 'Meta 클릭', 'Meta 비용(USD)', 'Meta 비용(KRW)', '네이버 노출', '네이버 클릭', '네이버 비용', '총 비용(KRW)'])
    data.daily_combined.forEach(d => {
      rows.push([
        d.date,
        d.meta_impressions.toString(),
        d.meta_clicks.toString(),
        d.meta_spend_usd.toFixed(2),
        d.meta_spend_krw.toString(),
        d.naver_impressions.toString(),
        d.naver_clicks.toString(),
        d.naver_spend.toString(),
        d.total_spend_krw.toString(),
      ])
    })

    const csv = rows.map(row => row.join(',')).join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `integrated_analytics_${startDate}_${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // KPI 카드 컴포넌트
  const KPICard = ({
    title,
    value,
    suffix,
    icon: Icon,
    color,
    subValue,
  }: {
    title: string
    value: number | string
    suffix?: string
    icon: React.ElementType
    color: string
    subValue?: string
  }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-2xl font-bold ${color}`}>
              {typeof value === 'number' ? formatNumber(value) : value}
              {suffix && <span className="text-lg ml-1">{suffix}</span>}
            </div>
            <div className="text-sm text-gray-500">{title}</div>
            {subValue && <div className="text-xs text-gray-400 mt-1">{subValue}</div>}
          </div>
          <div className={`p-3 rounded-lg ${color.replace('text-', 'bg-').replace('600', '100')}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // 탭 버튼
  const TabButton = ({ tab, label }: { tab: TabType; label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
        activeTab === tab
          ? 'bg-white text-blue-600 border-b-2 border-blue-600'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )

  // 인증 전 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>관리자 로그인</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="관리자 키 입력"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Button onClick={handleLogin} className="w-full">
                로그인
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">통합 광고 분석</h1>
                <p className="text-sm text-gray-500">Meta + 네이버 통합 성과 분석</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </Button>
              {data && (
                <Button variant="secondary" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 필터 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* 클라이언트 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  클라이언트
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">선택하세요</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.client_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 시작일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시작일
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 종료일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  종료일
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 기간 프리셋 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  빠른 선택
                </label>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setPeriodPreset(7)}>
                    7일
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setPeriodPreset(30)}>
                    30일
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setPeriodPreset(90)}>
                    90일
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 로딩 */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">데이터 로딩 중...</p>
          </div>
        )}

        {/* 데이터 미선택 */}
        {!loading && !selectedClientId && (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">클라이언트를 선택하세요</p>
            </CardContent>
          </Card>
        )}

        {/* 데이터 표시 */}
        {!loading && data && (
          <div className="space-y-6">
            {/* 탭 네비게이션 */}
            <div className="flex gap-1 border-b border-gray-200">
              <TabButton tab="summary" label="통합 요약" />
              <TabButton tab="meta" label="Meta 상세" />
              <TabButton tab="naver" label="네이버 상세" />
              <TabButton tab="comparison" label="채널 비교" />
            </div>

            {/* 통합 요약 탭 */}
            {activeTab === 'summary' && (
              <div className="space-y-6">
                {/* 통합 KPI */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KPICard
                    title="총 광고비"
                    value={data.summary.total_spend_krw}
                    suffix="원"
                    icon={DollarSign}
                    color="text-blue-600"
                    subValue={`Meta: $${data.summary.meta_spend_usd.toFixed(2)}`}
                  />
                  <KPICard
                    title="총 노출수"
                    value={data.summary.total_impressions}
                    icon={Eye}
                    color="text-green-600"
                  />
                  <KPICard
                    title="총 클릭수"
                    value={data.summary.total_clicks}
                    icon={MousePointer}
                    color="text-purple-600"
                  />
                  <KPICard
                    title="평균 CTR"
                    value={data.summary.avg_ctr.toFixed(2)}
                    suffix="%"
                    icon={TrendingUp}
                    color="text-orange-600"
                  />
                </div>

                {/* 추가 KPI */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KPICard
                    title="평균 CPC"
                    value={data.summary.avg_cpc_krw}
                    suffix="원"
                    icon={BarChart3}
                    color="text-indigo-600"
                  />
                  <KPICard
                    title="Meta 리드"
                    value={data.summary.meta_leads}
                    icon={Target}
                    color="text-pink-600"
                  />
                  <KPICard
                    title="Meta CPL"
                    value={data.summary.meta_cpl_krw}
                    suffix="원"
                    icon={TrendingDown}
                    color="text-teal-600"
                    subValue={`$${data.summary.meta_cpl_usd.toFixed(2)}`}
                  />
                  <KPICard
                    title="네이버 평균순위"
                    value={data.summary.naver_avg_rank.toFixed(1)}
                    suffix="위"
                    icon={BarChart3}
                    color="text-gray-600"
                  />
                </div>

                {/* 채널별 비용 비중 & 트렌드 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>채널별 비용 비중</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChannelRatioChart
                        metaSpend={data.summary.meta_spend_krw}
                        naverSpend={data.summary.naver_spend_krw}
                        metaPercent={data.summary.channel_ratio.meta_percent}
                        naverPercent={data.summary.channel_ratio.naver_percent}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>일별 통합 트렌드</CardTitle>
                        <div className="flex gap-2">
                          <select
                            value={trendMetric}
                            onChange={(e) => setTrendMetric(e.target.value as 'spend' | 'impressions' | 'clicks')}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="spend">광고비</option>
                            <option value="impressions">노출수</option>
                            <option value="clicks">클릭수</option>
                          </select>
                          <select
                            value={chartType}
                            onChange={(e) => setChartType(e.target.value as 'stacked' | 'line' | 'combined')}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="stacked">스택 바</option>
                            <option value="line">라인</option>
                            <option value="combined">복합</option>
                          </select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CombinedTrendChart
                        data={data.daily_combined}
                        type={chartType}
                        metric={trendMetric}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Meta 상세 탭 */}
            {activeTab === 'meta' && (
              <div className="space-y-6">
                {/* Meta KPI */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KPICard
                    title="Meta 지출"
                    value={formatSpendWithKrw(data.meta.summary.spend_usd)}
                    icon={DollarSign}
                    color="text-blue-600"
                  />
                  <KPICard
                    title="노출수"
                    value={data.meta.summary.impressions}
                    icon={Eye}
                    color="text-green-600"
                  />
                  <KPICard
                    title="클릭수"
                    value={data.meta.summary.clicks}
                    icon={MousePointer}
                    color="text-purple-600"
                  />
                  <KPICard
                    title="CTR"
                    value={data.meta.summary.ctr.toFixed(2)}
                    suffix="%"
                    icon={TrendingUp}
                    color="text-orange-600"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KPICard
                    title="리드수"
                    value={data.meta.summary.leads}
                    icon={Target}
                    color="text-pink-600"
                  />
                  <KPICard
                    title="CPL"
                    value={formatSpendWithKrw(data.meta.summary.cpl_usd)}
                    icon={TrendingDown}
                    color="text-teal-600"
                  />
                </div>

                {/* Meta 일별 테이블 */}
                <Card>
                  <CardHeader>
                    <CardTitle>Meta 일별 성과</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">노출</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">클릭</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">지출(USD)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">지출(KRW)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">리드</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPL</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {data.meta.daily.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm">{row.date}</td>
                              <td className="px-4 py-3 text-sm text-right">{formatNumber(row.impressions)}</td>
                              <td className="px-4 py-3 text-sm text-right">{formatNumber(row.clicks)}</td>
                              <td className="px-4 py-3 text-sm text-right">{row.ctr.toFixed(2)}%</td>
                              <td className="px-4 py-3 text-sm text-right">${row.spend_usd.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-right">₩{formatNumber(row.spend_krw)}</td>
                              <td className="px-4 py-3 text-sm text-right">{row.leads}</td>
                              <td className="px-4 py-3 text-sm text-right">${row.cpl_usd.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 네이버 상세 탭 */}
            {activeTab === 'naver' && (
              <div className="space-y-6">
                {/* 네이버 KPI */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KPICard
                    title="총 노출수"
                    value={data.naver.summary.total_impressions}
                    icon={Eye}
                    color="text-blue-600"
                  />
                  <KPICard
                    title="총 클릭수"
                    value={data.naver.summary.total_clicks}
                    icon={MousePointer}
                    color="text-green-600"
                  />
                  <KPICard
                    title="총 비용"
                    value={data.naver.summary.total_cost}
                    suffix="원"
                    icon={DollarSign}
                    color="text-purple-600"
                  />
                  <KPICard
                    title="평균 CTR"
                    value={data.naver.summary.avg_ctr.toFixed(2)}
                    suffix="%"
                    icon={TrendingUp}
                    color="text-orange-600"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KPICard
                    title="평균 CPC"
                    value={data.naver.summary.avg_cpc}
                    suffix="원"
                    icon={BarChart3}
                    color="text-indigo-600"
                  />
                  <KPICard
                    title="평균 순위"
                    value={data.naver.summary.avg_rank.toFixed(1)}
                    icon={TrendingDown}
                    color="text-teal-600"
                  />
                  <KPICard
                    title="고유 키워드"
                    value={data.naver.summary.unique_keywords}
                    suffix="개"
                    icon={Target}
                    color="text-pink-600"
                  />
                  <KPICard
                    title="데이터 일수"
                    value={data.naver.summary.data_days}
                    suffix="일"
                    icon={BarChart3}
                    color="text-gray-600"
                  />
                </div>

                {/* 기간별 테이블 */}
                <NaverPeriodTable
                  daily={data.naver.daily}
                  weekly={data.naver.weekly}
                  monthly={data.naver.monthly}
                  loading={false}
                />

                {/* 키워드 테이블 */}
                <NaverKeywordTable
                  keywords={data.naver.keywords}
                  loading={false}
                />
              </div>
            )}

            {/* 채널 비교 탭 */}
            {activeTab === 'comparison' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>채널별 성과 비교</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChannelComparisonTable data={data.comparison} />
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>채널별 광고비 추이</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CombinedTrendChart
                        data={data.daily_combined}
                        type="line"
                        metric="spend"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>채널별 클릭수 추이</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CombinedTrendChart
                        data={data.daily_combined}
                        type="line"
                        metric="clicks"
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
