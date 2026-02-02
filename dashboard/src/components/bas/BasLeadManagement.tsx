'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Users,
  Phone,
  Search,
  Loader2,
  MessageSquare,
  UserCheck,
  AlertTriangle,
  X,
  Plus,
  RefreshCw,
  Ban,
  CheckCircle2,
  Clock,
  PhoneOff,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react'
import type {
  BasLead,
  BasStaff,
  BasLeadSummary,
  LeadStatus,
} from '@/types/bas-leads'
import { BasLeadStats } from './BasLeadStats'

// === 상태 배지 색상 ===
const STATUS_COLORS: Record<LeadStatus, { bg: string; text: string; icon: typeof Clock }> = {
  '접수': { bg: 'bg-blue-50', text: 'text-blue-700', icon: Clock },
  '통화완료': { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: Phone },
  '부재': { bg: 'bg-gray-100', text: 'text-gray-600', icon: PhoneOff },
  '수강등록': { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2 },
}

const ALL_STATUSES: LeadStatus[] = ['접수', '통화완료', '부재', '수강등록']

// === 메인 컴포넌트 ===
interface BasLeadManagementProps {
  clientSlug: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BasLeadManagement({ clientSlug }: BasLeadManagementProps) {
  // Data states
  const [leads, setLeads] = useState<BasLead[]>([])
  const [summary, setSummary] = useState<BasLeadSummary | null>(null)
  const [staff, setStaff] = useState<BasStaff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [staffFilter, setStaffFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [blacklistOnly, setBlacklistOnly] = useState(false)
  const [duplicatesOnly, setDuplicatesOnly] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 100

  // UI states
  const [selectedLead, setSelectedLead] = useState<BasLead | null>(null)
  const [relatedLeads, setRelatedLeads] = useState<BasLead[]>([])
  const [showDetail, setShowDetail] = useState(false)
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteAuthor, setNoteAuthor] = useState('')
  const [saving, setSaving] = useState(false)

  // === 데이터 로드 ===
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (staffFilter) params.set('staff', staffFilter)
      if (searchQuery) params.set('search', searchQuery)
      if (blacklistOnly) params.set('blacklisted', 'true')
      if (duplicatesOnly) params.set('duplicatesOnly', 'true')
      params.set('page', String(page))

      const [leadsRes, staffRes] = await Promise.all([
        fetch(`/api/bas/leads?${params.toString()}`),
        fetch('/api/bas/staff'),
      ])

      if (!leadsRes.ok) throw new Error('Failed to fetch leads')

      const leadsData = await leadsRes.json()
      setLeads(leadsData.leads || [])
      setSummary(leadsData.summary || null)
      setHasMore(leadsData.hasMore || false)
      setTotal(leadsData.total || 0)

      if (staffRes.ok) {
        const staffData = await staffRes.json()
        setStaff(staffData.staff || [])
      }
    } catch (err) {
      console.error('loadData error:', err)
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, staffFilter, searchQuery, blacklistOnly, duplicatesOnly, page])

  useEffect(() => {
    loadData()
  }, [loadData])

  // === 리드 상세 로드 ===
  const openLeadDetail = async (lead: BasLead) => {
    setSelectedLead(lead)
    setShowDetail(true)
    try {
      const res = await fetch(`/api/bas/leads/${lead.id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedLead(data.lead)
        setRelatedLeads(data.relatedLeads || [])
      }
    } catch {
      // 실패 시 기존 데이터 유지
    }
  }

  // === 리드 업데이트 ===
  const updateLead = async (leadId: string, updates: { status?: LeadStatus; assigned_staff?: string; blacklisted?: boolean }) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/bas/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, last_updated_by: noteAuthor || '관리자' }),
      })
      if (res.ok) {
        const data = await res.json()
        // 로컬 상태 업데이트
        setLeads(prev => prev.map(l => l.id === leadId ? data.lead : l))
        if (selectedLead?.id === leadId) setSelectedLead(data.lead)
        // 요약도 갱신
        loadData()
      }
    } catch (err) {
      console.error('updateLead error:', err)
    } finally {
      setSaving(false)
    }
  }

  // === 메모 추가 ===
  const addNote = async () => {
    if (!selectedLead || !noteText.trim() || !noteAuthor.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/bas/leads/${selectedLead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText, author: noteAuthor }),
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedLead(data.lead)
        setLeads(prev => prev.map(l => l.id === data.lead.id ? data.lead : l))
        setNoteText('')
      }
    } catch (err) {
      console.error('addNote error:', err)
    } finally {
      setSaving(false)
    }
  }

  // === 메모 수정 ===
  const editNote = async (noteIndex: number, content: string) => {
    if (!selectedLead || !noteAuthor.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/bas/leads/${selectedLead.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteIndex, content, author: noteAuthor }),
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedLead(data.lead)
        setLeads(prev => prev.map(l => l.id === data.lead.id ? data.lead : l))
      }
    } catch (err) {
      console.error('editNote error:', err)
    } finally {
      setSaving(false)
    }
  }

  // === 메모 삭제 ===
  const deleteNote = async (noteIndex: number) => {
    if (!selectedLead) return
    setSaving(true)
    try {
      const res = await fetch(`/api/bas/leads/${selectedLead.id}/notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteIndex }),
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedLead(data.lead)
        setLeads(prev => prev.map(l => l.id === data.lead.id ? data.lead : l))
      }
    } catch (err) {
      console.error('deleteNote error:', err)
    } finally {
      setSaving(false)
    }
  }

  // === 담당자 추가 ===
  const addStaff = async (name: string) => {
    try {
      const res = await fetch('/api/bas/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const data = await res.json()
        setStaff(prev => [...prev, data.staff])
      }
    } catch (err) {
      console.error('addStaff error:', err)
    }
  }

  // === 담당자 비활성화 ===
  const toggleStaffActive = async (staffId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/bas/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })
      if (res.ok) {
        const data = await res.json()
        setStaff(prev => prev.map(s => s.id === staffId ? data.staff : s))
      }
    } catch (err) {
      console.error('toggleStaffActive error:', err)
    }
  }

  // === 담당자 삭제 ===
  const deleteStaff = async (staffId: string) => {
    try {
      const res = await fetch(`/api/bas/staff/${staffId}`, { method: 'DELETE' })
      if (res.ok) {
        setStaff(prev => prev.filter(s => s.id !== staffId))
      }
    } catch (err) {
      console.error('deleteStaff error:', err)
    }
  }

  // === 로딩 화면 ===
  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
        <span className="text-gray-500">리드 데이터 불러오는 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <p className="text-gray-600">{error}</p>
        <button onClick={loadData} className="mt-3 text-sm text-blue-600 hover:underline">
          다시 시도
        </button>
      </div>
    )
  }

  const activeStaff = staff.filter(s => s.is_active)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* === 요약 카드 === */}
      {summary && <SummaryCards summary={summary} />}

      {/* === 접수 추이 + 캠페인 성과 === */}
      <BasLeadStats />

      {/* === 필터 바 === */}
      <FilterBar
        statusFilter={statusFilter}
        setStatusFilter={(v) => { setStatusFilter(v); setPage(1) }}
        staffFilter={staffFilter}
        setStaffFilter={(v) => { setStaffFilter(v); setPage(1) }}
        searchQuery={searchQuery}
        setSearchQuery={(v) => { setSearchQuery(v); setPage(1) }}
        blacklistOnly={blacklistOnly}
        setBlacklistOnly={(v) => { setBlacklistOnly(v); setPage(1) }}
        duplicatesOnly={duplicatesOnly}
        setDuplicatesOnly={(v) => { setDuplicatesOnly(v); setPage(1) }}
        staffList={activeStaff}
        onRefresh={loadData}
        onManageStaff={() => setShowStaffModal(true)}
        loading={loading}
      />

      {/* === 리드 목록: 모바일 카드 === */}
      <div className="md:hidden space-y-3">
        {leads.length === 0 ? (
          <EmptyState />
        ) : (
          leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              staffList={activeStaff}
              onStatusChange={(status) => updateLead(lead.id, { status })}
              onStaffChange={(assigned_staff) => updateLead(lead.id, { assigned_staff })}
              onDetail={() => openLeadDetail(lead)}
            />
          ))
        )}
      </div>

      {/* === 리드 목록: 데스크탑 테이블 === */}
      <div className="hidden md:block">
        {leads.length === 0 ? (
          <EmptyState />
        ) : (
          <LeadTable
            leads={leads}
            staffList={activeStaff}
            onStatusChange={(id, status) => updateLead(id, { status })}
            onStaffChange={(id, assigned_staff) => updateLead(id, { assigned_staff })}
            onDetail={openLeadDetail}
            onBlacklist={(id, blacklisted) => updateLead(id, { blacklisted })}
          />
        )}
      </div>

      {/* === 페이지네이션 === */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-500">
            전체 <span className="font-semibold text-gray-900">{total.toLocaleString()}</span>건 중{' '}
            <span className="font-semibold text-gray-900">{((page - 1) * PAGE_SIZE) + 1}~{Math.min(page * PAGE_SIZE, total)}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              이전
            </button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {page} / {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* === 리드 상세 슬라이드 === */}
      {showDetail && selectedLead && (
        <LeadDetailSlide
          lead={selectedLead}
          relatedLeads={relatedLeads}
          staffList={activeStaff}
          noteText={noteText}
          setNoteText={setNoteText}
          noteAuthor={noteAuthor}
          setNoteAuthor={setNoteAuthor}
          saving={saving}
          onClose={() => { setShowDetail(false); setSelectedLead(null); setRelatedLeads([]) }}
          onStatusChange={(status) => updateLead(selectedLead.id, { status })}
          onStaffChange={(assigned_staff) => updateLead(selectedLead.id, { assigned_staff })}
          onBlacklist={(blacklisted) => updateLead(selectedLead.id, { blacklisted })}
          onAddNote={addNote}
          onEditNote={editNote}
          onDeleteNote={deleteNote}
        />
      )}

      {/* === 담당자 관리 모달 === */}
      {showStaffModal && (
        <StaffModal
          staff={staff}
          onClose={() => setShowStaffModal(false)}
          onAdd={addStaff}
          onToggle={toggleStaffActive}
          onDelete={deleteStaff}
        />
      )}
    </div>
  )
}

