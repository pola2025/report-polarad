'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

interface BasFilterBarProps {
  compareMode: 'none' | 'weekly' | 'monthly'
}

export function BasFilterBar({ compareMode }: BasFilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentStart = searchParams.get('start')
  const currentEnd = searchParams.get('end')

  // 로컬 state로 날짜 버퍼링 (즉시 반영 방지)
  const [draftStart, setDraftStart] = useState(currentStart || '')
  const [draftEnd, setDraftEnd] = useState(currentEnd || '')

  // URL 파라미터가 외부에서 변경되면 동기화 (퀵 버튼 등)
  useEffect(() => {
    setDraftStart(currentStart || '')
    setDraftEnd(currentEnd || '')
  }, [currentStart, currentEnd])

  // 날짜가 URL과 다른지 확인
  const isDirty = draftStart !== (currentStart || '') || draftEnd !== (currentEnd || '')

  const updateCompareMode = (mode: 'none' | 'weekly' | 'monthly') => {
    const params = new URLSearchParams(searchParams.toString())
    if (mode === 'none') {
      params.delete('compare')
    } else {
      params.set('compare', mode)
    }
    router.push(`?${params.toString()}`)
  }

  const setQuickRange = (range: 'all' | '7d' | '30d') => {
    const params = new URLSearchParams(searchParams.toString())
    if (range === 'all') {
      params.delete('start')
      params.delete('end')
    } else {
      const now = new Date()
      const days = range === '7d' ? 7 : 30
      const start = new Date(now)
      start.setDate(start.getDate() - days)
      params.set('start', start.toISOString().split('T')[0])
      params.set('end', now.toISOString().split('T')[0])
    }
    router.push(`?${params.toString()}`)
  }

  // 조회 버튼: 두 날짜를 한 번에 적용
  const applyDateRange = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (draftStart) {
      params.set('start', draftStart)
    } else {
      params.delete('start')
    }
    if (draftEnd) {
      params.set('end', draftEnd)
    } else {
      params.delete('end')
    }
    router.push(`?${params.toString()}`)
  }

  const activeQuick = !currentStart && !currentEnd ? 'all' : undefined

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* 퀵 기간 버튼 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">기간:</span>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(['all', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setQuickRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeQuick === range
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range === 'all' ? '전체' : range === '7d' ? '최근 7일' : '최근 30일'}
              </button>
            ))}
          </div>
        </div>

        {/* 비교 모드 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">비교:</span>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(['none', 'weekly', 'monthly'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateCompareMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  compareMode === mode
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode === 'none' ? '없음' : mode === 'weekly' ? '주간(7일)' : '월간(30일)'}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜 입력 + 조회 버튼 */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-md"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date"
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-md"
          />
          <button
            onClick={applyDateRange}
            disabled={!isDirty}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              isDirty
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Search className="h-3 w-3" />
            조회
          </button>
        </div>
      </div>
    </div>
  )
}
