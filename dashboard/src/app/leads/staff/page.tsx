'use client'

import { useState, useEffect } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { NarattonStaffPortal } from '@/components/naratton/NarattonStaffPortal'

export default function StaffPortalPage() {
  const [staffName, setStaffName] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  // 로그인 폼 상태
  const [nameInput, setNameInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // 세션 확인
  useEffect(() => {
    fetch('/api/naratton/staff-auth/verify')
      .then(res => {
        if (res.ok) return res.json()
        throw new Error('not authenticated')
      })
      .then(data => {
        if (data.authenticated && data.staffName) {
          setStaffName(data.staffName)
        }
      })
      .catch(() => {
        // 미인증
      })
      .finally(() => setChecking(false))
  }, [])

  // 로그인 처리
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameInput.trim() || !codeInput.trim()) return

    setLoginLoading(true)
    setLoginError('')

    try {
      const res = await fetch('/api/naratton/staff-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim(), code: codeInput.trim() }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setStaffName(data.staffName)
      } else {
        setLoginError(data.error || '인증에 실패했습니다.')
        setCodeInput('')
      }
    } catch {
      setLoginError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoginLoading(false)
    }
  }

  // 로그아웃
  const handleLogout = () => {
    // 쿠키 삭제는 서버에서 처리해야 하지만, 간단히 페이지 리로드
    document.cookie = 'polarad_staff_session=; Max-Age=0; path=/'
    setStaffName(null)
    setNameInput('')
    setCodeInput('')
  }

  // 세션 확인 중
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  // 인증됨 → 포털 표시
  if (staffName) {
    return <NarattonStaffPortal staffName={staffName} onLogout={handleLogout} />
  }

  // 로그인 폼
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">나라똔 리드관리</h1>
          <p className="text-sm text-gray-500 mt-1">담당자 로그인</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="staff-name" className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              id="staff-name"
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="담당자 이름"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="totp-code" className="block text-sm font-medium text-gray-700 mb-1">인증 코드</label>
            <input
              id="totp-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.replace(/\D/g, ''))}
              placeholder="6자리 코드"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoComplete="one-time-code"
            />
          </div>

          {loginError && (
            <p className="text-sm text-red-600 text-center">{loginError}</p>
          )}

          <button
            type="submit"
            disabled={loginLoading || !nameInput.trim() || codeInput.length < 6}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loginLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                확인 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Google Authenticator 앱에서<br />6자리 인증 코드를 확인하세요
        </p>
      </div>
    </div>
  )
}
