/**
 * 나라똔 담당자 TOTP 설정 API
 * POST /api/naratton/staff/[id]/setup-totp - TOTP 생성 + 공유 링크 반환
 */

export const dynamic = 'force-dynamic'

import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { fetchNarattonStaff, updateNarattonStaff } from '@/lib/airtable-naratton-leads'
import { isAdminRequest } from '@/lib/admin-auth'

export async function POST(
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

    new TOTP({
      issuer: 'Polarad',
      label: `나라똔:${staff.name}`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    })

    // 1회용 설정 토큰 생성
    const setupToken = randomBytes(32).toString('hex')

    // Airtable에 시크릿 + 토큰 저장 (is_active는 아직 false 유지)
    await updateNarattonStaff(id, {
      totp_secret: secret.base32,
      setup_token: setupToken,
    })

    // 공유 가능한 URL 반환
    const host = request.headers.get('host') || 'report.polarad.co.kr'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const setupUrl = `${protocol}://${host}/api/naratton/staff-setup?token=${setupToken}`

    return NextResponse.json({
      setupUrl,
      staffName: staff.name,
    })
  } catch (error) {
    console.error('POST /api/naratton/staff/[id]/setup-totp error:', error)
    return NextResponse.json({ error: 'Failed to setup TOTP' }, { status: 500 })
  }
}
