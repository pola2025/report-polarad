'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, UserPlus, Trash2, Users } from 'lucide-react'

interface SubAdmin {
  id: string
  name: string
  email: string
  scope: string
  is_active: boolean
}

export function SubAdminManager() {
  const [admins, setAdmins] = useState<SubAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sub-admins')
      if (res.ok) {
        const data = await res.json()
        setAdmins(data.admins || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAdmins()
  }, [fetchAdmins])

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim()) return
    setAdding(true)
    setError('')

    try {
      const res = await fetch('/api/admin/sub-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() }),
      })
      const data = await res.json()

      if (res.ok && data.admin) {
        setAdmins((prev) => [...prev, data.admin])
        setNewName('')
        setNewEmail('')
        setShowForm(false)
      } else {
        setError(data.error || '추가에 실패했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/sub-admins?id=${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setAdmins((prev) => prev.filter((a) => a.id !== id))
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            <CardTitle className="text-base">BAS/나라똔 관리자</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(!showForm)}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            추가
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 추가 폼 */}
        {showForm && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="이름"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="이메일"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={adding || !newName.trim() || !newEmail.trim()}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {adding && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                추가
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowForm(false)
                  setError('')
                }}
              >
                취소
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              추가된 관리자는 이메일 OTP로 로그인하여 BAS+나라똔 데이터에 접근할 수 있습니다.
            </p>
          </div>
        )}

        {/* 관리자 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            등록된 서브관리자가 없습니다
          </p>
        ) : (
          <div className="space-y-2">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {admin.name}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    {admin.email}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(admin.id)}
                  disabled={deletingId === admin.id}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  {deletingId === admin.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* env 관리자 표시 */}
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-gray-400 mb-1">환경변수 등록 관리자:</p>
          <p className="text-xs text-gray-500">
            {process.env.NEXT_PUBLIC_ADMIN_KEY ? 'ADMIN_KEY' : ''} /{' '}
            BAS_NARATTON_ADMIN_EMAILS (Vercel 설정)
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
