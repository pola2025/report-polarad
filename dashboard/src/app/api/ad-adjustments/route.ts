/**
 * 광고조정일 조회 API (공개)
 * GET /api/ad-adjustments?clientSlug=bas&startDate=2026-01-01&endDate=2026-01-31
 */

import { NextRequest, NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!
const BASE_ID = 'appC3XKBcYgZBTETn'
const TABLE_ID = 'tblyuxgVBKEFDAP73'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!clientSlug) {
      return NextResponse.json({ error: 'clientSlug is required' }, { status: 400 })
    }

    const conditions = [`{client_slug}='${clientSlug}'`]
    if (startDate) conditions.push(`OR(IS_AFTER({date}, '${startDate}'), {date}='${startDate}')`)
    if (endDate) conditions.push(`OR(IS_BEFORE({date}, '${endDate}'), {date}='${endDate}')`)

    const formula = conditions.length === 1
      ? conditions[0]
      : `AND(${conditions.join(', ')})`

    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=date&sort[0][direction]=asc`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      cache: 'no-store',
    })

    const result = await response.json()
    if (result.error) {
      console.error('Airtable error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (result.records || []).map((r: any) => ({
      id: r.id,
      client_slug: r.fields.client_slug,
      date: r.fields.date,
      type: r.fields.type,
      description: r.fields.description || '',
      impact_direction: r.fields.impact_direction || 'neutral',
      created_by: r.fields.created_by || '',
      created_at: r.fields.created_at || '',
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
