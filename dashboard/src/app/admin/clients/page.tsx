'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Users,
  Shield,
} from 'lucide-react'
import Link from 'next/link'

type ClientStatus = 'pending' | 'active' | 'suspended' | 'expired'

interface Client {
  id: string
  client_id: string
  client_name: string
  slug: string | null
  meta_ad_account_id: string | null
  meta_user_id: string | null
  meta_token_expires_at: string | null
  status: ClientStatus
  is_active: boolean
  approved_at: string | null
  approved_by: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  suspended_at: string | null
  suspension_reason: string | null
  dataCount: number
  daysUntilExpiry: number | null
  isExpiringSoon: boolean
  created_at: string
}

interface Stats {
  pending: number
  active: number
  suspended: number
  expired: number
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [stats, setStats] = useState<Stats>({ pending: 0, active: 0, suspended: 0, expired: 0 })
  const [loading, setLoading] = useState(true)
  const [adminKey, setAdminKey] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // 모달 상태
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [suspendReason, setSuspendReason] = useState('')

  const fetchData = useCallback(async () => {
    if (!adminKey) return

    setLoading(true)
    try {
      const url =
        statusFilter === 'all'
          ? `/api/admin/clients?adminKey=${adminKey}`
          : `/api/admin/clients?adminKey=${adminKey}&status=${statusFilter}`

      const res = await fetch(url)

      if (res.ok) {
        const data = await res.json()
        setClients(data.clients || [])
        setStats(data.stats || { pending: 0, active: 0, suspended: 0, expired: 0 })
      } else if (res.status === 401) {
        setIsAuthenticated(false)
        alert('인증이 필요합니다.')
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }, [adminKey, statusFilter])

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated, fetchData])

  const handleLogin = () => {
    if (adminKey) {
      setIsAuthenticated(true)
    }
  }

  const handleApprove = async (client: Client) => {
    setSelectedClient(client)
    setShowApproveModal(true)
  }

