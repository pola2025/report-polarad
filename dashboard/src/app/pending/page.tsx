'use client'

import Link from 'next/link'

/**
 * 승인 대기 안내 페이지
 *
 * OAuth 인증 완료 후 관리자 승인 대기 중인 상태 표시
 */
export default function PendingPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-neutral-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-xl font-bold text-neutral-900">
            Polarad
          </Link>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 text-center">
            {/* 아이콘 */}
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            {/* 제목 */}
            <h1 className="text-2xl font-bold text-neutral-900 mb-3">
              승인 대기 중입니다
            </h1>
            <p className="text-neutral-600 mb-8 max-w-md mx-auto">
              Meta 계정 연결이 완료되었습니다. 관리자가 계정을 확인한 후 서비스를 활성화해
              드리겠습니다.
            </p>

            {/* 진행 상태 */}
            <div className="max-w-md mx-auto mb-8">
              <div className="flex items-center justify-between mb-4">
                {/* Step 1: 완료 */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mb-2">
                    <svg
                      className="w-5 h-5 text-white"
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
                  </div>
                  <span className="text-xs text-neutral-600">Meta 연결</span>
                </div>

                {/* 연결선 */}
                <div className="flex-1 h-0.5 bg-green-500 mx-2 mt-[-20px]" />

                {/* Step 2: 진행 중 */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center mb-2 animate-pulse">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <span className="text-xs text-neutral-600">관리자 승인</span>
                </div>

                {/* 연결선 */}
                <div className="flex-1 h-0.5 bg-neutral-200 mx-2 mt-[-20px]" />

                {/* Step 3: 대기 */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-neutral-200 rounded-full flex items-center justify-center mb-2">
                    <svg
                      className="w-5 h-5 text-neutral-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <span className="text-xs text-neutral-400">서비스 이용</span>
                </div>
              </div>
            </div>

            {/* 안내 사항 */}
            <div className="bg-neutral-50 rounded-lg p-6 text-left mb-8">
              <h3 className="font-medium text-neutral-900 mb-3">다음 단계</h3>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-medium">1.</span>
                  담당자가 계정 정보를 확인합니다 (보통 1 영업일 이내)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-medium">2.</span>
                  계약 및 결제가 확인되면 서비스가 활성화됩니다
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-medium">3.</span>
                  활성화 완료 시 이메일 또는 텔레그램으로 안내드립니다
                </li>
              </ul>
            </div>

            {/* 연락처 */}
            <div className="text-sm text-neutral-500 mb-6">
              문의사항이 있으시면{' '}
              <a
                href="mailto:support@polarad.co.kr"
                className="text-blue-600 hover:underline"
              >
                support@polarad.co.kr
              </a>
              로 연락해주세요.
            </div>

            {/* 버튼 */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                다른 계정으로 연결
              </Link>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                홈으로 이동
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="py-4 text-center text-xs text-neutral-400">
        © 2024 Polarad. All rights reserved.
      </footer>
    </div>
  )
}
