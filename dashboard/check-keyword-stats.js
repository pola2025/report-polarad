const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  // H.E.A 판교 클라이언트 ID
  const clientId = '3ff2896e-6786-4936-9c57-311f69f43c63'
  
  const { data, error } = await supabase
    .from('polarad_keyword_stats')
    .select('*')
    .eq('client_id', clientId)
    .order('year_month', { ascending: false })
    .limit(20)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('키워드 통계 데이터:')
  console.log(JSON.stringify(data, null, 2))
  console.log('총 개수:', data?.length || 0)
}

check()
