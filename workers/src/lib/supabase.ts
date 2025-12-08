import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Env, DailyAggregate } from '../types'

// Supabase 클라이언트 생성
export function getSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

// 테이블명 상수
const TABLES = {
  CLIENTS: 'polarad_clients',
  META_DATA: 'polarad_meta_data',
} as const

// 일별 데이터 조회
export async function fetchDailyData(
  env: Env,
  clientId: string,
  startDate: string,
  endDate: string
): Promise<DailyAggregate[]> {
  const supabase = getSupabaseClient(env)

  const { data, error } = await supabase
    .from(TABLES.META_DATA)
    .select('*')
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) {
    console.error('❌ Supabase Error:', error.message)
    throw new Error(`데이터 조회 실패: ${error.message}`)
  }

  return data || []
}

// Meta 데이터를 meta_raw_data에 저장 (Upsert)
export async function saveMetaDataToSupabase(
  env: Env,
  data: DailyAggregate[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const supabase = getSupabaseClient(env)

  let success = 0
  let failed = 0
  const errors: string[] = []

  console.log(`💾 Supabase에 ${data.length}건 저장 시작`)

  // 배치 처리 (50건씩)
  const batchSize = 50

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)

    try {
      const { error } = await supabase
        .from(TABLES.META_DATA)
        .upsert(batch, {
          onConflict: 'client_id,date,ad_id,platform,device',
        })

      if (error) {
        console.error(`  ❌ 배치 저장 실패:`, error.message)
        failed += batch.length
        errors.push(error.message)
      } else {
        success += batch.length
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`  ❌ 예외 발생:`, errorMessage)
      failed += batch.length
      errors.push(errorMessage)
    }
  }

  console.log(`✅ 저장 완료: 성공 ${success}건, 실패 ${failed}건`)

  return { success, failed, errors }
}

// 클라이언트 목록 조회 (활성 클라이언트만)
export async function getActiveClients(env: Env) {
  const supabase = getSupabaseClient(env)

  const { data, error } = await supabase
    .from(TABLES.CLIENTS)
    .select('id, client_name, meta_ad_account_id, telegram_chat_id, telegram_enabled')
    .eq('is_active', true)
    .not('meta_ad_account_id', 'is', null)

  if (error) {
    console.error('❌ 클라이언트 조회 실패:', error.message)
    throw new Error(`클라이언트 조회 실패: ${error.message}`)
  }

  return data || []
}
