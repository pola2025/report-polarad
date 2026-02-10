/**
 * 나라똔 담당자 관리자 승인 API
 * GET /api/naratton/staff/[id]/approve?key=ADMIN_KEY
 *
 * 텔레그램 1클릭 승인: is_active → true
 * HTML 응답으로 승인 결과 표시
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchNarattonStaff, updateNarattonStaff } from '@/lib/airtable-naratton-leads'

function htmlResponse(title: string, body: string, status = 200) {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 16px; padding: 32px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; color: #111827; margin: 0 0 8px 0; }
    p { font-size: 14px; color: #6b7280; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    ${body}
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    // 간단한 인증
    const adminKey = process.env.ADMIN_KEY
    if (!adminKey || key !== adminKey) {
      return htmlResponse(
        '권한 없음',
        '<div class="icon">🔒</div><h1>권한이 없습니다</h1><p>유효하지 않은 링크입니다.</p>',
        403
      )
    }

    // 담당자 조회
    const allStaff = await fetchNarattonStaff()
    const staff = allStaff.find(s => s.id === id)
    if (!staff) {
      return htmlResponse(
        '담당자 없음',
        '<div class="icon">❓</div><h1>담당자를 찾을 수 없습니다</h1><p>이미 삭제되었거나 잘못된 링크입니다.</p>',
        404
      )
    }

    // 이미 활성화
    if (staff.is_active) {
      return htmlResponse(
        '이미 승인됨',
        `<div class="icon">✅</div><h1>이미 승인됨</h1><p><strong>${staff.name}</strong> 담당자는 이미 인증이 완료되었습니다.</p>`
      )
    }

    // 승인 처리
    const updated = await updateNarattonStaff(id, { is_active: true })
    if (!updated) {
      return htmlResponse(
        '승인 실패',
        '<div class="icon">⚠️</div><h1>승인 처리 실패</h1><p>잠시 후 다시 시도해주세요.</p>',
        500
      )
    }

    return htmlResponse(
      '승인 완료',
      `<div class="icon">✅</div><h1>승인 완료</h1><p><strong>${staff.name}</strong> 담당자의 2FA 인증이 승인되었습니다.</p><p style="margin-top:12px;color:#10b981;">이제 포털에 로그인할 수 있습니다.</p>`
    )
  } catch (error) {
    console.error('GET /api/naratton/staff/[id]/approve error:', error)
    return htmlResponse(
      '오류',
      '<div class="icon">⚠️</div><h1>오류가 발생했습니다</h1><p>잠시 후 다시 시도해주세요.</p>',
      500
    )
  }
}
