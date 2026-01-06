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
  Plus,
  Edit,
} from 'lucide-react'
import Link from 'next/link'

type ClientStatus = 'pending' | 'active' | 'suspended' | 'expired'

interface Client {
  id: string
  airtable_record_id?: string
  client_id: string
  client_name: string
  slug: string | null
  client_type?: string
  meta_ad_account_id: string | null
  meta_user_id: string | null
  meta_token_expires_at: string | null
  meta_metric_type?: string
  airtable_base_id?: string
  airtable_table_id?: string
  status: ClientStatus
  is_active: boolean
  naver_type?: string
  naver_enabled?: boolean
  naver_fixed_budget?: number | null
  naver_show_keywords?: boolean
  naver_show_detail_tab?: boolean
  telegram_enabled?: boolean
  telegram_chat_id?: string | null
  approved_at: string | null
  approved_by: string | null
  service_start_date: string | null
  service_end_date: string | null
  suspended_at: string | null
  suspension_reason: string | null
  dataCount: number
  daysUntilExpiry: number | null
  isExpiringSoon: boolean
  created_at: string
}

interface ClientForm {
  client_name: string
  slug: string
  client_type: string
  meta_metric_type: string
  airtable_base_id: string
  airtable_table_id: string
  naver_type: string
  naver_enabled: boolean
  naver_fixed_budget: string
  naver_show_keywords: boolean
  naver_show_detail_tab: boolean
  telegram_enabled: boolean
  telegram_chat_id: string
  service_start_date: string
}

const initialFormState: ClientForm = {
  client_name: '',
  slug: '',
  client_type: 'other',
  meta_metric_type: 'lead',
  airtable_base_id: '',
  airtable_table_id: '',
  naver_type: 'none',
  naver_enabled: false,
  naver_fixed_budget: '',
  naver_show_keywords: true,
  naver_show_detail_tab: true,
  telegram_enabled: false,
  telegram_chat_id: '',
  service_start_date: new Date().toISOString().split('T')[0],
}

