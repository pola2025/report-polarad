import { NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY
const BASE_ID = 'appJlOqnadLsMJQYw'
const TABLE_ID = 'tbl8ftclEFG5ypohX'

/**
 * GET: 월별 캠페인 실제 합계 조회
 * ?month=2026-01 (YYYY-MM)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')

  if (!month) {
    return NextResponse.json({ error: 'month parameter required (YYYY-MM)' }, { status: 400 })
  }

  const monthStart = `${month}-01`
  const formula = `AND(DATESTR({date})='${monthStart}', {source}='naver_campaign_override')`

  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}&pageSize=1`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  })
  const data = await res.json()

  if (data.records && data.records.length > 0) {
    const r = data.records[0]
    return NextResponse.json({
      month,
      impressions: r.fields.impressions || 0,
      clicks: r.fields.clicks || 0,
      spend: r.fields.spend || 0,
      recordId: r.id,
    })
  }

  return NextResponse.json({ month, impressions: null, clicks: null, spend: null })
}

/**
 * POST: 월별 캠페인 실제 합계 저장
 * body: { month: "2026-01", impressions: 29677, clicks: 481, spend: 828212 }
 */
export async function POST(request: Request) {
  const body = await request.json()
  const { month, impressions, clicks, spend } = body

  if (!month || spend === undefined) {
    return NextResponse.json({ error: 'month and spend are required' }, { status: 400 })
  }

  const monthStart = `${month}-01`

  // 기존 레코드 확인
  const formula = `AND(DATESTR({date})='${monthStart}', {source}='naver_campaign_override')`
  const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}&pageSize=1`
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
  })
  const searchData = await searchRes.json()

  const fields = {
    date: monthStart,
    source: 'naver_campaign_override',
    device: 'all',
    impressions: impressions || 0,
    clicks: clicks || 0,
    spend: spend || 0,
    keywords: '_campaign_override_',
    is_finalized: true,
  }

  if (searchData.records && searchData.records.length > 0) {
    // 업데이트
    const recordId = searchData.records[0].id
    await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    })
  } else {
    // 생성
    await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    })
  }

  return NextResponse.json({ success: true, month, impressions, clicks, spend })
}
