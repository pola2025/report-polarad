'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Phone,
  Search,
  Loader2,
  MessageSquare,
  AlertTriangle,
  X,
  RefreshCw,
  Check,
  Pencil,
  Trash2,
  Globe,
  Megaphone,
  LogOut,
} from 'lucide-react'
import type {
  NarattonLead,
  NarattonLeadStatus,
} from '@/types/naratton-leads'
import { STATUS_CONFIG, ALL_STATUSES } from '@/types/naratton-leads'

const CHANNEL_LABEL = { homepage: '홈페이지', meta: 'Meta' }

interface NarattonStaffPortalProps {
  staffName: string
  onLogout: () => void
}

export function NarattonStaffPortal({ staffName, onLogout }: NarattonStaffPortalProps) {
  const [leads, setLeads] = useState<NarattonLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<NarattonLeadStatus | ''>('')
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedLead, setSelectedLead] = useState<NarattonLead | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('staff', staffName)
      if (statusFilter) params.set('status', statusFilter)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/naratton/leads?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')

      const data = await res.json()
      setLeads(data.leads || [])
    } catch (err) {
      console.error('loadData error:', err)
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [staffName, statusFilter, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateLead = async (lead: NarattonLead, updates: { status?: NarattonLeadStatus }) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/naratton/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, table_id: lead.table_id }),
      })
      if (res.ok) {
        const data = await res.json()
        setLeads(prev => prev.map(l => l.id === lead.id ? data.lead : l))
        if (selectedLead?.id === lead.id) setSelectedLead(data.lead)
      }
    } catch (err) {
      console.error('updateLead error:', err)
    } finally {
      setSaving(false)
    }
  }

  const addNote = async () => {
    if (!selectedLead || !noteText.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/naratton/leads/${selectedLead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText, author: staffName, table_id: selectedLead.table_id }),
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

  const editNote = async (noteIndex: number, content: string) => {
    if (!selectedLead) return
    setSaving(true)
    try {
      const res = await fetch(`/api/naratton/leads/${selectedLead.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteIndex, content, author: staffName, table_id: selectedLead.table_id }),
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

  const deleteNote = async (noteIndex: number) => {
    if (!selectedLead) return
    setSaving(true)
    try {
      const res = await fetch(`/api/naratton/leads/${selectedLead.id}/notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteIndex, table_id: selectedLead.table_id }),
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-indigo-600 border-b border-indigo-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">나라똔 리드관리</h1>
            <p className="text-xs text-indigo-200">담당자: {staffName}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1 text-sm text-indigo-200 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* 필터 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="이름 또는 연락처 검색..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as NarattonLeadStatus | '')}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">전체 상태</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500 self-center ml-auto">
              {leads.length}건
            </span>
          </div>
        </div>

        {/* 로딩 */}
        {loading && leads.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-500 text-sm">불러오는 중...</span>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="text-center py-12">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">{error}</p>
          </div>
        )}

        {/* 리드 목록 */}
        {!loading && !error && leads.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 text-sm">배정된 리드가 없습니다.</p>
          </div>
        )}

        <div className="space-y-3">
          {leads.map(lead => {
            const config = STATUS_CONFIG[lead.status] || STATUS_CONFIG['심사준비']
            const ChannelIcon = lead.channel === 'homepage' ? Globe : Megaphone
            const hasNotes = !!lead.notes?.trim()
            return (
              <div key={`${lead.channel}-${lead.id}`} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap md:flex-nowrap">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    lead.channel === 'homepage' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    <ChannelIcon className="w-3 h-3" />
                    {CHANNEL_LABEL[lead.channel]}
                  </span>
                  <span className="font-semibold text-sm text-gray-900">{lead.name || '(없음)'}</span>
                  <span className="hidden md:inline text-xs text-gray-400">{lead.phone}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                    {config.label}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto">
                    {lead.created_at ? new Date(lead.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2 md:hidden">{lead.phone}</p>
                <div className="flex items-center gap-2">
                  <select
                    value={lead.status}
                    onChange={e => updateLead(lead, { status: e.target.value as NarattonLeadStatus })}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ALL_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { setSelectedLead(lead); setShowDetail(true) }}
                    className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      hasNotes
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 ring-1 ring-amber-200'
                    }`}
                  >
                    <Pencil className="w-3 h-3" />
                    {hasNotes ? '메모확인' : '메모작성'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* 상세 슬라이드 */}
      {showDetail && selectedLead && (
        <StaffLeadDetail
          lead={selectedLead}
          noteText={noteText}
          setNoteText={setNoteText}
          saving={saving}
          onClose={() => { setShowDetail(false); setSelectedLead(null) }}
          onStatusChange={(status) => updateLead(selectedLead, { status })}
          onAddNote={addNote}
          onEditNote={editNote}
          onDeleteNote={deleteNote}
        />
      )}
    </div>
  )
}

// === 담당자용 리드 상세 ===
function StaffLeadDetail({
  lead,
  noteText,
  setNoteText,
  saving,
  onClose,
  onStatusChange,
  onAddNote,
  onEditNote,
  onDeleteNote,
}: {
  lead: NarattonLead
  noteText: string
  setNoteText: (v: string) => void
  saving: boolean
  onClose: () => void
  onStatusChange: (status: NarattonLeadStatus) => void
  onAddNote: () => void
  onEditNote: (noteIndex: number, content: string) => void
  onDeleteNote: (noteIndex: number) => void
}) {
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h3 className="font-semibold text-gray-900">리드 상세</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 기본 정보 */}
          <div>
            <h4 className="text-lg font-bold text-gray-900">{lead.name || '(이름 없음)'}</h4>
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
              <Phone className="w-4 h-4" />
              <span>{lead.phone}</span>
            </div>
            {lead.email && <p className="text-sm text-gray-500 mt-1">{lead.email}</p>}
          </div>

          {/* 채널 정보 */}
          {lead.channel === 'homepage' && (
            <div className="bg-emerald-50 rounded-lg p-3 text-xs space-y-1">
              {lead.company_name && <p><span className="text-emerald-600">회사:</span> {lead.company_name}</p>}
              {lead.consultation_type && <p><span className="text-emerald-600">유형:</span> {lead.consultation_type}</p>}
              {lead.region && <p><span className="text-emerald-600">지역:</span> {lead.region}</p>}
              {lead.request_content && <p><span className="text-emerald-600">요청:</span> {lead.request_content}</p>}
            </div>
          )}
          {lead.channel === 'meta' && (
            <div className="bg-blue-50 rounded-lg p-3 text-xs space-y-1">
              {lead.ad_name && <p><span className="text-blue-600">광고:</span> {lead.ad_name}</p>}
              {lead.business_type && <p><span className="text-blue-600">사업자:</span> {lead.business_type}</p>}
              {lead.region && <p><span className="text-blue-600">지역:</span> {lead.region}</p>}
            </div>
          )}

          {/* 상태 변경 */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">상태</label>
            <select
              value={lead.status}
              onChange={e => onStatusChange(e.target.value as NarattonLeadStatus)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* 메모 */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              메모
            </h5>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="메모 입력..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={e => { if (e.key === 'Enter') onAddNote() }}
              />
              <button
                onClick={onAddNote}
                disabled={saving || !noteText.trim()}
                className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '추가'}
              </button>
            </div>

            {lead.notes ? (
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                {lead.notes.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} className="group flex items-start gap-1 py-1.5 border-b border-gray-100 last:border-0">
                    {editingNoteIndex === i ? (
                      <div className="flex-1 flex gap-1">
                        <input
                          type="text"
                          value={editingNoteContent}
                          onChange={e => setEditingNoteContent(e.target.value)}
                          className="flex-1 text-xs border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                          onClick={() => { if (editingNoteContent.trim()) { onEditNote(i, editingNoteContent.trim()); setEditingNoteIndex(null) } }}
                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={() => setEditingNoteIndex(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="flex-1 text-xs text-gray-700">{line}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              const match = line.match(/^\[.*?\]\s*.*?:\s*(.+?)(\s*\(수정됨\))?$/)
                              setEditingNoteContent(match ? match[1] : line)
                              setEditingNoteIndex(i)
                            }}
                            className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm('삭제하시겠습니까?')) onDeleteNote(i) }}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

          <div className="text-xs text-gray-400 pt-3 border-t border-gray-100">
            <p>접수일: {lead.created_at ? new Date(lead.created_at).toLocaleString('ko-KR') : '-'}</p>
            <p>채널: {CHANNEL_LABEL[lead.channel]}</p>
          </div>
        </div>
      </div>
    </>
  )
}
