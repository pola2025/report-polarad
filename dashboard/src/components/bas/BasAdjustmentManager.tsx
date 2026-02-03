'use client'

import { useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import type { AdAdjustment, AdjustmentType, ImpactDirection } from '@/types/ad-adjustments'
import { ADJUSTMENT_TYPE_CONFIG, ADJUSTMENT_TYPES } from '@/types/ad-adjustments'

interface BasAdjustmentManagerProps {
  clientSlug: string
  adjustments: AdAdjustment[]
  onAdded: () => void
  onDeleted: () => void
}

export function BasAdjustmentManager({
  clientSlug,
  adjustments,
  onAdded,
  onDeleted,
}: BasAdjustmentManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 폼 상태
  const [date, setDate] = useState('')
  const [type, setType] = useState<AdjustmentType>('budget_change')
  const [description, setDescription] = useState('')
  const [impactDirection, setImpactDirection] = useState<ImpactDirection>('neutral')

  const resetForm = useCallback(() => {
    setDate('')
    setType('budget_change')
    setDescription('')
    setImpactDirection('neutral')
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!date || !type) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/ad-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSlug, date, type, description, impactDirection }),
      })
      if (res.ok) {
        resetForm()
        setIsModalOpen(false)
        onAdded()
      }
    } finally {
      setSaving(false)
    }
  }, [clientSlug, date, type, description, impactDirection, resetForm, onAdded])

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/ad-adjustments?id=${id}`, { method: 'DELETE' })
      if (res.ok) onDeleted()
    } finally {
      setDeletingId(null)
    }
  }, [onDeleted])

  return (
    <div>
      {/* 추가 버튼 + 조정일 칩 목록 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
        >
          <Plus className="w-3 h-3" />
          광고조정일 추가
        </button>

        {adjustments.map((adj) => {
          const cfg = ADJUSTMENT_TYPE_CONFIG[adj.type]
          return (
            <div
              key={adj.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: cfg.color }}
              />
              <span>{adj.date.slice(5)}</span>
              <span className="opacity-70">{cfg.label}</span>
              <button
                onClick={() => handleDelete(adj.id)}
                disabled={deletingId === adj.id}
                className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )
        })}
      </div>

      {/* 추가 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">광고조정일 추가</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 날짜 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 조정 유형 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">조정 유형</label>
                <div className="grid grid-cols-2 gap-2">
                  {ADJUSTMENT_TYPES.map((t) => {
                    const cfg = ADJUSTMENT_TYPE_CONFIG[t]
                    return (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                          type === t
                            ? `${cfg.bgClass} ${cfg.borderClass} ${cfg.textClass} font-medium`
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cfg.color }}
                        />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 일 예산 $17 → $25로 증액"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* 영향 방향 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">예상 영향</label>
                <div className="flex gap-2">
                  {([
                    { value: 'positive', label: '긍정적', cls: 'bg-green-50 border-green-200 text-green-700' },
                    { value: 'neutral', label: '중립', cls: 'bg-gray-50 border-gray-200 text-gray-700' },
                    { value: 'negative', label: '부정적', cls: 'bg-red-50 border-red-200 text-red-700' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setImpactDirection(opt.value)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        impactDirection === opt.value
                          ? `${opt.cls} font-medium`
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 액션 */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!date || saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 조정일 칩 (읽기 전용, 비관리자용) */
export function AdjustmentChips({ adjustments }: { adjustments: AdAdjustment[] }) {
  if (adjustments.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {adjustments.map((adj) => {
        const cfg = ADJUSTMENT_TYPE_CONFIG[adj.type]
        return (
          <div
            key={adj.id}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${cfg.bgClass} ${cfg.textClass}`}
            title={`${adj.date}: ${cfg.label} - ${adj.description}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: cfg.color }}
            />
            {adj.date.slice(5)} {cfg.label}
          </div>
        )
      })}
    </div>
  )
}

/** 특정 날짜에 조정이 있는지 확인하는 유틸 */
export function getAdjustmentsForDate(adjustments: AdAdjustment[], date: string): AdAdjustment[] {
  return adjustments.filter((a) => a.date === date)
}
