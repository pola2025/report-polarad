/**
 * BAS 담당자 API
 * GET  /api/bas/staff - 목록 조회
 * POST /api/bas/staff - 추가
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchBasStaff, createBasStaff } from '@/lib/airtable-bas-leads'

export async function GET() {
  try {
    const staff = await fetchBasStaff()
    return NextResponse.json({ staff })
  } catch (error) {
    console.error('GET /api/bas/staff error:', error)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const staff = await createBasStaff(body.name)

    if (!staff) {
      return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
    }

    return NextResponse.json({ staff })
  } catch (error) {
    console.error('POST /api/bas/staff error:', error)
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
  }
}
