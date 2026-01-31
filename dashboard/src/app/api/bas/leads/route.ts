/**
 * BAS 리드 목록 + 요약 API
 * GET /api/bas/leads?status=접수&staff=김철수&blacklisted=false&search=010&page=1&duplicatesOnly=true
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchBasLeads, getBasLeadSummary } from '@/lib/airtable-bas-leads'
import type { LeadStatus } from '@/types/bas-leads'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status') as LeadStatus | null
    const staff = searchParams.get('staff') || undefined
    const blacklistedParam = searchParams.get('blacklisted')
    const search = searchParams.get('search') || undefined
    const duplicatesOnly = searchParams.get('duplicatesOnly') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)

    const blacklisted = blacklistedParam === 'true' ? true : blacklistedParam === 'false' ? false : undefined

    const [leadsResult, summary] = await Promise.all([
      fetchBasLeads({
        status: status || undefined,
        staff,
        blacklisted,
        search,
        duplicatesOnly,
        page,
      }),
      getBasLeadSummary(),
    ])

    return NextResponse.json({
      leads: leadsResult.leads,
      summary,
      hasMore: leadsResult.hasMore,
      total: leadsResult.total,
    })
  } catch (error) {
    console.error('GET /api/bas/leads error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}
