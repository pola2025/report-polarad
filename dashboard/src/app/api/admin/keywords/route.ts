/**
 * Admin API - 상호명 검색 키워드 통계
 * 테이블: polarad_keyword_stats
 *
 * 관리자가 월별로 키워드 검색량을 수동 입력
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { TABLES } from '@/lib/supabase'

// 관리자 키 검증
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key')
  return adminKey === (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY)
}

// GET: 키워드 통계 조회
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const yearMonth = searchParams.get('yearMonth')
    const keyword = searchParams.get('keyword')

    let query = getSupabaseAdmin()
      .from(TABLES.KEYWORD_STATS)
      .select(`
        *,
        client:polarad_clients(client_name, slug)
      `)
      .order('year_month', { ascending: false })
      .order('keyword', { ascending: true })

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    if (yearMonth) {
      query = query.eq('year_month', yearMonth)
    }

    if (keyword) {
      query = query.ilike('keyword', `%${keyword}%`)
    }

    const { data, error } = await query.limit(500)

    if (error) {
      console.error('Error fetching keyword stats:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 월별 요약 계산
    const monthlySummary = (data || []).reduce((acc, row) => {
      const month = row.year_month
      if (!acc[month]) {
        acc[month] = {
          year_month: month,
          total_pc: 0,
          total_mobile: 0,
          total_searches: 0,
          keyword_count: 0,
        }
      }
      acc[month].total_pc += row.pc_searches || 0
      acc[month].total_mobile += row.mobile_searches || 0
      acc[month].total_searches += row.total_searches || 0
      acc[month].keyword_count += 1
      return acc
    }, {} as Record<string, { year_month: string; total_pc: number; total_mobile: number; total_searches: number; keyword_count: number }>)

    const sortedMonthlySummary = (Object.values(monthlySummary) as Array<{ year_month: string; total_pc: number; total_mobile: number; total_searches: number; keyword_count: number }>).sort((a, b) => b.year_month.localeCompare(a.year_month))

    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0,
      monthlySummary: sortedMonthlySummary,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 키워드 통계 입력 (단일 또는 일괄)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // 일괄 입력 (배열)
    if (Array.isArray(body.records)) {
      const records = body.records.map((r: {
        clientId: string
        yearMonth: string
        keyword: string
        pcSearches: number
        mobileSearches: number
        notes?: string
      }) => ({
        client_id: r.clientId,
        year_month: r.yearMonth,
        keyword: r.keyword,
        pc_searches: r.pcSearches || 0,
        mobile_searches: r.mobileSearches || 0,
        notes: r.notes || null,
      }))

      // 유효성 검증
      for (const record of records) {
        if (!record.client_id || !record.year_month || !record.keyword) {
          return NextResponse.json({
            error: '필수 필드가 누락되었습니다 (clientId, yearMonth, keyword)',
            invalidRecord: record,
          }, { status: 400 })
        }
      }

      // 클라이언트 존재 확인
      const clientIds = Array.from(new Set(records.map((r: { client_id: string }) => r.client_id)))
      const { data: clients, error: clientError } = await getSupabaseAdmin()
        .from(TABLES.CLIENTS)
        .select('id')
        .in('id', clientIds)

      if (clientError) {
        return NextResponse.json({ error: clientError.message }, { status: 500 })
      }

      const validClientIds = new Set(clients?.map(c => c.id) || [])
      const invalidClients = clientIds.filter(id => !validClientIds.has(id))

      if (invalidClients.length > 0) {
        return NextResponse.json({
          error: '존재하지 않는 클라이언트가 포함되어 있습니다.',
          invalidClientIds: invalidClients,
        }, { status: 404 })
      }

      // Upsert
      const { error: insertError } = await getSupabaseAdmin()
        .from(TABLES.KEYWORD_STATS)
        .upsert(records, {
          onConflict: 'client_id,year_month,keyword',
          ignoreDuplicates: false,
        })

      if (insertError) {
        console.error('Error inserting keyword stats:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `${records.length}건의 키워드 통계가 저장되었습니다.`,
        count: records.length,
      })
    }

    // 단일 입력
    const { clientId, yearMonth, keyword, pcSearches, mobileSearches, notes } = body

    if (!clientId || !yearMonth || !keyword) {
      return NextResponse.json({
        error: '필수 필드가 누락되었습니다 (clientId, yearMonth, keyword)',
      }, { status: 400 })
    }

    // yearMonth 형식 검증 (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json({
        error: 'yearMonth 형식이 잘못되었습니다 (YYYY-MM)',
      }, { status: 400 })
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

    // Upsert
    const { data, error: insertError } = await getSupabaseAdmin()
      .from(TABLES.KEYWORD_STATS)
      .upsert({
        client_id: clientId,
        year_month: yearMonth,
        keyword,
        pc_searches: pcSearches || 0,
        mobile_searches: mobileSearches || 0,
        notes: notes || null,
      }, {
        onConflict: 'client_id,year_month,keyword',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting keyword stat:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '키워드 통계가 저장되었습니다.',
      data,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 키워드 통계 삭제
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const { error } = await getSupabaseAdmin()
      .from(TABLES.KEYWORD_STATS)
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting keyword stat:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '키워드 통계가 삭제되었습니다.',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
