/**
 * Admin API - 네이버 플레이스 광고 CSV 업로드
 * 저장소: Airtable (클라이언트별 광고 데이터 테이블)
 *
 * CSV 형식 (네이버 광고 시스템 다운로드):
 * 일별,검색어,노출수,클릭수,클릭률(%),평균클릭비용(VAT포함,원),총비용(VAT포함,원),평균노출순위
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendNaverUploadNotification } from '@/lib/telegram'
import { AIRTABLE_CONFIG } from '@/lib/airtable'
import { isAdminRequest } from '@/lib/admin-auth'

// Airtable 설정
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY!
const AIRTABLE_CLIENTS_BASE_ID = 'appC3XKBcYgZBTETn'
const AIRTABLE_CLIENTS_TABLE_ID = 'tblwQBbsMyg00qi8F'

// Airtable에서 클라이언트 조회 (UUID 또는 slug로)
async function getClientFromAirtable(clientIdOrSlug: string) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_CLIENTS_BASE_ID}/${AIRTABLE_CLIENTS_TABLE_ID}`

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
    cache: 'no-store',
  })

  const data = await response.json()
  if (data.error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = data.records.find((r: any) =>
    r.fields.id === clientIdOrSlug || r.fields.slug === clientIdOrSlug
  )

  if (!record) return null

  return {
    id: record.fields.id || record.id,
    client_name: record.fields.Name,
    slug: record.fields.slug,
  }
}

// 날짜 형식 변환 (2025.11.29. → 2025-11-29)
function parseNaverDate(dateStr: string): string {
  const cleaned = dateStr.replace(/\./g, '-').replace(/-$/, '')
  const parts = cleaned.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return cleaned
}

// 숫자 파싱 (쉼표 제거)
function parseNumber(value: string): number {
  if (!value || value === '-') return 0
  return Number(value.replace(/,/g, '')) || 0
}

// 퍼센트 파싱
function parsePercent(value: string): number {
  if (!value || value === '-') return 0
  return Number(value.replace(/%/g, '').replace(/,/g, '')) || 0
}

// CSV 파싱
function parseCSV(csvText: string): string[][] {
  const lines = csvText.split('\n')
  const result: string[][] = []

  for (const line of lines) {
    if (!line.trim()) continue

    // 간단한 CSV 파싱 (쉼표 구분, 따옴표 처리)
    const row: string[] = []
    let cell = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        row.push(cell.trim())
        cell = ''
      } else {
        cell += char
      }
    }
    row.push(cell.trim())
    result.push(row)
  }

  return result
}

// POST: CSV 업로드 및 파싱
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const clientId = formData.get('clientId') as string

    if (!file) {
      return NextResponse.json({ error: 'CSV 파일이 필요합니다.' }, { status: 400 })
    }

    if (!clientId) {
      return NextResponse.json({ error: '클라이언트 ID가 필요합니다.' }, { status: 400 })
    }

    // Airtable에서 클라이언트 조회
    const client = await getClientFromAirtable(clientId)
    if (!client) {
      return NextResponse.json({ error: '존재하지 않는 클라이언트입니다.' }, { status: 404 })
    }

    // 클라이언트별 Airtable 설정 확인
    const airtableConfig = AIRTABLE_CONFIG[client.slug]
    if (!airtableConfig) {
      return NextResponse.json({ error: `클라이언트 ${client.slug}의 Airtable 설정이 없습니다.` }, { status: 400 })
    }

    // CSV 파일 읽기
    const csvText = await file.text()
    const rows = parseCSV(csvText)

    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV 파일이 비어있거나 형식이 잘못되었습니다.' }, { status: 400 })
    }

    // 헤더 확인 - 첫 번째 행이 제목 줄일 수 있으므로 체크
    let headerRowIndex = 0
    let header = rows[0]
    const expectedHeaders = ['일별', '검색어', '노출수', '클릭수']
    let hasValidHeader = expectedHeaders.some(h => header.some(col => col.includes(h)))

    // 첫 번째 행이 헤더가 아니면 두 번째 행 확인 (네이버 월간리포트 제목 줄 건너뛰기)
    if (!hasValidHeader && rows.length > 1) {
      header = rows[1]
      hasValidHeader = expectedHeaders.some(h => header.some(col => col.includes(h)))
      if (hasValidHeader) {
        headerRowIndex = 1
      }
    }

    if (!hasValidHeader) {
      return NextResponse.json({
        error: '네이버 광고 CSV 형식이 아닙니다. 필수 컬럼: 일별, 검색어, 노출수, 클릭수',
        receivedHeader: rows[0]
      }, { status: 400 })
    }

    // 컬럼 인덱스 찾기
    const dateIdx = header.findIndex(h => h.includes('일별'))
    const keywordIdx = header.findIndex(h => h.includes('검색어'))
    const impressionsIdx = header.findIndex(h => h.includes('노출수'))
    const clicksIdx = header.findIndex(h => h.includes('클릭수'))
    const ctrIdx = header.findIndex(h => h.includes('클릭률'))
    const cpcIdx = header.findIndex(h => h.includes('평균클릭비용'))
    const costIdx = header.findIndex(h => h.includes('총비용'))
    const rankIdx = header.findIndex(h => h.includes('평균노출순위'))

    // 데이터 행 파싱 (헤더 다음 행부터)
    const dataRows = rows.slice(headerRowIndex + 1).filter(row => row.length >= 4 && row[dateIdx])

    const records = dataRows.map(row => ({
      client_id: clientId,
      date: parseNaverDate(row[dateIdx] || ''),
      keyword: row[keywordIdx] || '',
      impressions: Math.round(parseNumber(row[impressionsIdx] || '0')),
      clicks: Math.round(parseNumber(row[clicksIdx] || '0')),
      ctr: Math.round(parsePercent(row[ctrIdx] || '0') * 100) / 100, // 소수점 2자리
      avg_cpc: Math.round(parseNumber(row[cpcIdx] || '0')),
      total_cost: Math.round(parseNumber(row[costIdx] || '0')),
      avg_rank: Math.round(parseNumber(row[rankIdx] || '1')) || 1,
    })).filter(r => {
      // 총계/합계 행 제외 (중복 데이터 방지)
      if (!r.date || !r.keyword) return false
      const lowerKeyword = r.keyword.toLowerCase()
      if (lowerKeyword === 'total' || lowerKeyword === '총계' || lowerKeyword === '합계') return false
      return true
    })

    if (records.length === 0) {
      return NextResponse.json({ error: '유효한 데이터가 없습니다.' }, { status: 400 })
    }

    // 날짜 범위 계산
    const dates = records.map(r => r.date).sort()
    const dateRange = {
      start: dates[0],
      end: dates[dates.length - 1],
    }

    // 키워드별 레코드 생성 (일별 + 키워드별로 각각 저장)
    const airtableRecords = records.map(r => ({
      fields: {
        date: r.date,
        device: 'all',
        impressions: r.impressions,
        clicks: r.clicks,
        spend: r.total_cost,
        source: 'naver_place',
        keywords: r.keyword,  // 개별 키워드
        avg_rank: r.avg_rank,  // 평균 순위
        avg_cpc: r.avg_cpc,    // 평균 CPC
        is_finalized: true,
      }
    }))

    // 1. 해당 날짜 범위의 기존 naver_place 데이터 삭제
    const endDateObj = new Date(dateRange.end)
    endDateObj.setDate(endDateObj.getDate() + 1)
    const nextDay = endDateObj.toISOString().split('T')[0]

    const deleteFormula = `AND({date}>='${dateRange.start}', {date}<'${nextDay}', {source}='naver_place')`
    const existingUrl = `https://api.airtable.com/v0/${airtableConfig.baseId}/${airtableConfig.tableId}?filterByFormula=${encodeURIComponent(deleteFormula)}`

    const existingResponse = await fetch(existingUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
      cache: 'no-store',
    })
    const existingData = await existingResponse.json()

    // 기존 레코드 삭제 (10개씩 배치)
    if (existingData.records?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recordIds = existingData.records.map((r: any) => r.id)
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10)
        const deleteParams = batch.map((id: string) => `records[]=${id}`).join('&')
        await fetch(`https://api.airtable.com/v0/${airtableConfig.baseId}/${airtableConfig.tableId}?${deleteParams}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
        })
      }
    }

    // 2. 새 레코드 삽입 (10개씩 배치)
    for (let i = 0; i < airtableRecords.length; i += 10) {
      const batch = airtableRecords.slice(i, i + 10)
      const insertResponse = await fetch(`https://api.airtable.com/v0/${airtableConfig.baseId}/${airtableConfig.tableId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: batch }),
      })

      const insertResult = await insertResponse.json()
      if (insertResult.error) {
        console.error('Airtable insert error:', insertResult.error)
        return NextResponse.json({ error: insertResult.error.message }, { status: 500 })
      }
    }

    // 키워드별 통계
    const keywordStats = records.reduce((acc, r) => {
      if (!acc[r.keyword]) {
        acc[r.keyword] = { impressions: 0, clicks: 0, cost: 0 }
      }
      acc[r.keyword].impressions += r.impressions
      acc[r.keyword].clicks += r.clicks
      acc[r.keyword].cost += r.total_cost
      return acc
    }, {} as Record<string, { impressions: number; clicks: number; cost: number }>)

    const summary = {
      client: client.client_name,
      totalRecords: records.length,
      dateRange,
      uniqueKeywords: Object.keys(keywordStats).length,
      totalImpressions: records.reduce((sum, r) => sum + r.impressions, 0),
      totalClicks: records.reduce((sum, r) => sum + r.clicks, 0),
      totalCost: records.reduce((sum, r) => sum + r.total_cost, 0),
      keywordStats,
    }

    // 텔레그램 알림 전송 (비동기, 실패해도 무시)
    sendNaverUploadNotification(client.client_name, {
      dateRange: summary.dateRange,
      totalRecords: summary.totalRecords,
      uniqueKeywords: summary.uniqueKeywords,
      totalCost: summary.totalCost,
      totalClicks: summary.totalClicks,
    }).catch((err) => console.error('텔레그램 알림 실패:', err))

    return NextResponse.json({
      success: true,
      message: `${records.length}건의 데이터가 업로드되었습니다.`,
      summary,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: 네이버 광고 데이터 조회 (Airtable)
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!clientId) {
      return NextResponse.json({ error: '클라이언트 ID가 필요합니다.' }, { status: 400 })
    }

    // Airtable에서 클라이언트 조회
    const client = await getClientFromAirtable(clientId)
    if (!client) {
      return NextResponse.json({ error: '존재하지 않는 클라이언트입니다.' }, { status: 404 })
    }

    const airtableConfig = AIRTABLE_CONFIG[client.slug]
    if (!airtableConfig) {
      return NextResponse.json({ error: `클라이언트 ${client.slug}의 Airtable 설정이 없습니다.` }, { status: 400 })
    }

    // Airtable에서 naver_place 데이터 조회
    let formula = `{source}='naver_place'`
    if (startDate && endDate) {
      const endDateObj = new Date(endDate)
      endDateObj.setDate(endDateObj.getDate() + 1)
      const nextDay = endDateObj.toISOString().split('T')[0]
      formula = `AND({source}='naver_place', {date}>='${startDate}', {date}<'${nextDay}')`
    } else if (startDate) {
      formula = `AND({source}='naver_place', {date}>='${startDate}')`
    } else if (endDate) {
      const endDateObj = new Date(endDate)
      endDateObj.setDate(endDateObj.getDate() + 1)
      const nextDay = endDateObj.toISOString().split('T')[0]
      formula = `AND({source}='naver_place', {date}<'${nextDay}')`
    }

    const url = `https://api.airtable.com/v0/${airtableConfig.baseId}/${airtableConfig.tableId}?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=date&sort[0][direction]=desc`

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
      cache: 'no-store',
    })

    const result = await response.json()
    if (result.error) {
      console.error('Airtable fetch error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.records.map((r: any) => ({
      id: r.id,
      client_id: clientId,
      date: r.fields.date,
      device: r.fields.device,
      impressions: r.fields.impressions || 0,
      clicks: r.fields.clicks || 0,
      total_cost: r.fields.spend || 0,
      keywords: r.fields.keywords || '',
      source: r.fields.source,
    }))

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
