'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, Check, Edit3, Info } from 'lucide-react'

interface NaverCampaignOverrideProps {
  csvTotals: {
    impressions: number
    clicks: number
    spend: number
  }
  month: string // YYYY-MM
  clientSlug?: string
}

interface OverrideData {
  impressions: number | null
  clicks: number | null
  spend: number | null
}

export default function NaverCampaignOverride({ csvTotals, month }: NaverCampaignOverrideProps) {
  const [override, setOverride] = useState<OverrideData>({ impressions: null, clicks: null, spend: null })
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState({ impressions: '', clicks: '', spend: '' })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchOverride = useCallback(async () => {
    try {
      const res = await fetch(`/api/naver/campaign-override?month=${month}`)
      const data = await res.json()
      if (data.spend !== null) {
        setOverride({ impressions: data.impressions, clicks: data.clicks, spend: data.spend })
      }
    } catch {
      // ignore
    } finally {
      setLoaded(true)
    }
  }, [month])

  useEffect(() => {
    if (month) fetchOverride()
  }, [month, fetchOverride])

  const startEditing = () => {
    setEditValues({
      impressions: override.impressions !== null ? String(override.impressions) : String(csvTotals.impressions),
      clicks: override.clicks !== null ? String(override.clicks) : String(csvTotals.clicks),
      spend: override.spend !== null ? String(override.spend) : String(csvTotals.spend),
    })
    setIsEditing(true)
  }

  const saveOverride = async () => {
    setSaving(true)
    try {
      const body = {
        month,
        impressions: parseInt(editValues.impressions) || 0,
        clicks: parseInt(editValues.clicks) || 0,
        spend: parseInt(editValues.spend) || 0,
      }
      await fetch('/api/naver/campaign-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setOverride({ impressions: body.impressions, clicks: body.clicks, spend: body.spend })
      setIsEditing(false)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  const hasOverride = override.spend !== null
  const spendDiff = hasOverride ? (override.spend! - csvTotals.spend) : 0
  const impDiff = hasOverride ? (override.impressions! - csvTotals.impressions) : 0
  const clickDiff = hasOverride ? (override.clicks! - csvTotals.clicks) : 0
  const hasDiff = hasOverride && (spendDiff !== 0 || impDiff !== 0 || clickDiff !== 0)

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardContent className="pt-4 pb-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
            <Info className="h-3.5 w-3.5" />
            캠페인 실제 합계
          </div>
          {!isEditing && (
            <button
              onClick={startEditing}
              className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
            >
              <Edit3 className="h-3 w-3" />
              {hasOverride ? '수정' : '입력'}
            </button>
          )}
        </div>

        {/* 편집 모드 */}
        {isEditing ? (
          <div className="space-y-2">
            <p className="text-xs text-amber-700 mb-2">
              네이버 검색광고 관리자에서 확인한 캠페인 합계를 입력하세요.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-amber-600 block mb-0.5">노출수</label>
                <input
                  type="number"
                  value={editValues.impressions}
                  onChange={(e) => setEditValues({ ...editValues, impressions: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="29,677"
                />
              </div>
              <div>
                <label className="text-[10px] text-amber-600 block mb-0.5">클릭수</label>
                <input
                  type="number"
                  value={editValues.clicks}
                  onChange={(e) => setEditValues({ ...editValues, clicks: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="481"
                />
              </div>
              <div>
                <label className="text-[10px] text-amber-600 block mb-0.5">총비용 (원)</label>
                <input
                  type="number"
                  value={editValues.spend}
                  onChange={(e) => setEditValues({ ...editValues, spend: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="828,212"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 rounded hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={saveOverride}
                disabled={saving}
                className="text-xs text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded disabled:opacity-50 flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : hasOverride ? (
          /* 입력된 캠페인 합계 표시 */
          <div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-base font-bold text-amber-900">{override.impressions!.toLocaleString()}</div>
                <div className="text-[10px] text-amber-600">캠페인 노출</div>
              </div>
              <div>
                <div className="text-base font-bold text-amber-900">{override.clicks!.toLocaleString()}</div>
                <div className="text-[10px] text-amber-600">캠페인 클릭</div>
              </div>
              <div>
                <div className="text-base font-bold text-amber-900">{override.spend!.toLocaleString()}원</div>
                <div className="text-[10px] text-amber-600">캠페인 비용</div>
              </div>
            </div>

            {/* 차이 설명 */}
            {hasDiff && (
              <div className="mt-2 px-2 py-1.5 bg-amber-100/60 rounded text-[11px] text-amber-700 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  CSV 키워드 리포트 합계({csvTotals.spend.toLocaleString()}원)와{' '}
                  {Math.abs(spendDiff).toLocaleString()}원 차이.
                  네이버 CSV 월간 리포트에 집계되지 않은 비용(자동 매칭, 확장 검색 등)입니다.
                </span>
              </div>
            )}
          </div>
        ) : (
          /* 미입력 상태 */
          <p className="text-xs text-amber-600">
            네이버 대시보드의 캠페인 합계를 입력하면 CSV 키워드 리포트와의 차이를 자동으로 표시합니다.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
