"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";

/**
 * 통합 로그인 페이지
 *
 * - 관리자 로그인: 이메일 검증 → 텔레그램 OTP (redirect 파라미터가 있을 때)
 * - Meta OAuth 로그인: 기존 Meta 계정 연결
 */
function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirect = searchParams.get("redirect");
  const isAdminLogin = !!redirect;
  const errorParam = searchParams.get("error");
  const descParam = searchParams.get("description");

  // ─── Admin Login State ──────────────────────────
  const [checkingSession, setCheckingSession] = useState(isAdminLogin);

  // ─── Email → Telegram OTP State ────────────────
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Meta OAuth Error State ─────────────────────
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaErrorDescription, setMetaErrorDescription] = useState<
    string | null
  >(null);

  // 이미 로그인되어 있는지 확인 (관리자 모드)
  useEffect(() => {
    if (!isAdminLogin) return;

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/admin/verify");
        if (res.ok) {
          router.replace(redirect!);
          return;
        }
      } catch {
        // 세션 없음
      }
      setCheckingSession(false);
    }
    checkSession();
  }, [isAdminLogin, redirect, router]);

  // Meta OAuth 에러 표시
  useEffect(() => {
    if (errorParam) {
      setMetaError(getErrorMessage(errorParam));
      setMetaErrorDescription(descParam || null);
    }
  }, [errorParam, descParam]);

  // ─── 텔레그램 OTP 발송 ──────────────────────────
  const handleSendOTP = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin/email-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOtpSent(true);
      } else {
        setError(data.error || "인증코드 발송에 실패했습니다.");
      }
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  // ─── 텔레그램 OTP 검증 ──────────────────────────
  const handleVerifyOTP = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin/email-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email, code: otpCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.replace(redirect || "/");
        return;
      }
      setError(data.error || "인증에 실패했습니다.");
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 세션 확인 중 로딩
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#F5A623]" />
      </div>
    );
  }

  // ─── 관리자 로그인 UI ────────────────────────────
  if (isAdminLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Image
                src="/images/logo.png"
                alt="Polarad"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <CardTitle>Polarad Report 관리자</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!otpSent ? (
                /* Step 1: 이메일 입력 → OTP 발송 */
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <Mail className="inline h-4 w-4 mr-1" />
                    등록된 이메일
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="이메일 주소 입력"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && email && handleSendOTP()
                    }
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-[#F5A623] focus:border-transparent"
                    autoComplete="email"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    등록된 이메일로 텔레그램 인증코드가 발송됩니다
                  </p>
                </div>
              ) : (
                /* Step 2: 6자리 OTP 입력 → 검증 */
                <div>
                  <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-3">
                    <p className="text-sm text-green-700">
                      텔레그램으로 인증코드를 발송했습니다
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">{email}</p>
                  </div>
                  <label
                    htmlFor="otpCode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    인증코드 (6자리)
                  </label>
                  <input
                    id="otpCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, ""))
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      otpCode.length === 6 &&
                      handleVerifyOTP()
                    }
                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-[#F5A623] focus:border-transparent text-center text-2xl tracking-[0.5em] font-mono"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                      setError("");
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 mt-2"
                  >
                    다른 이메일로 변경
                  </button>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              <Button
                onClick={otpSent ? handleVerifyOTP : handleSendOTP}
                disabled={loading || (otpSent ? otpCode.length !== 6 : !email)}
                className="w-full bg-[#F5A623] hover:bg-[#E09000] disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {otpSent ? "로그인" : "인증코드 발송"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Meta OAuth 로그인 UI (기존) ─────────────────
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
            {metaError && (
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
                    <p className="text-sm font-medium text-red-800">
                      {metaError}
                    </p>
                    {metaErrorDescription && (
                      <p className="text-sm text-red-600 mt-1">
                        {metaErrorDescription}
                      </p>
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
                연결 시 요청되는 권한 / Permissions requested
              </h3>
              <ul className="space-y-2 text-sm text-neutral-600">
                {[
                  {
                    ko: "광고 성과 데이터 읽기",
                    en: "Read ad performance data",
                    scope: "ads_read",
                  },
                  {
                    ko: "광고 캠페인 ON/OFF 관리",
                    en: "Pause / activate ad campaigns",
                    scope: "ads_management",
                  },
                  {
                    ko: "비즈니스 매니저 자산 조회",
                    en: "List Business Manager assets",
                    scope: "business_management",
                  },
                  {
                    ko: "Facebook 페이지 목록 조회",
                    en: "List Facebook Pages you manage",
                    scope: "pages_show_list",
                  },
                  {
                    ko: "페이지 인사이트(도달·참여) 읽기",
                    en: "Read Page engagement insights",
                    scope: "pages_read_engagement",
                  },
                ].map((perm) => (
                  <li key={perm.scope} className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"
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
                    <span>
                      {perm.ko}{" "}
                      <span className="text-neutral-400">/ {perm.en}</span>{" "}
                      <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-500">
                        {perm.scope}
                      </code>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 부가 정보 */}
            <div className="mt-6 p-4 bg-neutral-50 rounded-lg">
              <p className="text-xs text-neutral-500 leading-relaxed">
                로그인하면{" "}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  개인정보처리방침
                </Link>
                과{" "}
                <Link href="/terms" className="text-blue-600 hover:underline">
                  서비스 약관
                </Link>
                에 동의하는 것으로 간주됩니다. 귀하의 데이터는 광고 성과
                분석에만 사용됩니다.
              </p>
            </div>
          </div>

          {/* 기존 사용자 안내 */}
          <p className="text-center text-sm text-neutral-500 mt-6">
            이미 연결된 계정이 있나요?{" "}
            <Link href="/" className="text-blue-600 hover:underline">
              대시보드로 이동
            </Link>
          </p>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="py-4 text-center text-xs text-neutral-400">
        &copy; 2024 Polarad. All rights reserved.
      </footer>
    </div>
  );
}

/**
 * 에러 코드를 사용자 친화적 메시지로 변환
 */
function getErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    oauth_init_failed: "OAuth 초기화에 실패했습니다. 다시 시도해주세요.",
    missing_params: "필수 파라미터가 누락되었습니다.",
    invalid_state: "보안 검증에 실패했습니다. 다시 시도해주세요.",
    callback_failed: "인증 처리 중 오류가 발생했습니다.",
    access_denied: "권한이 거부되었습니다. 필요한 권한을 승인해주세요.",
    user_denied: "로그인이 취소되었습니다.",
  };

  return (
    errorMessages[errorCode] || `알 수 없는 오류가 발생했습니다 (${errorCode})`
  );
}

/**
 * 로딩 상태 컴포넌트
 */
function LoginLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

/**
 * 메인 export - Suspense로 감싸서 useSearchParams 사용
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
