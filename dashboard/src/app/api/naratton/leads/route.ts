/**
 * 나라똔 리드 목록 + 요약 API
 * GET /api/naratton/leads?channel=homepage&status=심사준비&staff=김철수&search=010&page=1
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchNarattonLeadsWithSummary } from '@/lib/airtable-naratton-leads'
import { isAdminRequest } from '@/lib/admin-auth'
import { isStaffRequest } from '@/lib/staff-auth'
import type { NarattonLeadStatus, NarattonLeadChannel } from '@/types/naratton-leads'

export async function GET(request: NextRequest) {
  // 인증: 관리자 또는 담당자 세션 필요
  const isAdmin = await isAdminRequest(request)
  const staffSession = !isAdmin ? await isStaffRequest(request) : null
  if (!isAdmin && !staffSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)

    const channel = searchParams.get('channel') as NarattonLeadChannel | null
    const status = searchParams.get('status') as NarattonLeadStatus | null
    // 담당자 세션일 때 서버사이드 필터 강제 적용
    const staff = staffSession ? staffSession.staffName : (searchParams.get('staff') || undefined)
    const blacklistedParam = searchParams.get('blacklisted')
    const search = searchParams.get('search') || undefined
    const duplicatesOnly = searchParams.get('duplicatesOnly') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)

    const blacklisted = blacklistedParam === 'true' ? true : blacklistedParam === 'false' ? false : undefined

    // 통합 조회: Airtable 2회 호출로 리드 + 요약 동시 반환
    const result = await fetchNarattonLeadsWithSummary({
      channel: channel || undefined,
      status: status || undefined,
      staff,
      blacklisted,
      search,
      duplicatesOnly,
      page,
    })

    return NextResponse.json({
      leads: result.leads,
      summary: result.summary,
      hasMore: result.hasMore,
      total: result.total,
    })
  } catch (error) {
    console.error('GET /api/naratton/leads error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}
