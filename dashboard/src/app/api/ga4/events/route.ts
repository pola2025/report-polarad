/**
 * GA4 Events API
 * 특정 이벤트(폼 제출 등) 데이터 조회
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  getGA4Credentials,
  fetchGA4EventData,
} from '@/lib/ga4'
import type { GA4EventsResponse } from '@/types/ga4-analytics'

// GA4 지원 클라이언트 설정
const GA4_CLIENTS: Record<string, { propertyId: string; name: string }> = {
  naratton: {
    propertyId: process.env.GA4_NARATTON_PROPERTY_ID || '497585078',
    name: '나라똔',
  },
}

// 기본 시작 날짜 (30일 전)
function getDefaultStartDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().split('T')[0]
}

// GET: GA4 이벤트 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientSlug = searchParams.get('clientSlug') || searchParams.get('clientId')
    const startDate = searchParams.get('startDate') || getDefaultStartDate()
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const eventName = searchParams.get('eventName') || 'generate_lead'

    // 클라이언트 확인
    if (!clientSlug || !GA4_CLIENTS[clientSlug]) {
      return NextResponse.json(
        {
          success: false,
          error: `GA4가 지원되지 않는 클라이언트입니다. 지원 클라이언트: ${Object.keys(GA4_CLIENTS).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // GA4 자격 증명 확인
    const credentials = getGA4Credentials()
    if (!credentials) {
      return NextResponse.json(
        {
          success: false,
          error: 'GA4 서비스 계정이 설정되지 않았습니다.',
        },
        { status: 500 }
      )
    }

    const { propertyId } = GA4_CLIENTS[clientSlug]

    // 이벤트 데이터 조회
    const eventData = await fetchGA4EventData(
      propertyId,
      credentials,
      startDate,
      endDate,
      eventName
    )

    const response: GA4EventsResponse = {
      success: true,
      data: eventData,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('GA4 events error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'GA4 이벤트 데이터 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
