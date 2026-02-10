'use client'

import { useState, useEffect } from 'react'
import { Loader2, Lock, MessageCircle, Mail, CheckCircle2, ExternalLink } from 'lucide-react'
import { NarattonStaffPortal } from '@/components/naratton/NarattonStaffPortal'

interface SlugPortalClientProps {
  slug: string
  staffName: string
  isActive: boolean
  hasTelegram: boolean
}

export function SlugPortalClient({
  slug,
  staffName,
  isActive,
  hasTelegram,
}: SlugPortalClientProps) {
  const [loggedInName, setLoggedInName] = useState<string | null>(null)
  const [checking, setChecking] = useState(isActive && hasTelegram)

  useEffect(() => {
    if (!isActive || !hasTelegram) {
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
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [isActive, hasTelegram, staffName])

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

  if (loggedInName) {
    return <NarattonStaffPortal staffName={loggedInName} onLogout={handleLogout} />
  }

  // 미활성화 → 활성화 위저드
  if (!isActive) {
    return <ActivationWizard slug={slug} staffName={staffName} />
  }

  // 활성화됨 → 텔레그램 OTP 로그인
  return <TelegramLoginView slug={slug} staffName={staffName} onLogin={setLoggedInName} />
}

// ─── 활성화 위저드 ──────────────────────────────

function ActivationWizard({
  slug,
  staffName,
}: {
  slug: string
  staffName: string
}) {
  // 단계: 1=이메일, 2=텔레그램연결, 3=OTP인증, 4=완료
  // 항상 이메일 입력(본인 확인)부터 시작
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [botUsername, setBotUsername] = useState('')
  const [activationToken, setActivationToken] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingConnection, setCheckingConnection] = useState(false)

  // Step 1: 이메일 저장
  const handleSaveEmail = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/naratton/staff-auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-email', slug, email }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (data.telegramConnected) {
          // 텔레그램 이미 연결 → 바로 OTP 발송 → step 3
          const otpRes = await fetch('/api/naratton/staff-auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send-otp', slug }),
          })
          const otpData = await otpRes.json()
          if (otpData.success) {
            setStep(3)
          } else {
            setError(otpData.error || 'OTP 발송에 실패했습니다.')
          }
        } else {
          // 텔레그램 미연결 → step 2
          setBotUsername(data.botUsername)
          setActivationToken(data.activationToken)
          setStep(2)
        }
      } else {
        setError(data.error || '이메일 저장에 실패했습니다.')
      }
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: 텔레그램 연결 확인
  const handleCheckTelegram = async () => {
    setError('')
    setCheckingConnection(true)
    try {
      const res = await fetch('/api/naratton/staff-auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-telegram', slug }),
      })
      const data = await res.json()
      if (data.connected) {
        // 연결 성공 → OTP 발송
        const otpRes = await fetch('/api/naratton/staff-auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send-otp', slug }),
        })
        const otpData = await otpRes.json()
        if (otpData.success) {
          setStep(3)
        } else {
          setError(otpData.error || 'OTP 발송에 실패했습니다.')
        }
      } else {
        setError('아직 봇과 대화가 시작되지 않았습니다. 텔레그램에서 "시작" 버튼을 눌러주세요.')
      }
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setCheckingConnection(false)
    }
  }

  // Step 3: OTP 검증
  const handleVerifyOTP = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/naratton/staff-auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-otp', slug, code: otpCode }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStep(4)
      } else {
        setError(data.error || '인증에 실패했습니다.')
        setOtpCode('')
      }
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 재발송
  const handleResendOTP = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/naratton/staff-auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-otp', slug }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '재발송에 실패했습니다.')
      }
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {step === 4 ? (
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            ) : (
              <Lock className="w-7 h-7 text-indigo-600" />
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">계정 활성화</h1>
          <p className="text-sm text-gray-500 mt-1">{staffName}님</p>
        </div>

        {/* 진행 표시 */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  s < step ? 'bg-green-500 text-white' :
                  s === step ? 'bg-indigo-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {s < step ? '✓' : s}
                </div>
                {s < 3 && <div className={`w-6 h-0.5 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: 이메일 입력 */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="inline w-4 h-4 mr-1" />
                이메일 주소
              </label>
              <input
                id="email"
                type="email"
                placeholder="이메일 입력"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && email && handleSaveEmail()}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <button
              onClick={handleSaveEmail}
              disabled={loading || !email}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              다음
            </button>
          </div>
        )}

        {/* Step 2: 텔레그램 봇 연결 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-blue-800">텔레그램 봇을 시작하세요</p>
              <a
                href={`https://t.me/${botUsername}?start=${activationToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#0088cc] text-white rounded-lg text-sm font-medium hover:bg-[#006da3] transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                텔레그램 봇 열기
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <p className="text-xs text-blue-600">
                봇이 열리면 <b>시작</b> 버튼을 눌러주세요
              </p>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <button
              onClick={handleCheckTelegram}
              disabled={checkingConnection}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {checkingConnection && <Loader2 className="w-4 h-4 animate-spin" />}
              {checkingConnection ? '확인 중...' : '연결 확인'}
            </button>
            <button
              onClick={() => setStep(1)}
              className="w-full text-xs text-gray-400 hover:text-gray-600"
            >
              이전 단계로
            </button>
          </div>
        )}

        {/* Step 3: OTP 입력 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <p className="text-sm text-green-700">텔레그램으로 인증코드를 발송했습니다</p>
            </div>
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                인증코드 (6자리)
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && otpCode.length === 6 && handleVerifyOTP()}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
            <button
              onClick={handleResendOTP}
              disabled={loading}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              인증코드 재발송
            </button>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <button
              onClick={handleVerifyOTP}
              disabled={loading || otpCode.length !== 6}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              인증 완료
            </button>
          </div>
        )}

        {/* Step 4: 완료 */}
        {step === 4 && (
          <div className="space-y-4 text-center">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800">계정이 활성화되었습니다!</p>
              <p className="text-xs text-green-600 mt-1">이제 로그인할 수 있습니다.</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              로그인하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 텔레그램 OTP 로그인 ──────────────────────────

function TelegramLoginView({
  slug,
  staffName,
  onLogin,
}: {
  slug: string
  staffName: string
  onLogin: (name: string) => void
}) {
  // step: 'email' → 'otp'
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendOTP = async () => {
    if (!email) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/naratton/staff-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', slug, email }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStep('otp')
      } else {
        setError(data.error || '인증코드 발송에 실패했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

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

  const handleResend = () => {
    setStep('email')
    setCode('')
    setError('')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {step === 'otp' ? <MessageCircle className="w-7 h-7 text-indigo-600" /> : <Mail className="w-7 h-7 text-indigo-600" />}
          </div>
          <h1 className="text-xl font-bold text-gray-900">나라똔 리드관리</h1>
          <p className="text-sm text-gray-500 mt-1">{staffName}님 로그인</p>
        </div>

        {step === 'email' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="inline w-4 h-4 mr-1" />
                이메일 주소
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="등록된 이메일 입력"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && email && handleSendOTP()}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md text-center">{error}</p>}
            <button
              onClick={handleSendOTP}
              disabled={loading || !email}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              {loading ? '발송 중...' : '인증코드 받기'}
            </button>
            <p className="text-xs text-gray-400 text-center">이메일 확인 후 텔레그램으로 인증코드가 발송됩니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <p className="text-sm text-green-700">텔레그램으로 인증코드를 발송했습니다</p>
            </div>
            <div>
              <label htmlFor="otp-code" className="block text-sm font-medium text-gray-700 mb-1">인증코드 (6자리)</label>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && handleVerifyOTP()}
                placeholder="000000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
            <button onClick={handleResend} className="text-xs text-gray-400 hover:text-gray-600">
              다시 입력하기
            </button>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md text-center">{error}</p>}
            <button
              onClick={handleVerifyOTP}
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />확인 중...</> : '로그인'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
