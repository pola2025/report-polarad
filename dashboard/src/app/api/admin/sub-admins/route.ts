/**
 * 서브관리자 CRUD API
 * GET  /api/admin/sub-admins → 목록 조회
 * POST /api/admin/sub-admins → 추가
 * DELETE /api/admin/sub-admins?id=xxx → 삭제
 *
 * 슈퍼관리자(scope: 'all')만 접근 가능
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest, getAdminScope } from '@/lib/admin-auth'
import {
  getAllSubAdmins,
  createSubAdmin,
  deleteSubAdmin,
} from '@/lib/airtable-sub-admins'

async function checkSuperAdmin(request: NextRequest) {
  const isAdmin = await isAdminRequest(request)
  if (!isAdmin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const scope = await getAdminScope(request)
  if (scope !== 'all') {
    return NextResponse.json(
      { error: '슈퍼관리자 권한이 필요합니다.' },
      { status: 403 }
    )
  }

  return null // OK
}

export async function GET(request: NextRequest) {
  const err = await checkSuperAdmin(request)
  if (err) return err

  const admins = await getAllSubAdmins()
  return NextResponse.json({ admins })
}

export async function POST(request: NextRequest) {
  const err = await checkSuperAdmin(request)
  if (err) return err

  try {
    const { name, email, scope } = await request.json()

    if (!name || !email) {
      return NextResponse.json(
        { error: '이름과 이메일은 필수입니다.' },
        { status: 400 }
      )
    }

    // 이메일 형식 검증
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      )
    }

    const admin = await createSubAdmin(name, email, scope || 'bas-naratton')
    if (!admin) {
      return NextResponse.json(
        { error: '서브관리자 추가에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ admin })
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const err = await checkSuperAdmin(request)
  if (err) return err

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json(
      { error: 'id 파라미터가 필요합니다.' },
      { status: 400 }
    )
  }

  const deleted = await deleteSubAdmin(id)
  if (!deleted) {
    return NextResponse.json(
      { error: '삭제에 실패했습니다.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