  const confirmApprove = async () => {
    if (!selectedClient) return

    setActionLoading(selectedClient.id)
    try {
      const res = await fetch('/api/admin/clients/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          adminKey,
          approvedBy: 'admin',
        }),
      })

      if (res.ok) {
        alert(`${selectedClient.client_name} 승인 완료`)
        setShowApproveModal(false)
        fetchData()
      } else {
        const error = await res.json()
        alert(`승인 실패: ${error.error}`)
      }
    } catch {
      alert('승인 처리 중 오류 발생')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSuspend = async (client: Client) => {
    setSelectedClient(client)
    setSuspendReason('')
    setShowSuspendModal(true)
  }

  const confirmSuspend = async () => {
    if (!selectedClient || !suspendReason) return

    setActionLoading(selectedClient.id)
    try {
      const res = await fetch('/api/admin/clients/suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          adminKey,
          reason: suspendReason,
        }),
      })

      if (res.ok) {
        alert(`${selectedClient.client_name} 일시 중지 완료`)
        setShowSuspendModal(false)
        fetchData()
      } else {
        const error = await res.json()
        alert(`일시 중지 실패: ${error.error}`)
      }
    } catch {
      alert('일시 중지 처리 중 오류 발생')
    } finally {
      setActionLoading(null)
    }
  }

  const handleActivate = async (client: Client) => {
    if (!confirm(`${client.client_name}을(를) 재활성화하시겠습니까?`)) return

    setActionLoading(client.id)
    try {
      const res = await fetch('/api/admin/clients/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          adminKey,
        }),
      })

      if (res.ok) {
        alert(`${client.client_name} 재활성화 완료`)
        fetchData()
      } else {
        const error = await res.json()
        alert(`재활성화 실패: ${error.error}`)
      }
    } catch {
      alert('재활성화 처리 중 오류 발생')
    } finally {
      setActionLoading(null)
    }
  }

  // 인증 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              관리자 인증
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  관리자 키
                </label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="관리자 키를 입력하세요"
                />
              </div>
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
    <div className="min-h-screen bg-neutral-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-neutral-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-xl font-bold text-neutral-900">
              Polarad Admin
            </Link>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-600">클라이언트 관리</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 상태별 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div
            className={`cursor-pointer transition-all rounded-lg ${statusFilter === 'pending' ? 'ring-2 ring-amber-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-500">승인 대기</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  </div>
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div
            className={`cursor-pointer transition-all rounded-lg ${statusFilter === 'active' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-500">활성</p>
                    <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div
            className={`cursor-pointer transition-all rounded-lg ${statusFilter === 'suspended' ? 'ring-2 ring-red-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'suspended' ? 'all' : 'suspended')}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-500">일시 중지</p>
                    <p className="text-2xl font-bold text-red-600">{stats.suspended}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div
            className={`cursor-pointer transition-all rounded-lg ${statusFilter === 'expired' ? 'ring-2 ring-neutral-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-500">만료</p>
                    <p className="text-2xl font-bold text-neutral-600">{stats.expired}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-neutral-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 필터 표시 */}
        {statusFilter !== 'all' && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-neutral-500">필터:</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(statusFilter)}`}
            >
              {getStatusLabel(statusFilter)}
              <button onClick={() => setStatusFilter('all')} className="ml-1 hover:opacity-70">
                ×
              </button>
            </span>
          </div>
        )}

        {/* 클라이언트 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              클라이언트 목록 ({clients.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-neutral-500">로딩 중...</div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                {statusFilter === 'all' ? '등록된 클라이언트가 없습니다.' : '해당 상태의 클라이언트가 없습니다.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-neutral-600">클라이언트</th>
                      <th className="text-left py-3 px-2 font-medium text-neutral-600">상태</th>
                      <th className="text-left py-3 px-2 font-medium text-neutral-600">광고 계정</th>
                      <th className="text-left py-3 px-2 font-medium text-neutral-600">토큰 만료</th>
                      <th className="text-left py-3 px-2 font-medium text-neutral-600">데이터</th>
                      <th className="text-left py-3 px-2 font-medium text-neutral-600">등록일</th>
                      <th className="text-right py-3 px-2 font-medium text-neutral-600">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id} className="border-b hover:bg-neutral-50">
                        <td className="py-3 px-2">
                          <div>
                            <div className="font-medium text-neutral-900">{client.client_name}</div>
                            <div className="text-xs text-neutral-500">{client.meta_user_id || client.client_id}</div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(client.status)}`}>
                            {getStatusIcon(client.status)}
                            {getStatusLabel(client.status)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-neutral-600">
                          {client.meta_ad_account_id || '-'}
                        </td>
                        <td className="py-3 px-2">
                          {client.daysUntilExpiry !== null ? (
                            <span className={client.isExpiringSoon ? 'text-amber-600 font-medium' : 'text-neutral-600'}>
                              {client.daysUntilExpiry}일
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-2 text-neutral-600">
                          {client.dataCount.toLocaleString()}건
                        </td>
                        <td className="py-3 px-2 text-neutral-500 text-xs">
                          {new Date(client.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {client.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => handleApprove(client)}
                                disabled={actionLoading === client.id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {actionLoading === client.id ? '처리 중...' : '승인'}
                              </Button>
                            )}
                            {client.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSuspend(client)}
                                disabled={actionLoading === client.id}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                중지
                              </Button>
                            )}
                            {(client.status === 'suspended' || client.status === 'expired') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleActivate(client)}
                                disabled={actionLoading === client.id}
                              >
                                {actionLoading === client.id ? '처리 중...' : '재활성화'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 승인 모달 */}
      {showApproveModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">클라이언트 승인</h3>
            <p className="text-neutral-600 mb-4">
              <strong>{selectedClient.client_name}</strong>을(를) 승인하시겠습니까?
            </p>
            <p className="text-sm text-neutral-500 mb-6">
              승인하면 서비스가 활성화되고 데이터 수집이 시작됩니다.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowApproveModal(false)} className="flex-1">
                취소
              </Button>
              <Button onClick={confirmApprove} className="flex-1 bg-green-600 hover:bg-green-700">
                승인
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 일시 중지 모달 */}
      {showSuspendModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">서비스 일시 중지</h3>
            <p className="text-neutral-600 mb-4">
              <strong>{selectedClient.client_name}</strong>의 서비스를 일시 중지합니다.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                중지 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="예: 결제 미납, 계약 종료 등"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowSuspendModal(false)} className="flex-1">
                취소
              </Button>
              <Button
                onClick={confirmSuspend}
                disabled={!suspendReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                일시 중지
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getStatusBadgeClass(status: ClientStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800'
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'suspended':
      return 'bg-red-100 text-red-800'
    case 'expired':
      return 'bg-neutral-100 text-neutral-800'
    default:
      return 'bg-neutral-100 text-neutral-800'
  }
}

function getStatusLabel(status: ClientStatus): string {
  switch (status) {
    case 'pending':
      return '승인 대기'
    case 'active':
      return '활성'
    case 'suspended':
      return '일시 중지'
    case 'expired':
      return '만료'
    default:
      return status
  }
}

function getStatusIcon(status: ClientStatus) {
  switch (status) {
    case 'pending':
      return <Clock className="w-3 h-3" />
    case 'active':
      return <CheckCircle className="w-3 h-3" />
    case 'suspended':
      return <XCircle className="w-3 h-3" />
    case 'expired':
      return <AlertTriangle className="w-3 h-3" />
    default:
      return null
  }
}
