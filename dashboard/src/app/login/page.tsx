'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

/**
 * Meta OAuth 로그인 페이지
 *
 * - Meta 로그인 버튼 표시
 * - 에러 메시지 표시
 */
function LoginContent() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [errorDescription, setErrorDescription] = useState<string | null>(null)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    const descParam = searchParams.get('description')

    if (errorParam) {
      setError(getErrorMessage(errorParam))
      setErrorDescription(descParam || null)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-neutral-200 px-4 py-4">
        <div className="max-w-md mx-auto">
          <Link href="/" className="text-xl font-bold text-neutral-900">
            Polarad
          </Link>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8">
            {/* 로고 및 제목 */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#1877F2] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                Meta 광고 계정 연결
              </h1>
              <p className="text-neutral-600">
                Meta 계정으로 로그인하여 광고 데이터를 연결하세요
              </p>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-800">{error}</p>
                    {errorDescription && (
                      <p className="text-sm text-red-600 mt-1">{errorDescription}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Meta 로그인 버튼 */}
            <a
              href="/api/auth/login"
              className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Meta로 계속하기
            </a>

            {/* 안내 사항 */}
            <div className="mt-8 pt-6 border-t border-neutral-200">
              <h3 className="text-sm font-medium text-neutral-900 mb-3">
                연결 시 요청되는 권한
              </h3>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  광고 인사이트 데이터 읽기 (ads_read)
                </li>
              </ul>
            </div>

            {/* 부가 정보 */}
            <div className="mt-6 p-4 bg-neutral-50 rounded-lg">
              <p className="text-xs text-neutral-500 leading-relaxed">
                로그인하면{' '}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  개인정보처리방침
                </Link>
                과{' '}
                <Link href="/terms" className="text-blue-600 hover:underline">
                  서비스 약관
                </Link>
                에 동의하는 것으로 간주됩니다. 귀하의 데이터는 광고 성과 분석에만 사용됩니다.
              </p>
            </div>
          </div>

          {/* 기존 사용자 안내 */}
          <p className="text-center text-sm text-neutral-500 mt-6">
            이미 연결된 계정이 있나요?{' '}
            <Link href="/" className="text-blue-600 hover:underline">
              대시보드로 이동
            </Link>
          </p>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="py-4 text-center text-xs text-neutral-400">
        © 2024 Polarad. All rights reserved.
      </footer>
    </div>
  )
}

/**
 * 에러 코드를 사용자 친화적 메시지로 변환
 */
function getErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    oauth_init_failed: 'OAuth 초기화에 실패했습니다. 다시 시도해주세요.',
    missing_params: '필수 파라미터가 누락되었습니다.',
    invalid_state: '보안 검증에 실패했습니다. 다시 시도해주세요.',
    callback_failed: '인증 처리 중 오류가 발생했습니다.',
    access_denied: '권한이 거부되었습니다. 필요한 권한을 승인해주세요.',
    user_denied: '로그인이 취소되었습니다.',
  }

  return errorMessages[errorCode] || `알 수 없는 오류가 발생했습니다 (${errorCode})`
}

/**
 * 로딩 상태 컴포넌트
 */
function LoginLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
}

/**
 * 메인 export - Suspense로 감싸서 useSearchParams 사용
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  )
}
