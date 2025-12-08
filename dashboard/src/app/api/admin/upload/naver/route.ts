/**
 * Admin API - 네이버 플레이스 광고 CSV 업로드
 * 테이블: polarad_naver_data
 *
 * CSV 형식 (네이버 광고 시스템 다운로드):
 * 일별,검색어,노출수,클릭수,클릭률(%),평균클릭비용(VAT포함,원),총비용(VAT포함,원),평균노출순위
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'
import { sendNaverUploadNotification } from '@/lib/telegram'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY)
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
  if (!isAdmin(request)) {
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

    // 클라이언트 존재 확인
    const { data: client, error: clientError } = await getSupabaseAdmin()
      .from(TABLES.CLIENTS)
      .select('id, client_name')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: '존재하지 않는 클라이언트입니다.' }, { status: 404 })
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
    })).filter(r => r.date && r.keyword)

    if (records.length === 0) {
      return NextResponse.json({ error: '유효한 데이터가 없습니다.' }, { status: 400 })
    }

    // DB에 upsert
    const { error: insertError } = await getSupabaseAdmin()
      .from(TABLES.NAVER_DATA)
      .upsert(records, {
        onConflict: 'client_id,date,keyword',
        ignoreDuplicates: false,
      })

    if (insertError) {
      console.error('Error inserting naver data:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // 날짜 범위 계산
    const dates = records.map(r => r.date).sort()
    const dateRange = {
      start: dates[0],
      end: dates[dates.length - 1],
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

// GET: 네이버 광고 데이터 조회
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = getSupabaseAdmin()
      .from(TABLES.NAVER_DATA)
      .select('*')
      .order('date', { ascending: false })

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    if (startDate) {
      query = query.gte('date', startDate)
    }

    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data, error } = await query.limit(1000)

    if (error) {
      console.error('Error fetching naver data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
