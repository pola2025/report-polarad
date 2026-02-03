/**
 * Admin API - 광고조정일 관리
 * POST /api/admin/ad-adjustments - 조정일 추가
 * DELETE /api/admin/ad-adjustments?id=recXXX - 조정일 삭제
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!
const BASE_ID = 'appC3XKBcYgZBTETn'
const TABLE_ID = 'tblyuxgVBKEFDAP73'

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { clientSlug, date, type, description, impactDirection } = body

    if (!clientSlug || !date || !type) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다 (clientSlug, date, type)' },
        { status: 400 },
      )
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '날짜 형식이 잘못되었습니다 (YYYY-MM-DD)' }, { status: 400 })
    }

    const validTypes = ['budget_change', 'creative_swap', 'targeting_change', 'campaign_on_off', 'other']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `유효하지 않은 조정 유형: ${type}` }, { status: 400 })
    }

    const now = new Date().toISOString()

    const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              client_slug: clientSlug,
              date,
              type,
              description: description || '',
              impact_direction: impactDirection || 'neutral',
              created_by: 'admin',
              created_at: now,
            },
          },
        ],
      }),
    })

    const result = await response.json()
    if (result.error) {
      console.error('Airtable insert error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    const record = result.records[0]
    return NextResponse.json({
      success: true,
      data: {
        id: record.id,
        client_slug: record.fields.client_slug,
        date: record.fields.date,
        type: record.fields.type,
        description: record.fields.description,
        impact_direction: record.fields.impact_direction,
        created_by: record.fields.created_by,
        created_at: record.fields.created_at,
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    })

    const result = await response.json()
    if (result.error) {
      console.error('Airtable delete error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
