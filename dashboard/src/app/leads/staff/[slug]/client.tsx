'use client'

import { useState, useEffect } from 'react'
import { Loader2, Lock, MessageCircle, AlertCircle } from 'lucide-react'
import { NarattonStaffPortal } from '@/components/naratton/NarattonStaffPortal'

interface SlugPortalClientProps {
  slug: string
  staffName: string
  canLogin: boolean
  hasTelegram: boolean
}

export function SlugPortalClient({
  slug,
  staffName,
  canLogin,
  hasTelegram,
}: SlugPortalClientProps) {
  const [loggedInName, setLoggedInName] = useState<string | null>(null)
  const [checking, setChecking] = useState(canLogin)

  // 세션 확인 (로그인 가능한 상태에서만)
  useEffect(() => {
    if (!canLogin) {
      setChecking(false)
      return
    }
    fetch('/api/naratton/staff-auth/verify')
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error('not authenticated')
      })
      .then((data) => {
        if (data.authenticated && data.staffName === staffName) {
          setLoggedInName(data.staffName)
        }
      })
      .catch(() => {
        /* 미인증 */
      })
      .finally(() => setChecking(false))
  }, [canLogin, staffName])

  const handleLogout = () => {
    document.cookie = 'polarad_staff_session=; Max-Age=0; path=/'
    setLoggedInName(null)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  // 로그인 완료 → 포털 표시
  if (loggedInName) {
    return (
      <NarattonStaffPortal staffName={loggedInName} onLogout={handleLogout} />
    )
  }

  // 텔레그램 미연동
  if (!hasTelegram) {
    return <NoTelegramView staffName={staffName} />
  }

  // 텔레그램 연동됐지만 비활성 (관리자 미승인)
  if (!canLogin) {
    return <InactiveView staffName={staffName} />
  }

  // 텔레그램 OTP 로그인
  return (
    <TelegramLoginView
      slug={slug}
      staffName={staffName}
      onLogin={setLoggedInName}
    />
  )
}

// ─── 텔레그램 미연동 안내 ──────────────────────────

function NoTelegramView({ staffName }: { staffName: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          텔레그램 연동 필요
        </h1>
        <p className="text-sm text-gray-500 mb-4">
          {staffName}님의 텔레그램이 아직 연동되지 않았습니다.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-2">
          <p className="text-sm text-gray-700 font-medium">연동 방법:</p>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal pl-4">
            <li>텔레그램에서 접수관리 봇과 대화 시작</li>
            <li>봇에게 <code className="text-indigo-600">/start</code> 입력</li>
            <li>관리자에게 텔레그램 연동 요청</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

// ─── 비활성 계정 안내 ────────────────────────────

function InactiveView({ staffName }: { staffName: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">계정 비활성</h1>
        <p className="text-sm text-gray-500 mb-4">
          {staffName}님의 계정이 비활성 상태입니다.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-700">
            관리자에게 계정 활성화를 요청해주세요.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          새로고침
        </button>
      </div>
    </div>
  )
}

// ─── 텔레그램 OTP 로그인 (이메일 불필요) ──────────

function TelegramLoginView({
  slug,
  staffName,
  onLogin,
}: {
  slug: string
  staffName: string
  onLogin: (name: string) => void
}) {
  const [code, setCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // OTP 발송 (이메일 없이 slug만으로)
  const handleSendOTP = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/naratton/staff-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', slug }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setOtpSent(true)
      } else {
        setError(data.error || '인증코드 발송에 실패했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // OTP 검증
  const handleVerifyOTP = async () => {
    if (code.length !== 6) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/naratton/staff-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', slug, code }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        onLogin(data.staffName)
      } else {
        setError(data.error || '인증에 실패했습니다.')
        setCode('')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {otpSent ? (
              <MessageCircle className="w-7 h-7 text-indigo-600" />
            ) : (
              <Lock className="w-7 h-7 text-indigo-600" />
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">나라똔 리드관리</h1>
          <p className="text-sm text-gray-500 mt-1">{staffName}님 로그인</p>
        </div>

        {!otpSent ? (
          /* Step 1: 인증코드 발송 버튼 */
          <div className="space-y-4">
            <p className="text-sm text-gray-500 text-center">
              텔레그램으로 인증코드를 받으세요
            </p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md text-center">
                {error}
              </p>
            )}

            <button
              onClick={handleSendOTP}
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  발송 중...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  인증코드 발송
                </>
              )}
            </button>
          </div>
        ) : (
          /* Step 2: OTP 입력 → 검증 */
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <p className="text-sm text-green-700">
                텔레그램으로 인증코드를 발송했습니다
              </p>
            </div>

            <div>
              <label
                htmlFor="otp-code"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                인증코드 (6자리)
              </label>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) =>
                  e.key === 'Enter' && code.length === 6 && handleVerifyOTP()
                }
                placeholder="000000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>

            <button
              onClick={() => {
                setOtpSent(false)
                setCode('')
                setError('')
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              인증코드 재발송
            </button>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md text-center">
                {error}
              </p>
            )}

            <button
              onClick={handleVerifyOTP}
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  확인 중...
                </>
              ) : (
                '로그인'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
