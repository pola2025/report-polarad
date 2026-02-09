/**
 * 나라똔 담당자 TOTP 설정 API
 * GET /api/naratton/staff/[id]/setup-totp - QR코드 HTML 반환
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchNarattonStaff, updateNarattonStaff } from '@/lib/airtable-naratton-leads'
import { isAdminRequest } from '@/lib/admin-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    // 담당자 조회
    const allStaff = await fetchNarattonStaff()
    const staff = allStaff.find(s => s.id === id)
    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    // 새 TOTP 시크릿 생성
    const { TOTP, Secret } = await import('otpauth')
    const secret = new Secret({ size: 20 })

    const totp = new TOTP({
      issuer: 'Polarad',
      label: `나라똔:${staff.name}`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    })

    // Airtable에 시크릿 저장
    await updateNarattonStaff(id, { totp_secret: secret.base32 })

    const otpauthUri = totp.toString()

    // QR코드 HTML 페이지 반환
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TOTP 설정 - ${staff.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
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
      <p class="text-gray-500 mt-2">담당자: <span class="font-semibold text-gray-700">${staff.name}</span></p>
    </div>

    <div class="bg-gray-50 rounded-xl p-6 mb-6">
      <p class="text-sm text-gray-600 mb-4">Google Authenticator 앱으로<br>아래 QR코드를 스캔하세요</p>
      <div id="qr-container" class="flex justify-center mb-4"></div>
      <details class="text-left">
        <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-600">수동 입력 키 보기</summary>
        <div class="mt-2 bg-white rounded-lg p-3">
          <code class="text-xs text-gray-700 break-all select-all">${secret.base32}</code>
        </div>
      </details>
    </div>

    <div class="bg-blue-50 rounded-lg p-4 text-left">
      <h3 class="text-sm font-semibold text-blue-700 mb-2">설정 방법</h3>
      <ol class="text-xs text-blue-600 space-y-1">
        <li>1. Google Authenticator 앱 설치</li>
        <li>2. 앱에서 + 버튼 > QR코드 스캔</li>
        <li>3. 위 QR코드를 스캔</li>
        <li>4. 로그인 시 앱에 표시된 6자리 코드 입력</li>
      </ol>
    </div>

    <p class="text-xs text-red-500 mt-4">이 페이지를 닫으면 QR코드를 다시 볼 수 없습니다.</p>
  </div>

  <script>
    QRCode.toCanvas(document.createElement('canvas'), '${otpauthUri}', { width: 200 }, function(err, canvas) {
      if (!err) document.getElementById('qr-container').appendChild(canvas);
    });
  </script>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/naratton/staff/[id]/setup-totp error:', error)
    return NextResponse.json({ error: 'Failed to setup TOTP' }, { status: 500 })
  }
}
