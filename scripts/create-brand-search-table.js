/**
 * 브랜드검색 테이블 생성 스크립트
 *
 * 실행: node scripts/create-brand-search-table.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mpljqcuqrrfwzamfyxnz.supabase.co';
const SUPABASE_SERVICE_KEY = '***REMOVED***';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createTable() {
  console.log('브랜드검색 테이블 생성 시작...');

  const sql = `
    -- polarad_brand_search_data 테이블 생성
    CREATE TABLE IF NOT EXISTS polarad_brand_search_data (
      id BIGSERIAL PRIMARY KEY,
      client_id UUID NOT NULL REFERENCES polarad_clients(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      device VARCHAR(10) NOT NULL CHECK (device IN ('pc', 'mobile')),
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_brand_search_daily UNIQUE (client_id, date, device)
    );

    -- 인덱스
    CREATE INDEX IF NOT EXISTS idx_brand_search_client_date
      ON polarad_brand_search_data(client_id, date DESC);

    CREATE INDEX IF NOT EXISTS idx_brand_search_date
      ON polarad_brand_search_data(date DESC);
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('RPC 오류:', error.message);

    // RPC가 없으면 직접 쿼리 시도
    console.log('직접 테이블 존재 여부 확인...');

    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'polarad_brand_search_data');

    if (tableError) {
      // information_schema 접근 불가, 직접 테이블 접근 시도
      const { data: testData, error: testError } = await supabase
        .from('polarad_brand_search_data')
        .select('id')
        .limit(1);

      if (testError && testError.code === '42P01') {
        console.log('테이블이 존재하지 않습니다. Supabase 대시보드에서 수동 생성이 필요합니다.');
        console.log('\n=== SQL 스크립트 ===\n');
        console.log(sql);
      } else if (!testError) {
        console.log('✅ polarad_brand_search_data 테이블이 이미 존재합니다.');
      } else {
        console.error('테이블 확인 오류:', testError.message);
      }
    }
  } else {
    console.log('✅ 테이블 생성 완료!');
  }
}

createTable().catch(console.error);