// 클라이언트 유형별 기본 설정
const CLIENT_TYPE_DEFAULTS: Record<string, Partial<ClientForm>> = {
  restaurant: {
    meta_metric_type: 'video',
    naver_enabled: true,
    naver_type: 'place',
    naver_show_keywords: true,
    naver_show_detail_tab: true,
  },
  franchise: {
    meta_metric_type: 'lead',
    naver_enabled: true,
    naver_type: 'place',
    naver_show_keywords: true,
    naver_show_detail_tab: true,
  },
  consulting: {
    meta_metric_type: 'lead',
    naver_enabled: false,
    naver_type: 'none',
  },
  local: {
    meta_metric_type: 'lead',
    naver_enabled: true,
    naver_type: 'place',
    naver_show_keywords: true,
    naver_show_detail_tab: true,
  },
  other: {
    meta_metric_type: 'lead',
    naver_enabled: false,
    naver_type: 'none',
  },
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
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [formData, setFormData] = useState<ClientForm>(initialFormState)
  const [formLoading, setFormLoading] = useState(false)

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

  // 클라이언트 추가 모달 열기
  const openAddModal = () => {
    setFormData(initialFormState)
    setShowAddModal(true)
  }

  // 클라이언트 수정 모달 열기
  const openEditModal = (client: Client) => {
    setSelectedClient(client)
    setFormData({
      client_name: client.client_name || '',
      slug: client.slug || '',
      client_type: client.client_type || 'other',
      meta_metric_type: client.meta_metric_type || 'lead',
      airtable_base_id: client.airtable_base_id || '',
      airtable_table_id: client.airtable_table_id || '',
      naver_type: client.naver_type || 'none',
      naver_enabled: client.naver_enabled || false,
      naver_fixed_budget: client.naver_fixed_budget?.toString() || '',
      naver_show_keywords: client.naver_show_keywords ?? true,
      naver_show_detail_tab: client.naver_show_detail_tab ?? true,
      telegram_enabled: client.telegram_enabled || false,
      telegram_chat_id: client.telegram_chat_id || '',
      service_start_date: client.service_start_date || new Date().toISOString().split('T')[0],
    })
    setShowEditModal(true)
  }

  // 폼 입력 핸들러
  const handleFormChange = (field: keyof ClientForm, value: string | boolean) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }

      // 클라이언트 유형 변경 시 기본값 자동 적용
      if (field === 'client_type' && typeof value === 'string') {
        const defaults = CLIENT_TYPE_DEFAULTS[value]
        if (defaults) {
          return { ...newData, ...defaults }
        }
      }

      return newData
    })
  }

  // slug 자동 생성 (client_name에서)
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  // 클라이언트 생성 제출
  const handleAddSubmit = async () => {
    if (!formData.client_name.trim() || !formData.slug.trim()) {
      alert('클라이언트명과 슬러그는 필수입니다.')
      return
    }

    setFormLoading(true)
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          client_name: formData.client_name,
          slug: formData.slug,
          client_type: formData.client_type,
          meta_metric_type: formData.meta_metric_type,
          airtable_base_id: formData.airtable_base_id || null,
          airtable_table_id: formData.airtable_table_id || null,
          naver_type: formData.naver_type,
          naver_enabled: formData.naver_enabled,
          naver_fixed_budget: formData.naver_fixed_budget ? Number(formData.naver_fixed_budget) : null,
          naver_show_keywords: formData.naver_show_keywords,
          naver_show_detail_tab: formData.naver_show_detail_tab,
          telegram_enabled: formData.telegram_enabled,
          telegram_chat_id: formData.telegram_chat_id || null,
          service_start_date: formData.service_start_date,
        }),
      })

      if (res.ok) {
        alert('클라이언트가 추가되었습니다.')
        setShowAddModal(false)
        setFormData(initialFormState)
        fetchData()
      } else {
        const error = await res.json()
        alert(`추가 실패: ${error.error}`)
      }
    } catch {
      alert('클라이언트 추가 중 오류 발생')
    } finally {
      setFormLoading(false)
    }
  }

  // 클라이언트 수정 제출
  const handleEditSubmit = async () => {
    if (!selectedClient?.airtable_record_id) {
      alert('수정할 수 없는 클라이언트입니다.')
      return
    }

    setFormLoading(true)
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          airtable_record_id: selectedClient.airtable_record_id,
          client_name: formData.client_name,
          slug: formData.slug,
          client_type: formData.client_type,
          meta_metric_type: formData.meta_metric_type,
          airtable_base_id: formData.airtable_base_id || null,
          airtable_table_id: formData.airtable_table_id || null,
          naver_type: formData.naver_type,
          naver_enabled: formData.naver_enabled,
          naver_fixed_budget: formData.naver_fixed_budget ? Number(formData.naver_fixed_budget) : null,
          naver_show_keywords: formData.naver_show_keywords,
          naver_show_detail_tab: formData.naver_show_detail_tab,
          telegram_enabled: formData.telegram_enabled,
          telegram_chat_id: formData.telegram_chat_id || null,
          service_start_date: formData.service_start_date,
        }),
      })

      if (res.ok) {
        alert('클라이언트 정보가 수정되었습니다.')
        setShowEditModal(false)
        setSelectedClient(null)
        fetchData()
      } else {
        const error = await res.json()
        alert(`수정 실패: ${error.error}`)
      }
    } catch {
      alert('클라이언트 수정 중 오류 발생')
    } finally {
      setFormLoading(false)
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
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openAddModal}>
              <Plus className="w-4 h-4 mr-2" />
              클라이언트 추가
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </div>
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditModal(client)}
                              className="text-neutral-600 hover:text-blue-600"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
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

      {/* 클라이언트 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-neutral-200 shrink-0">
              <h3 className="text-lg font-bold">새 클라이언트 추가</h3>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* 기본 정보 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  클라이언트명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => {
                    handleFormChange('client_name', e.target.value)
                    if (!formData.slug) {
                      handleFormChange('slug', generateSlug(e.target.value))
                    }
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: H.E.A 판교"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  슬러그 (URL용) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleFormChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: hea-pangyo"
                />
                <p className="text-xs text-neutral-500 mt-1">영문 소문자, 숫자, 하이픈만 사용</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  클라이언트 유형
                </label>
                <select
                  value={formData.client_type}
                  onChange={(e) => handleFormChange('client_type', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="restaurant">음식점</option>
                  <option value="franchise">프랜차이즈</option>
                  <option value="consulting">컨설팅</option>
                  <option value="local">지역업체</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  서비스 시작일
                </label>
                <input
                  type="date"
                  value={formData.service_start_date}
                  onChange={(e) => handleFormChange('service_start_date', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Meta 광고 설정 */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-neutral-800 mb-3">Meta 광고 설정</h4>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Meta 지표 유형
                  </label>
                  <select
                    value={formData.meta_metric_type}
                    onChange={(e) => handleFormChange('meta_metric_type', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="lead">리드 (전환 중심)</option>
                    <option value="video">영상 (조회수 중심)</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    리드: 전환수, CPA 중심 / 영상: 조회수, 평균시청시간 중심
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Airtable Base ID
                    </label>
                    <input
                      type="text"
                      value={formData.airtable_base_id}
                      onChange={(e) => handleFormChange('airtable_base_id', e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="app..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Airtable Table ID
                    </label>
                    <input
                      type="text"
                      value={formData.airtable_table_id}
                      onChange={(e) => handleFormChange('airtable_table_id', e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="tbl..."
                    />
                  </div>
                </div>
              </div>

              {/* 네이버 광고 설정 */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-neutral-800 mb-3">네이버 광고 설정</h4>

                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="naver_enabled"
                    checked={formData.naver_enabled}
                    onChange={(e) => handleFormChange('naver_enabled', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="naver_enabled" className="text-sm text-neutral-700">
                    네이버 광고 사용
                  </label>
                </div>

                {formData.naver_enabled && (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        네이버 광고 유형
                      </label>
                      <select
                        value={formData.naver_type}
                        onChange={(e) => handleFormChange('naver_type', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="none">없음</option>
                        <option value="naver">네이버 (파워링크)</option>
                        <option value="place">플레이스 광고</option>
                        <option value="both">둘 다</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        고정 예산 (원)
                      </label>
                      <input
                        type="number"
                        value={formData.naver_fixed_budget}
                        onChange={(e) => handleFormChange('naver_fixed_budget', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="예: 500000"
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="naver_show_keywords"
                          checked={formData.naver_show_keywords}
                          onChange={(e) => handleFormChange('naver_show_keywords', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="naver_show_keywords" className="text-sm text-neutral-700">
                          키워드 탭 표시
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="naver_show_detail_tab"
                          checked={formData.naver_show_detail_tab}
                          onChange={(e) => handleFormChange('naver_show_detail_tab', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="naver_show_detail_tab" className="text-sm text-neutral-700">
                          상세 탭 표시
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 텔레그램 설정 */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-neutral-800 mb-3">텔레그램 알림 설정</h4>

                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="telegram_enabled"
                    checked={formData.telegram_enabled}
                    onChange={(e) => handleFormChange('telegram_enabled', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="telegram_enabled" className="text-sm text-neutral-700">
                    텔레그램 알림 사용
                  </label>
                </div>

                {formData.telegram_enabled && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      채팅 ID
                    </label>
                    <input
                      type="text"
                      value={formData.telegram_chat_id}
                      onChange={(e) => handleFormChange('telegram_chat_id', e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="예: -1001234567890"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 shrink-0 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false)
                  setFormData(initialFormState)
                }}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={handleAddSubmit}
                disabled={formLoading || !formData.client_name.trim() || !formData.slug.trim()}
                className="flex-1"
              >
                {formLoading ? '추가 중...' : '추가'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 클라이언트 수정 모달 */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-neutral-200 shrink-0">
              <h3 className="text-lg font-bold">클라이언트 수정</h3>
              <p className="text-sm text-neutral-500 mt-1">ID: {selectedClient.id}</p>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* 기본 정보 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  클라이언트명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => handleFormChange('client_name', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  슬러그 (URL용) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleFormChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  클라이언트 유형
                </label>
                <select
                  value={formData.client_type}
                  onChange={(e) => handleFormChange('client_type', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="restaurant">음식점</option>
                  <option value="franchise">프랜차이즈</option>
                  <option value="consulting">컨설팅</option>
                  <option value="local">지역업체</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  서비스 시작일
                </label>
                <input
                  type="date"
                  value={formData.service_start_date}
                  onChange={(e) => handleFormChange('service_start_date', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Meta 광고 설정 */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-neutral-800 mb-3">Meta 광고 설정</h4>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Meta 지표 유형
                  </label>
                  <select
                    value={formData.meta_metric_type}
                    onChange={(e) => handleFormChange('meta_metric_type', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="lead">리드 (전환 중심)</option>
                    <option value="video">영상 (조회수 중심)</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    리드: 전환수, CPA 중심 / 영상: 조회수, 평균시청시간 중심
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Airtable Base ID
                    </label>
                    <input
                      type="text"
                      value={formData.airtable_base_id}
                      onChange={(e) => handleFormChange('airtable_base_id', e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="app..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Airtable Table ID
                    </label>
                    <input
                      type="text"
                      value={formData.airtable_table_id}
                      onChange={(e) => handleFormChange('airtable_table_id', e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="tbl..."
                    />
                  </div>
                </div>
              </div>

              {/* 네이버 광고 설정 */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-neutral-800 mb-3">네이버 광고 설정</h4>

                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="edit_naver_enabled"
                    checked={formData.naver_enabled}
                    onChange={(e) => handleFormChange('naver_enabled', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="edit_naver_enabled" className="text-sm text-neutral-700">
                    네이버 광고 사용
                  </label>
                </div>

                {formData.naver_enabled && (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        네이버 광고 유형
                      </label>
                      <select
                        value={formData.naver_type}
                        onChange={(e) => handleFormChange('naver_type', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="none">없음</option>
                        <option value="naver">네이버 (파워링크)</option>
                        <option value="place">플레이스 광고</option>
                        <option value="both">둘 다</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        고정 예산 (원)
                      </label>
                      <input
                        type="number"
                        value={formData.naver_fixed_budget}
                        onChange={(e) => handleFormChange('naver_fixed_budget', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="edit_naver_show_keywords"
                          checked={formData.naver_show_keywords}
                          onChange={(e) => handleFormChange('naver_show_keywords', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="edit_naver_show_keywords" className="text-sm text-neutral-700">
                          키워드 탭 표시
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="edit_naver_show_detail_tab"
                          checked={formData.naver_show_detail_tab}
                          onChange={(e) => handleFormChange('naver_show_detail_tab', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="edit_naver_show_detail_tab" className="text-sm text-neutral-700">
                          상세 탭 표시
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 텔레그램 설정 */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-neutral-800 mb-3">텔레그램 알림 설정</h4>

                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="edit_telegram_enabled"
                    checked={formData.telegram_enabled}
                    onChange={(e) => handleFormChange('telegram_enabled', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="edit_telegram_enabled" className="text-sm text-neutral-700">
                    텔레그램 알림 사용
                  </label>
                </div>

                {formData.telegram_enabled && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      채팅 ID
                    </label>
                    <input
                      type="text"
                      value={formData.telegram_chat_id}
                      onChange={(e) => handleFormChange('telegram_chat_id', e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 shrink-0 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedClient(null)
                }}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={handleEditSubmit}
                disabled={formLoading || !formData.client_name.trim() || !formData.slug.trim()}
                className="flex-1"
              >
                {formLoading ? '저장 중...' : '저장'}
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
