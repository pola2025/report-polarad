'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import { Plus, RefreshCw, Play, AlertCircle, CheckCircle, Clock, Upload, Search, FileText, Eye } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Client {
  id: string
  client_id: string
  client_name: string
  slug: string | null
  meta_ad_account_id: string | null
  is_active: boolean
  status: string
  latestDataDate: string | null
  dataCount: number
  service_start_date: string | null
  service_end_date: string | null
  telegram_enabled: boolean
}

interface SystemStatus {
  summary: {
    totalClients: number
    activeClients: number
    inactiveClients: number
    telegramEnabled: number
  }
  alerts: {
    expiringServices: Array<{ id: string; name: string; expiresAt: string }>
    expiringTokens: Array<{ id: string; name: string; expiresAt: string }>
    authRequired: Array<{ id: string; name: string }>
  }
  dataStatus: {
    recentDataCount: number
    clientStatus: Array<{
      id: string
      name: string
      latestDate: string | null
      daysSinceLastData: number | null
      status: 'ok' | 'warning' | 'critical' | 'no_data'
    }>
  }
}

// 백필 로그 인터페이스
interface BackfillLog {
  time: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
}

export default function AdminPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminKey, setAdminKey] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 모달 상태
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBackfillModal, setShowBackfillModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [backfillLogs, setBackfillLogs] = useState<BackfillLog[]>([])
  const [isBackfilling, setIsBackfilling] = useState(false)

  // 새 클라이언트 폼
  const [newClient, setNewClient] = useState({
    name: '',
    account: '',
    token: '',
    telegram: '',
  })

  const fetchData = useCallback(async () => {
    if (!adminKey) return

    setLoading(true)
    try {
      const headers = { 'x-admin-key': adminKey }

      const [clientsRes, statusRes] = await Promise.all([
        fetch('/api/admin/clients', { headers }),
        fetch('/api/admin/status', { headers }),
      ])

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json()
        setClients(clientsData.clients || [])
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setStatus(statusData)
      }

      setIsAuthenticated(true)
    } catch (error) {
      console.error('데이터 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [adminKey])

  useEffect(() => {
    const savedKey = localStorage.getItem('polarad_admin_key')
    if (savedKey) {
      setAdminKey(savedKey)
    }
  }, [])

  useEffect(() => {
    if (adminKey) {
      fetchData()
    }
  }, [adminKey, fetchData])

  const handleLogin = () => {
    if (adminKey) {
      localStorage.setItem('polarad_admin_key', adminKey)
      fetchData()
    }
  }

  const handleAddClient = async () => {
    if (!newClient.name) {
      alert('클라이언트명은 필수입니다.')
      return
    }

    try {
      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify(newClient),
      })

      const data = await response.json()

      if (data.success) {
        alert('클라이언트가 추가되었습니다.')
        setShowAddModal(false)
        setNewClient({ name: '', account: '', token: '', telegram: '' })
        fetchData()
      } else {
        alert(data.error || '추가 실패')
      }
    } catch (error) {
      console.error('클라이언트 추가 실패:', error)
      alert('오류가 발생했습니다.')
    }
  }

  const handleBackfill = async (client: Client) => {
    setSelectedClient(client)
    setBackfillLogs([])
    setShowBackfillModal(true)
  }

  const startBackfill = async (days: number) => {
    if (!selectedClient) return

    setIsBackfilling(true)
    setBackfillLogs([])

    try {
      const response = await fetch('/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          clientId: selectedClient.id,
          days,
        }),
      })

      if (!response.ok) {
        throw new Error('백필 시작 실패')
      }

      // SSE 스트림 처리
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value)
          const lines = text.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.time && data.message) {
                  setBackfillLogs((prev) => [...prev, data as BackfillLog])
                }
              } catch {
                // JSON 파싱 실패 무시
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('백필 실패:', error)
      setBackfillLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), type: 'error', message: '백필 실행 중 오류 발생' },
      ])
    } finally {
      setIsBackfilling(false)
      fetchData()
    }
  }

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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Polarad Meta 관리자</h1>
              <p className="text-sm text-gray-500">클라이언트 및 데이터 관리</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                새로고침
              </Button>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                클라이언트 추가
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">로딩 중...</div>
        ) : (
          <>
            {/* 시스템 요약 */}
            {status && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">시스템 현황</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{status.summary.totalClients}</div>
                      <div className="text-sm text-gray-500">전체 클라이언트</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">{status.summary.activeClients}</div>
                      <div className="text-sm text-gray-500">활성</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{status.dataStatus.recentDataCount}</div>
                      <div className="text-sm text-gray-500">최근 7일 데이터</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-blue-600">{status.summary.telegramEnabled}</div>
                      <div className="text-sm text-gray-500">텔레그램 연동</div>
                    </CardContent>
                  </Card>
                </div>
              </section>
            )}

            {/* 데이터 업로드 바로가기 */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">데이터 업로드</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/admin/upload/naver">
                  <Card className="hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                          <FileText className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">네이버 플레이스 광고</div>
                          <div className="text-sm text-gray-500">CSV 파일 업로드</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/admin/upload/keywords">
                  <Card className="hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg">
                          <Search className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">상호명 검색 통계</div>
                          <div className="text-sm text-gray-500">월별 키워드 검색량 입력</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </section>

            {/* 분석 대시보드 */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">분석 대시보드</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/admin/naver">
                  <Card className="hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <Upload className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">네이버 광고 분석</div>
                          <div className="text-sm text-gray-500">기간별 성과 분석 및 키워드 통계</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </section>

            {/* 알림 */}
            {status && (status.alerts.expiringServices.length > 0 || status.alerts.authRequired.length > 0) && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">알림</h2>
                <div className="space-y-2">
                  {status.alerts.authRequired.map((client) => (
                    <div key={client.id} className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <span className="text-sm">{client.name}: 인증 필요</span>
                    </div>
                  ))}
                  {status.alerts.expiringServices.map((client) => (
                    <div key={client.id} className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                      <Clock className="h-5 w-5 text-orange-600" />
                      <span className="text-sm">{client.name}: 서비스 만료 예정 ({client.expiresAt})</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 클라이언트 목록 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">클라이언트 목록</h2>
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">클라이언트</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">광고계정</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">상태</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">최신 데이터</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">데이터 건수</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clients.map((client) => (
                      <tr key={client.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => client.slug && router.push(`/?client=${client.slug}`)}
                            className="text-left hover:text-[#F5A623] transition-colors"
                            disabled={!client.slug}
                          >
                            <div className="font-medium text-gray-900 hover:text-[#F5A623]">{client.client_name}</div>
                            <div className="text-sm text-gray-500">{client.slug || '슬러그 없음'}</div>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {client.meta_ad_account_id || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {client.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              <CheckCircle className="h-3 w-3" />
                              활성
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                              비활성
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {client.latestDataDate || '없음'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatNumber(client.dataCount)}건
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => client.slug && router.push(`/?client=${client.slug}`)}
                              disabled={!client.slug}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              리포트
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleBackfill(client)}
                              disabled={!client.meta_ad_account_id}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              백필
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* 클라이언트 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>새 클라이언트 추가</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    클라이언트명 *
                  </label>
                  <input
                    type="text"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-md"
                    placeholder="예: H.E.A 판교"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meta 광고계정 ID
                  </label>
                  <input
                    type="text"
                    value={newClient.account}
                    onChange={(e) => setNewClient({ ...newClient, account: e.target.value })}
                    className="w-full px-4 py-2 border rounded-md"
                    placeholder="예: act_123456789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={newClient.token}
                    onChange={(e) => setNewClient({ ...newClient, token: e.target.value })}
                    className="w-full px-4 py-2 border rounded-md"
                    placeholder="Meta System User Access Token"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    텔레그램 Chat ID
                  </label>
                  <input
                    type="text"
                    value={newClient.telegram}
                    onChange={(e) => setNewClient({ ...newClient, telegram: e.target.value })}
                    className="w-full px-4 py-2 border rounded-md"
                    placeholder="예: -1001234567890"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                    취소
                  </Button>
                  <Button onClick={handleAddClient}>추가</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 백필 모달 */}
      {showBackfillModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <CardHeader>
              <CardTitle>{selectedClient.client_name} 백필</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {!isBackfilling && backfillLogs.length === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">수집할 기간을 선택하세요:</p>
                  <div className="flex gap-2">
                    <Button onClick={() => startBackfill(7)}>7일</Button>
                    <Button onClick={() => startBackfill(30)}>30일</Button>
                    <Button onClick={() => startBackfill(90)}>90일</Button>
                    <Button variant="secondary" onClick={() => startBackfill(180)}>180일</Button>
                  </div>
                </div>
              )}
              {(isBackfilling || backfillLogs.length > 0) && (
                <div className="bg-gray-900 text-gray-100 rounded-md p-4 font-mono text-sm h-80 overflow-auto">
                  {backfillLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`${
                        log.type === 'error'
                          ? 'text-red-400'
                          : log.type === 'success'
                          ? 'text-green-400'
                          : log.type === 'warning'
                          ? 'text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    >
                      [{log.time}] {log.message}
                    </div>
                  ))}
                  {isBackfilling && <div className="text-blue-400 animate-pulse">처리 중...</div>}
                </div>
              )}
              <div className="flex justify-end pt-4">
                <Button variant="secondary" onClick={() => setShowBackfillModal(false)} disabled={isBackfilling}>
                  닫기
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
