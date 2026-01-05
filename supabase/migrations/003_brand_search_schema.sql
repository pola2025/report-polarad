-- Polarad Meta - Brand Search Data Schema
-- Created: 2026-01-05
-- 네이버 브랜드검색 광고 데이터 테이블

-- ============================================
-- polarad_brand_search_data (브랜드검색 광고)
-- ============================================
CREATE TABLE IF NOT EXISTS polarad_brand_search_data (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES polarad_clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  device VARCHAR(10) NOT NULL CHECK (device IN ('pc', 'mobile')),
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 복합 유니크 제약 (날짜 + 디바이스)
  CONSTRAINT unique_brand_search_daily UNIQUE (client_id, date, device)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_brand_search_client_date
  ON polarad_brand_search_data(client_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_brand_search_date
  ON polarad_brand_search_data(date DESC);

-- Updated_at 트리거 적용
CREATE TRIGGER polarad_brand_search_updated_at
    BEFORE UPDATE ON polarad_brand_search_data
    FOR EACH ROW
    EXECUTE FUNCTION polarad_update_updated_at();

-- RLS 활성화
ALTER TABLE polarad_brand_search_data ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all for service role
CREATE POLICY "polarad_service_full_brand_search_data"
ON polarad_brand_search_data FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Anon users can read active client data
CREATE POLICY "polarad_anon_read_brand_search_data"
ON polarad_brand_search_data FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM polarad_clients
    WHERE polarad_clients.id = polarad_brand_search_data.client_id
    AND polarad_clients.is_active = true
  )
);

-- ============================================
-- 주석
-- ============================================
COMMENT ON TABLE polarad_brand_search_data IS '네이버 브랜드검색 광고 일별 데이터';
COMMENT ON COLUMN polarad_brand_search_data.device IS 'pc 또는 mobile';
COMMENT ON COLUMN polarad_brand_search_data.impressions IS '노출수';
COMMENT ON COLUMN polarad_brand_search_data.clicks IS '클릭수';
