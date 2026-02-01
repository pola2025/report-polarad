/**
 * BAS 리드 통계 API (경량 - summary만 반환)
 * GET /api/bas/leads/stats
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getBasLeadSummary } from '@/lib/airtable-bas-leads'

export async function GET() {
  try {
    const summary = await getBasLeadSummary()
    return NextResponse.json(summary)
  } catch (error) {
    console.error('GET /api/bas/leads/stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lead stats' },
      { status: 500 }
    )
  }
}
