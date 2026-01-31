/**
 * BAS 리드 메모 추가 API
 * POST /api/bas/leads/[id]/notes
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { addBasLeadNote } from '@/lib/airtable-bas-leads'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!body.note || !body.author) {
      return NextResponse.json(
        { error: 'note and author are required' },
        { status: 400 }
      )
    }

    const updated = await addBasLeadNote(id, body.note, body.author)

    if (!updated) {
      return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
    }

    return NextResponse.json({ lead: updated })
  } catch (error) {
    console.error('POST /api/bas/leads/[id]/notes error:', error)
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
  }
}