// ==========================================
// 하위 컴포넌트들
// ==========================================

// === 요약 카드 ===
function SummaryCards({ summary }: { summary: BasLeadSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-xs text-gray-500">전체 접수</span>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{summary.total.toLocaleString()}</p>
      </div>
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-amber-50 rounded-lg">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-xs text-gray-500">오늘 신규</span>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{summary.today_new}</p>
      </div>
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-green-50 rounded-lg">
            <UserCheck className="w-4 h-4 text-green-600" />
          </div>
          <span className="text-xs text-gray-500">수강등록</span>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{summary.by_status['수강등록']}</p>
      </div>
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-purple-50 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-xs text-gray-500">전환율</span>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{summary.conversion_rate}%</p>
      </div>
    </div>
  )
}

// === 필터 바 ===
function FilterBar({
  statusFilter, setStatusFilter,
  staffFilter, setStaffFilter,
  searchQuery, setSearchQuery,
  blacklistOnly, setBlacklistOnly,
  duplicatesOnly, setDuplicatesOnly,
  staffList,
  onRefresh,
  onManageStaff,
  loading,
}: {
  statusFilter: LeadStatus | ''
  setStatusFilter: (v: LeadStatus | '') => void
  staffFilter: string
  setStaffFilter: (v: string) => void
  searchQuery: string
  setSearchQuery: (v: string) => void
  blacklistOnly: boolean
  setBlacklistOnly: (v: boolean) => void
  duplicatesOnly: boolean
  setDuplicatesOnly: (v: boolean) => void
  staffList: BasStaff[]
  onRefresh: () => void
  onManageStaff: () => void
  loading: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 space-y-3">
      {/* 상단: 검색 + 새로고침 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="이름 또는 연락처 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 하단: 필터들 */}
      <div className="flex flex-wrap gap-2">
        {/* 상태 필터 */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as LeadStatus | '')}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체 상태</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* 담당자 필터 */}
        <select
          value={staffFilter}
          onChange={e => setStaffFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체 담당자</option>
          {staffList.map(s => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>

        {/* 블랙리스트 토글 */}
        <button
          onClick={() => setBlacklistOnly(!blacklistOnly)}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            blacklistOnly
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Ban className="w-3.5 h-3.5 inline mr-1" />
          블랙리스트
        </button>

        {/* 재접수 토글 */}
        <button
          onClick={() => setDuplicatesOnly(!duplicatesOnly)}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            duplicatesOnly
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
          재접수
        </button>

        {/* 담당자 관리 */}
        <button
          onClick={onManageStaff}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors ml-auto"
        >
          <Users className="w-3.5 h-3.5 inline mr-1" />
          담당자 관리
        </button>
      </div>
    </div>
  )
}

// === 빈 상태 ===
function EmptyState() {
  return (
    <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
      <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-sm">조건에 맞는 리드가 없습니다.</p>
    </div>
  )
}

// === 상태 배지 ===
function StatusBadge({ status }: { status: LeadStatus }) {
  const config = STATUS_COLORS[status] || STATUS_COLORS['접수']
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  )
}

