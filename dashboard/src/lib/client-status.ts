/**
 * 클라이언트 상태 관리 유틸리티
 *
 * 클라이언트 서비스 상태 (pending, active, suspended, expired) 관리
 */

import { createServerClient, TABLES } from './supabase'
import { encrypt, decrypt } from './encryption'

// 클라이언트 상태 타입
export type ClientStatus = 'pending' | 'active' | 'suspended' | 'expired'

// 클라이언트 정보 (OAuth 관련 필드 포함)
export interface ClientWithOAuth {
  id: string
  client_id: string
  client_name: string
  slug: string | null
  meta_ad_account_id: string | null
  meta_access_token: string | null
  meta_token_expires_at: string | null
  meta_user_id: string | null
  meta_token_updated_at: string | null
  status: ClientStatus
  is_active: boolean
  approved_at: string | null
  approved_by: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  suspended_at: string | null
  suspension_reason: string | null
  telegram_chat_id: string | null
  telegram_enabled: boolean
  created_at: string
  updated_at: string
}

/**
 * 클라이언트 목록 조회 (상태별 필터)
 */
export async function getClients(status?: ClientStatus): Promise<ClientWithOAuth[]> {
  const supabase = createServerClient()

  let query = supabase.from(TABLES.CLIENTS).select('*').order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`)
  }

  return data || []
}

/**
 * 클라이언트 조회 (ID로)
 */
export async function getClientById(id: string): Promise<ClientWithOAuth | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase.from(TABLES.CLIENTS).select('*').eq('id', id).single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new Error(`Failed to fetch client: ${error.message}`)
  }

  return data
}

/**
 * Meta User ID로 클라이언트 조회
 */
export async function getClientByMetaUserId(metaUserId: string): Promise<ClientWithOAuth | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from(TABLES.CLIENTS)
    .select('*')
    .eq('meta_user_id', metaUserId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch client: ${error.message}`)
  }

  return data
}

/**
 * 새 클라이언트 생성 (OAuth 인증 후)
 */
export async function createClientFromOAuth(params: {
  metaUserId: string
  metaUserName: string
  accessToken: string
  tokenExpiresAt: Date
  adAccountId?: string
}): Promise<ClientWithOAuth> {
  const supabase = createServerClient()

  // 클라이언트 ID와 슬러그 생성
  const clientId = `meta-${params.metaUserId}`
  const slug = `user-${params.metaUserId}`

  const encryptedToken = encrypt(params.accessToken)

  const { data, error } = await supabase
    .from(TABLES.CLIENTS)
    .insert({
      client_id: clientId,
      client_name: params.metaUserName,
      slug: slug,
      meta_user_id: params.metaUserId,
      meta_access_token: encryptedToken,
      meta_token_expires_at: params.tokenExpiresAt.toISOString(),
      meta_token_updated_at: new Date().toISOString(),
      meta_ad_account_id: params.adAccountId || null,
      status: 'pending',
      is_active: false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create client: ${error.message}`)
  }

  return data
}

/**
 * 클라이언트 OAuth 정보 업데이트 (재인증 시)
 */
export async function updateClientOAuth(
  clientId: string,
  params: {
    accessToken: string
    tokenExpiresAt: Date
    adAccountId?: string
  }
): Promise<void> {
  const supabase = createServerClient()

  const encryptedToken = encrypt(params.accessToken)

  const { error } = await supabase
    .from(TABLES.CLIENTS)
    .update({
      meta_access_token: encryptedToken,
      meta_token_expires_at: params.tokenExpiresAt.toISOString(),
      meta_token_updated_at: new Date().toISOString(),
      ...(params.adAccountId && { meta_ad_account_id: params.adAccountId }),
    })
    .eq('id', clientId)

  if (error) {
    throw new Error(`Failed to update client OAuth: ${error.message}`)
  }
}

/**
 * 클라이언트 승인
 */
export async function approveClient(
  clientId: string,
  approvedBy: string,
  contractDates?: { start: Date; end: Date }
): Promise<void> {
  const supabase = createServerClient()

  const updateData: Record<string, unknown> = {
    status: 'active',
    is_active: true,
    approved_at: new Date().toISOString(),
    approved_by: approvedBy,
    suspended_at: null,
    suspension_reason: null,
  }

  if (contractDates) {
    updateData.contract_start_date = contractDates.start.toISOString().split('T')[0]
    updateData.contract_end_date = contractDates.end.toISOString().split('T')[0]
  }

  const { error } = await supabase.from(TABLES.CLIENTS).update(updateData).eq('id', clientId)

  if (error) {
    throw new Error(`Failed to approve client: ${error.message}`)
  }
}

/**
 * 클라이언트 일시 중지
 */
export async function suspendClient(clientId: string, reason: string): Promise<void> {
  const supabase = createServerClient()

  const { error } = await supabase
    .from(TABLES.CLIENTS)
    .update({
      status: 'suspended',
      is_active: false,
      suspended_at: new Date().toISOString(),
      suspension_reason: reason,
    })
    .eq('id', clientId)

  if (error) {
    throw new Error(`Failed to suspend client: ${error.message}`)
  }
}

/**
 * 클라이언트 재활성화
 */
export async function activateClient(clientId: string): Promise<void> {
  const supabase = createServerClient()

  const { error } = await supabase
    .from(TABLES.CLIENTS)
    .update({
      status: 'active',
      is_active: true,
      suspended_at: null,
      suspension_reason: null,
    })
    .eq('id', clientId)

  if (error) {
    throw new Error(`Failed to activate client: ${error.message}`)
  }
}

/**
 * 클라이언트 만료 처리
 */
export async function expireClient(clientId: string): Promise<void> {
  const supabase = createServerClient()

  const { error } = await supabase
    .from(TABLES.CLIENTS)
    .update({
      status: 'expired',
      is_active: false,
    })
    .eq('id', clientId)

  if (error) {
    throw new Error(`Failed to expire client: ${error.message}`)
  }
}

/**
 * 복호화된 Access Token 가져오기
 */
export async function getDecryptedToken(clientId: string): Promise<string | null> {
  const client = await getClientById(clientId)
  if (!client?.meta_access_token) return null

  return decrypt(client.meta_access_token)
}

/**
 * 서비스 접근 가능 여부 확인
 */
export function canAccessService(client: ClientWithOAuth): boolean {
  return client.status === 'active' && client.is_active
}

/**
 * 상태별 통계 조회
 */
export async function getClientStats(): Promise<Record<ClientStatus, number>> {
  const supabase = createServerClient()

  const { data, error } = await supabase.from(TABLES.CLIENTS).select('status')

  if (error) {
    throw new Error(`Failed to fetch client stats: ${error.message}`)
  }

  const stats: Record<ClientStatus, number> = {
    pending: 0,
    active: 0,
    suspended: 0,
    expired: 0,
  }

  data?.forEach((client) => {
    const status = client.status as ClientStatus
    if (status in stats) {
      stats[status]++
    }
  })

  return stats
}
