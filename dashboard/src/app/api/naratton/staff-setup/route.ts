/**
 * 나라똔 담당자 TOTP 설정 - 공개 페이지 (인증 불필요)
 * GET /api/naratton/staff-setup?token=xxx - 1회용 토큰으로 QR코드 HTML 반환
 *
 * 플로우:
 * 1. 관리자가 POST /api/naratton/staff/[id]/setup-totp 호출 → setupUrl 반환
 * 2. 관리자가 담당자에게 URL 공유 (카톡/문자)
 * 3. 담당자가 이 URL 열면 QR코드 표시
 * 4. 토큰은 사용 후 삭제 (1회용)
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getNarattonStaffByToken, updateNarattonStaff } from '@/lib/airtable-naratton-leads'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.replace(/\s/g, '') || ''

  if (!token || token.length < 32) {
    return new NextResponse(errorHtml('유효하지 않은 링크입니다.'), htmlHeaders())
  }

  try {
    // 토큰으로 담당자 조회
    const staff = await getNarattonStaffByToken(token)

    if (!staff) {
      return new NextResponse(errorHtml('만료되었거나 이미 사용된 링크입니다.'), htmlHeaders())
    }

    if (!staff.totp_secret) {
      return new NextResponse(errorHtml('설정 정보가 없습니다. 관리자에게 문의하세요.'), htmlHeaders())
    }

    // TOTP URI 생성
    const { TOTP, Secret } = await import('otpauth')
    const totp = new TOTP({
      issuer: 'Polarad',
      label: `나라똔:${staff.name}`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(staff.totp_secret),
    })
    const otpauthUri = totp.toString()

    // 토큰 삭제 (1회용) + 활성화
    await updateNarattonStaff(staff.id, { setup_token: '', is_active: true })

    // QR코드 HTML 반환
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2FA 인증 설정 - ${esc(staff.name)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
    <div class="mb-6">
      <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-gray-900">2FA 인증 설정</h1>
      <p class="text-gray-500 mt-2">담당자: <span class="font-semibold text-gray-700">${esc(staff.name)}</span></p>
    </div>

    <div class="bg-gray-50 rounded-xl p-6 mb-6">
      <p class="text-sm text-gray-600 mb-4">Google Authenticator 앱으로<br>아래 QR코드를 스캔하세요</p>
      <div id="qr-container" class="flex justify-center mb-4"></div>
      <details class="text-left">
        <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-600">수동 입력 키 보기</summary>
        <div class="mt-2 bg-white rounded-lg p-3">
          <code class="text-xs text-gray-700 break-all select-all">${esc(staff.totp_secret)}</code>
        </div>
      </details>
    </div>

    <div class="bg-blue-50 rounded-lg p-4 text-left">
      <h3 class="text-sm font-semibold text-blue-700 mb-2">설정 방법</h3>
      <ol class="text-xs text-blue-600 space-y-1">
        <li>1. Google Authenticator 앱 설치</li>
        <li>2. 앱에서 + 버튼 &gt; QR코드 스캔</li>
        <li>3. 위 QR코드를 스캔</li>
        <li>4. 로그인 시 앱에 표시된 6자리 코드 입력</li>
      </ol>
    </div>

    <div class="bg-indigo-50 rounded-lg p-4 mt-4 text-left">
      <h3 class="text-sm font-semibold text-indigo-700 mb-1">로그인 페이지</h3>
      <p class="text-xs text-indigo-600">설정 완료 후 아래 주소에서 로그인하세요:</p>
      <a href="/leads/staff" class="text-xs text-indigo-700 font-mono underline">/leads/staff</a>
    </div>

    <p class="text-xs text-red-500 mt-4">이 링크는 1회용입니다. 페이지를 닫으면 다시 사용할 수 없습니다.</p>
  </div>

  <script>
    QRCode.toCanvas(document.createElement('canvas'), '${otpauthUri.replace(/'/g, "\\'")}', { width: 200 }, function(err, canvas) {
      if (!err) document.getElementById('qr-container').appendChild(canvas);
    });
  </script>
</body>
</html>`

    return new NextResponse(html, htmlHeaders())
  } catch (error) {
    console.error('GET /api/naratton/staff-setup error:', error)
    return new NextResponse(errorHtml('오류가 발생했습니다. 관리자에게 문의하세요.'), htmlHeaders())
  }
}

function htmlHeaders() {
  return {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  }
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function errorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>오류</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
    <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
      </svg>
    </div>
    <h1 class="text-xl font-bold text-gray-900 mb-2">링크 오류</h1>
    <p class="text-gray-500">${message}</p>
    <p class="text-xs text-gray-400 mt-4">관리자에게 새 링크를 요청하세요.</p>
  </div>
</body>
</html>`
}