// === 모바일 리드 카드 ===
function LeadCard({
  lead,
  staffList,
  onStatusChange,
  onStaffChange,
  onDetail,
}: {
  lead: BasLead
  staffList: BasStaff[]
  onStatusChange: (status: LeadStatus) => void
  onStaffChange: (staff: string) => void
  onDetail: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      {/* 이름 + 배지 */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900" title={lead.name}>
              {lead.name ? (lead.name.length > 6 ? lead.name.slice(0, 6) + '…' : lead.name) : '(없음)'}
            </span>
            {lead.submission_count > 1 && (
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded-full">
                재신청 ({lead.submission_count}회)
              </span>
            )}
            {lead.blacklisted && (
              <span className="px-1.5 py-0.5 bg-red-50 text-red-700 text-[10px] font-medium rounded-full">
                블랙리스트
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{lead.phone}</p>
          {(lead.ad_name || lead.campaign) && (
            <p className="text-[10px] text-gray-300 truncate max-w-[160px]" title={lead.ad_name || lead.campaign}>
              {lead.ad_name || lead.campaign}
            </p>
          )}
        </div>
        <button
          onClick={onDetail}
          className="text-xs text-blue-600 hover:underline shrink-0"
        >
          상세
        </button>
      </div>

      {/* 상태 + 담당자 드롭다운 */}
      <div className="flex gap-2">
        <select
          value={lead.status}
          onChange={e => onStatusChange(e.target.value as LeadStatus)}
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={lead.assigned_staff}
          onChange={e => onStaffChange(e.target.value)}
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">담당자 미지정</option>
          {staffList.map(s => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* 접수일 */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
        <span>{lead.created_at ? new Date(lead.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}</span>
        {lead.notes && (
          <span className="flex items-center gap-0.5">
            <MessageSquare className="w-3 h-3" />
            메모 있음
          </span>
        )}
      </div>
    </div>
  )
}

// === 데스크탑 리드 테이블 ===
function LeadTable({
  leads,
  staffList,
  onStatusChange,
  onStaffChange,
  onDetail,
  onBlacklist,
}: {
  leads: BasLead[]
  staffList: BasStaff[]
  onStatusChange: (id: string, status: LeadStatus) => void
  onStaffChange: (id: string, staff: string) => void
  onDetail: (lead: BasLead) => void
  onBlacklist: (id: string, blacklisted: boolean) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-3 font-medium text-gray-500 w-[100px]">이름</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">연락처</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">담당자</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">플랫폼</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">접수일</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">횟수</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">메모</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map(lead => (
              <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                {/* 이름 + 배지 */}
                <td className="px-3 py-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onDetail(lead)}
                        className="font-medium text-gray-900 hover:text-blue-600 transition-colors truncate max-w-[72px]"
                        title={lead.name}
                      >
                        {lead.name ? (lead.name.length > 6 ? lead.name.slice(0, 6) + '…' : lead.name) : '(없음)'}
                      </button>
                      {lead.submission_count > 1 && (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded-full whitespace-nowrap">
                          재신청 ({lead.submission_count}회)
                        </span>
                      )}
                      {lead.blacklisted && (
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-700 text-[10px] font-medium rounded-full">
                          BL
                        </span>
                      )}
                    </div>
                    {(lead.ad_name || lead.campaign) && (
                      <p className="text-[10px] text-gray-400 truncate max-w-[140px] mt-0.5" title={lead.ad_name || lead.campaign}>
                        {lead.ad_name || lead.campaign}
                      </p>
                    )}
                  </div>
                </td>

                {/* 연락처 */}
                <td className="px-4 py-3 text-gray-600">{lead.phone}</td>

                {/* 상태 드롭다운 */}
                <td className="px-4 py-3">
                  <select
                    value={lead.status}
                    onChange={e => onStatusChange(lead.id, e.target.value as LeadStatus)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {ALL_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>

                {/* 담당자 드롭다운 */}
                <td className="px-4 py-3">
                  <select
                    value={lead.assigned_staff}
                    onChange={e => onStaffChange(lead.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">미지정</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </td>

                {/* 플랫폼 */}
                <td className="px-4 py-3">
                  {lead.platform ? (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      lead.platform === 'fb' ? 'bg-blue-50 text-blue-700' :
                      lead.platform === 'ig' ? 'bg-pink-50 text-pink-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {lead.platform === 'fb' ? 'Facebook' : lead.platform === 'ig' ? 'Instagram' : lead.platform}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">-</span>
                  )}
                </td>

                {/* 접수일 */}
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {lead.created_at ? new Date(lead.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                </td>

                {/* 횟수 */}
                <td className="px-4 py-3 text-center">
                  {lead.submission_count > 1 ? (
                    <span className="text-amber-600 font-semibold">{lead.submission_count}</span>
                  ) : (
                    <span className="text-gray-400">1</span>
                  )}
                </td>

                {/* 메모 */}
                <td className="px-4 py-3 text-center">
                  {lead.notes ? (
                    <MessageSquare className="w-4 h-4 text-blue-500 mx-auto" />
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>

                {/* 액션 */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => onDetail(lead)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-blue-600 hover:bg-blue-50 transition-colors bg-white"
                    >
                      상세
                    </button>
                    <button
                      onClick={() => onBlacklist(lead.id, !lead.blacklisted)}
                      className={`text-xs border rounded-lg px-2 py-1 transition-colors ${lead.blacklisted ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100' : 'border-gray-200 text-gray-500 bg-white hover:bg-red-50 hover:text-red-600'}`}
                    >
                      블랙
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// === 리드 상세 슬라이드 패널 ===
function LeadDetailSlide({
  lead,
  relatedLeads,
  staffList,
  noteText,
  setNoteText,
  noteAuthor,
  setNoteAuthor,
  saving,
  onClose,
  onStatusChange,
  onStaffChange,
  onBlacklist,
  onAddNote,
  onEditNote,
  onDeleteNote,
}: {
  lead: BasLead
  relatedLeads: BasLead[]
  staffList: BasStaff[]
  noteText: string
  setNoteText: (v: string) => void
  noteAuthor: string
  setNoteAuthor: (v: string) => void
  saving: boolean
  onClose: () => void
  onStatusChange: (status: LeadStatus) => void
  onStaffChange: (staff: string) => void
  onBlacklist: (blacklisted: boolean) => void
  onAddNote: () => void
  onEditNote: (noteIndex: number, content: string) => void
  onDeleteNote: (noteIndex: number) => void
}) {
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  return (
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* 슬라이드 패널 */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h3 className="font-semibold text-gray-900">리드 상세</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* 연락처 정보 */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-bold text-gray-900">{lead.name || '(이름 없음)'}</h4>
              {lead.submission_count > 1 && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                  재신청 ({lead.submission_count}회)
                </span>
              )}
              {lead.blacklisted && (
                <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs font-medium rounded-full">
                  블랙리스트
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4" />
              <span>{lead.phone}</span>
            </div>
            {lead.email && (
              <p className="text-sm text-gray-500">{lead.email}</p>
            )}
            {lead.message && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">{lead.message}</div>
            )}
          </div>

          {/* 상태 & 담당자 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">상태</label>
              <select
                value={lead.status}
                onChange={e => onStatusChange(e.target.value as LeadStatus)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">담당자</label>
              <select
                value={lead.assigned_staff}
                onChange={e => onStaffChange(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">미지정</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 블랙리스트 토글 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">블랙리스트</span>
            </div>
            <button
              onClick={() => onBlacklist(!lead.blacklisted)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                lead.blacklisted ? 'bg-red-500' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                lead.blacklisted ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* 광고 출처 */}
          {(lead.campaign || lead.platform) && (
            <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3">
              <h5 className="text-xs font-medium text-indigo-700 mb-2">광고 출처</h5>
              <div className="space-y-1 text-xs text-indigo-800">
                {lead.platform && (
                  <p>플랫폼: <span className="font-medium">{lead.platform === 'fb' ? 'Facebook' : lead.platform === 'ig' ? 'Instagram' : lead.platform}</span></p>
                )}
                {lead.campaign && <p>캠페인: {lead.campaign}</p>}
                {lead.ad_name && <p>광고: {lead.ad_name}</p>}
              </div>
            </div>
          )}

          {/* 접수 이력 (재접수) */}
          {lead.submission_history && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
              <h5 className="text-xs font-medium text-amber-700 mb-2">접수 이력 ({lead.submission_count}회)</h5>
              <div className="space-y-1 text-xs text-amber-800">
                {lead.submission_history.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              {(lead.previous_status || lead.previous_staff) && (
                <div className="mt-2 pt-2 border-t border-amber-200 space-y-1 text-xs text-amber-700">
                  {lead.previous_status && <p>이전 상태: {lead.previous_status}</p>}
                  {lead.previous_staff && <p>이전 담당자: {lead.previous_staff}</p>}
                </div>
              )}
            </div>
          )}

          {/* 중복 리드 */}
          {relatedLeads.length > 0 && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
              <h5 className="text-xs font-medium text-blue-700 mb-2">
                같은 연락처 리드 ({relatedLeads.length}건)
              </h5>
              <div className="space-y-2">
                {relatedLeads.map(rl => (
                  <div key={rl.id} className="flex items-center justify-between text-xs">
                    <span className="text-blue-800">
                      {rl.created_at ? new Date(rl.created_at).toLocaleDateString('ko-KR') : '-'}
                    </span>
                    <StatusBadge status={rl.status} />
                    <span className="text-blue-600">{rl.assigned_staff || '미지정'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 메모 섹션 */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              메모
            </h5>

            {/* 메모 추가 폼 */}
            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={noteAuthor}
                onChange={e => setNoteAuthor(e.target.value)}
                placeholder="작성자 이름"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="메모 입력..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => { if (e.key === 'Enter') onAddNote() }}
                />
                <button
                  onClick={onAddNote}
                  disabled={saving || !noteText.trim() || !noteAuthor.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '추가'}
                </button>
              </div>
            </div>

            {/* 메모 목록 */}
            {lead.notes ? (
              <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                {lead.notes.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} className="group flex items-start gap-1 py-1.5 border-b border-gray-100 last:border-0">
                    {editingNoteIndex === i ? (
                      <div className="flex-1 flex gap-1">
                        <input
                          type="text"
                          value={editingNoteContent}
                          onChange={e => setEditingNoteContent(e.target.value)}
                          className="flex-1 text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && editingNoteContent.trim()) {
                              onEditNote(i, editingNoteContent.trim())
                              setEditingNoteIndex(null)
                            }
                            if (e.key === 'Escape') setEditingNoteIndex(null)
                          }}
                        />
                        <button
                          onClick={() => {
                            if (editingNoteContent.trim()) {
                              onEditNote(i, editingNoteContent.trim())
                              setEditingNoteIndex(null)
                            }
                          }}
                          disabled={saving}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingNoteIndex(null)}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="flex-1 text-xs text-gray-700">{line}</p>
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => {
                              // 메모 본문만 추출: [2026-01-31 14:00] 작성자: 내용 → 내용
                              const match = line.match(/^\[.*?\]\s*.*?:\s*(.+?)(\s*\(수정됨\))?$/)
                              setEditingNoteContent(match ? match[1] : line)
                              setEditingNoteIndex(i)
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="수정"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('이 메모를 삭제하시겠습니까?')) {
                                onDeleteNote(i)
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">메모가 없습니다.</p>
            )}
          </div>

          {/* 접수 정보 */}
          <div className="text-xs text-gray-400 space-y-1 pt-3 border-t border-gray-100">
            <p>접수일: {lead.created_at ? new Date(lead.created_at).toLocaleString('ko-KR') : '-'}</p>
            <p>최초 접수: {lead.first_submission_date ? new Date(lead.first_submission_date).toLocaleDateString('ko-KR') : '-'}</p>
            {lead.last_updated_by && <p>마지막 수정: {lead.last_updated_by}</p>}
            <p className="text-[10px] text-gray-300">ID: {lead.id}</p>
          </div>
        </div>
      </div>
    </>
  )
}

// === 담당자 관리 모달 ===
function StaffModal({
  staff,
  onClose,
  onAdd,
  onToggle,
  onDelete,
}: {
  staff: BasStaff[]
  onClose: () => void
  onAdd: (name: string) => void
  onToggle: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
}) {
  const [newName, setNewName] = useState('')

  const handleAdd = () => {
    if (!newName.trim()) return
    onAdd(newName.trim())
    setNewName('')
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
          {/* 헤더 */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">담당자 관리</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* 추가 폼 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="새 담당자 이름"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* 목록 */}
            <div className="divide-y divide-gray-100">
              {staff.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2">
                  <span className={`text-sm ${s.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                    {s.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggle(s.id, s.is_active)}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                        s.is_active
                          ? 'text-amber-600 hover:bg-amber-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {s.is_active ? '비활성화' : '활성화'}
                    </button>
                    <button
                      onClick={() => { if (confirm(`'${s.name}' 담당자를 삭제하시겠습니까?`)) onDelete(s.id) }}
                      className="text-xs px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
              {staff.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">등록된 담당자가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
