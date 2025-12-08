'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import {
  ArrowLeft,
  RefreshCw,
  BarChart3,
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  Download,
} from 'lucide-react'
import Link from 'next/link'
import { NaverPeriodTable } from '@/components/naver/NaverPeriodTable'
import { NaverKeywordTable } from '@/components/naver/NaverKeywordTable'
import type { NaverPeriodDataResponse } from '@/types/naver-analytics'

interface Client {
  id: string
  client_name: string
  slug: string
}

export default function NaverAnalyticsAdminPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 기간 설정
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 데이터
  const [data, setData] = useState<NaverPeriodDataResponse | null>(null)

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

      const response = await fetch(`/api/naver/analytics?${params}`, {
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

    // CSV 생성
    const rows: string[][] = []

    // 헤더
    rows.push(['일별 성과 데이터'])
    rows.push(['날짜', '노출수', '클릭수', 'CTR(%)', '평균CPC', '총비용', '평균순위', '키워드수'])

    data.daily.forEach((d) => {
      rows.push([
        d.date,
        d.impressions.toString(),
        d.clicks.toString(),
        d.ctr.toFixed(2),
        d.avg_cpc.toString(),
        d.total_cost.toString(),
        d.avg_rank.toFixed(1),
        d.keyword_count.toString(),
      ])
    })

    rows.push([])
    rows.push(['키워드별 성과 데이터'])
    rows.push(['키워드', '노출수', '클릭수', 'CTR(%)', '평균CPC', '총비용', '평균순위', '일수'])

    data.keywords.forEach((k) => {
      rows.push([
        k.keyword,
        k.impressions.toString(),
        k.clicks.toString(),
        k.ctr.toFixed(2),
        k.avg_cpc.toString(),
        k.total_cost.toString(),
        k.avg_rank.toFixed(1),
        k.days_count.toString(),
      ])
    })

    const csv = rows.map((row) => row.join(',')).join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `naver_analytics_${startDate}_${endDate}.csv`
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
  }: {
    title: string
    value: number | string
    suffix?: string
    icon: React.ElementType
    color: string
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
          </div>
          <div className={`p-3 rounded-lg ${color.replace('text-', 'bg-').replace('600', '100')}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
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
                <h1 className="text-xl font-bold text-gray-900">네이버 광고 분석</h1>
                <p className="text-sm text-gray-500">기간별 성과 분석 및 키워드 통계</p>
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
                  Excel 내보내기
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
            {/* KPI 요약 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KPICard
                title="총 노출수"
                value={data.summary.total_impressions}
                icon={BarChart3}
                color="text-blue-600"
              />
              <KPICard
                title="총 클릭수"
                value={data.summary.total_clicks}
                icon={TrendingUp}
                color="text-green-600"
              />
              <KPICard
                title="총 비용"
                value={data.summary.total_cost}
                suffix="원"
                icon={Calendar}
                color="text-purple-600"
              />
              <KPICard
                title="평균 CTR"
                value={data.summary.avg_ctr.toFixed(2)}
                suffix="%"
                icon={TrendingDown}
                color="text-orange-600"
              />
            </div>

            {/* 추가 KPI */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KPICard
                title="평균 CPC"
                value={data.summary.avg_cpc}
                suffix="원"
                icon={Search}
                color="text-indigo-600"
              />
              <KPICard
                title="평균 순위"
                value={data.summary.avg_rank.toFixed(1)}
                icon={BarChart3}
                color="text-teal-600"
              />
              <KPICard
                title="고유 키워드"
                value={data.summary.unique_keywords}
                suffix="개"
                icon={Search}
                color="text-pink-600"
              />
              <KPICard
                title="데이터 일수"
                value={data.summary.data_days}
                suffix="일"
                icon={Calendar}
                color="text-gray-600"
              />
            </div>

            {/* 기간별 테이블 */}
            <NaverPeriodTable
              daily={data.daily}
              weekly={data.weekly}
              monthly={data.monthly}
              loading={false}
            />

            {/* 키워드 테이블 */}
            <NaverKeywordTable
              keywords={data.keywords}
              loading={false}
            />
          </div>
        )}

        {/* 데이터 없음 */}
        {!loading && selectedClientId && data && data.daily.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">선택한 기간에 데이터가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-2">
                CSV 파일을 업로드하거나 기간을 변경해보세요.
              </p>
              <Link href="/admin/upload/naver">
                <Button className="mt-4">
                  데이터 업로드
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
