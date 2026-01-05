/**
 * 토큰 상태 확인 API
 *
 * GET /api/auth/status?clientId=xxx
 * - 토큰 유효성 검사
 * - 만료 예정 알림
 * - 권한 범위 확인
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateToken, getDaysUntilExpiry, isTokenExpiringSoon, isTokenExpired } from '@/lib/meta-oauth'
import { getClientById } from '@/lib/client-status'
import { decrypt } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  }

  try {
    const client = await getClientById(clientId)

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // 기본 상태 정보
    const statusInfo = {
      clientId: client.id,
      clientName: client.client_name,
      status: client.status,
      isActive: client.is_active,
      hasToken: !!client.meta_access_token,
      tokenExpiresAt: client.meta_token_expires_at,
      tokenUpdatedAt: client.meta_token_updated_at,
      daysUntilExpiry: getDaysUntilExpiry(client.meta_token_expires_at),
      isExpiringSoon: isTokenExpiringSoon(client.meta_token_expires_at),
      isExpired: isTokenExpired(client.meta_token_expires_at),
      adAccountId: client.meta_ad_account_id,
      metaUserId: client.meta_user_id,
      contractStartDate: client.contract_start_date,
      contractEndDate: client.contract_end_date,
      tokenValidation: null as {
        isValid: boolean
        scopes?: string[]
        error?: string
      } | null,
    }

    // 토큰이 있으면 Meta API로 유효성 검증
    if (client.meta_access_token) {
      const decryptedToken = decrypt(client.meta_access_token)

      if (decryptedToken) {
        const validation = await validateToken(decryptedToken)
        statusInfo.tokenValidation = {
          isValid: validation.isValid,
          scopes: validation.scopes,
          error: validation.error,
        }
      }
    }

    return NextResponse.json(statusInfo)
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: 'Status check failed', details: String(error) },
      { status: 500 }
    )
  }
}
