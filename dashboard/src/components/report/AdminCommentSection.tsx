'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import type { ReportComment } from '@/types/report'

interface AdminCommentSectionProps {
  comment: ReportComment | null
  reportId: string
  isAdmin: boolean
  onCommentUpdate?: (comment: ReportComment) => void
}

export function AdminCommentSection({
  comment,
  reportId,
  isAdmin,
  onCommentUpdate,
}: AdminCommentSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment?.content || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!editContent.trim()) return

    setIsSaving(true)
    try {
      const method = comment ? 'PUT' : 'POST'
      const url = comment
        ? `/api/reports/comment/${comment.id}`
        : '/api/reports/comment'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_id: reportId,
          content: editContent,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (onCommentUpdate && data.comment) {
          onCommentUpdate(data.comment)
        }
        setIsEditing(false)
      } else {
        alert('코멘트 저장에 실패했습니다.')
      }
    } catch {
      alert('오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!comment && !isAdmin) {
    return null
  }

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
          <span>📝</span>
          <span>담당자 코멘트</span>
        </div>
        {isAdmin && !isEditing && (
          <button
            onClick={() => {
              setEditContent(comment?.content || '')
              setIsEditing(true)
            }}
            className="px-3 py-1.5 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            {comment ? '수정' : '작성'}
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-48 p-4 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="코멘트를 작성하세요...

■ 이번 달 주요 성과
-

■ 다음 달 계획
-

문의사항은 언제든 연락 부탁드립니다.
- 폴라애드 광고운영팀"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !editContent.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      ) : comment ? (
        <>
          <div className="rounded-xl p-5 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100">
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {comment.content}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <span>작성일: {new Date(comment.created_at).toLocaleString('ko-KR')}</span>
            <span>•</span>
            <span>작성자: {comment.author_name}</span>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-400">
          아직 작성된 코멘트가 없습니다.
        </div>
      )}
    </Card>
  )
}
