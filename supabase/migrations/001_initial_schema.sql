-- Polarad Meta - Initial Database Schema
-- Created: 2025-12-07
-- 모든 테이블에 polarad_ 접두사 사용 (BAS-Meta와 분리)

-- ============================================
-- 1. polarad_clients (클라이언트 정보)
-- ============================================
CREATE TABLE polarad_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR(50) UNIQUE NOT NULL,
  client_name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE,
  meta_ad_account_id VARCHAR(50),
  meta_access_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  auth_status VARCHAR(20) DEFAULT 'pending',
  is_active BOOLEAN DEFAULT true,
  telegram_chat_id VARCHAR(50),
  telegram_enabled BOOLEAN DEFAULT false,
  service_start_date DATE,
  service_end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for slug lookup
CREATE INDEX idx_polarad_clients_slug ON polarad_clients(slug);
CREATE INDEX idx_polarad_clients_is_active ON polarad_clients(is_active);

-- ============================================
-- 2. polarad_meta_data (Meta 광고 데이터)
-- ============================================
CREATE TABLE polarad_meta_data (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID REFERENCES polarad_clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ad_id VARCHAR(50) NOT NULL,
  ad_name VARCHAR(255),
  campaign_id VARCHAR(50),
  campaign_name VARCHAR(255),
  platform VARCHAR(20), -- facebook, instagram
  device VARCHAR(20), -- mobile, desktop
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  avg_watch_time DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'KRW',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, date, ad_id, platform, device)
);

-- Indexes for efficient querying
CREATE INDEX idx_polarad_meta_data_client_date ON polarad_meta_data(client_id, date);
CREATE INDEX idx_polarad_meta_data_date ON polarad_meta_data(date);
CREATE INDEX idx_polarad_meta_data_campaign ON polarad_meta_data(campaign_id);

-- ============================================
-- 3. polarad_naver_data (네이버 플레이스 광고)
-- ============================================
CREATE TABLE polarad_naver_data (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID REFERENCES polarad_clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  keyword VARCHAR(100) NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  avg_cpc INTEGER DEFAULT 0,
  total_cost INTEGER DEFAULT 0,
  avg_rank DECIMAL(3,1) DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, date, keyword)
);

-- Indexes
CREATE INDEX idx_polarad_naver_data_client_date ON polarad_naver_data(client_id, date);
CREATE INDEX idx_polarad_naver_data_keyword ON polarad_naver_data(keyword);

-- ============================================
-- 4. polarad_keyword_stats (상호명 검색 통계)
-- ============================================
CREATE TABLE polarad_keyword_stats (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID REFERENCES polarad_clients(id) ON DELETE CASCADE,
  year_month VARCHAR(7) NOT NULL, -- YYYY-MM
  keyword VARCHAR(100) NOT NULL,
  pc_searches INTEGER DEFAULT 0,
  mobile_searches INTEGER DEFAULT 0,
  total_searches INTEGER GENERATED ALWAYS AS (pc_searches + mobile_searches) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, year_month, keyword)
);

-- Indexes
CREATE INDEX idx_polarad_keyword_stats_client_month ON polarad_keyword_stats(client_id, year_month);
CREATE INDEX idx_polarad_keyword_stats_keyword ON polarad_keyword_stats(keyword);

-- ============================================
-- 5. Updated_at Trigger Function
-- ============================================
CREATE OR REPLACE FUNCTION polarad_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER polarad_clients_updated_at
    BEFORE UPDATE ON polarad_clients
    FOR EACH ROW
    EXECUTE FUNCTION polarad_update_updated_at();

CREATE TRIGGER polarad_keyword_stats_updated_at
    BEFORE UPDATE ON polarad_keyword_stats
    FOR EACH ROW
    EXECUTE FUNCTION polarad_update_updated_at();

-- ============================================
-- 6. Row Level Security (RLS)
-- ============================================
ALTER TABLE polarad_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE polarad_meta_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE polarad_naver_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE polarad_keyword_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all for service role
CREATE POLICY "polarad_service_full_clients"
ON polarad_clients FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "polarad_service_full_meta_data"
ON polarad_meta_data FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "polarad_service_full_naver_data"
ON polarad_naver_data FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "polarad_service_full_keyword_stats"
ON polarad_keyword_stats FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Anon users can read active client data
CREATE POLICY "polarad_anon_read_clients"
ON polarad_clients FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "polarad_anon_read_meta_data"
ON polarad_meta_data FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM polarad_clients
    WHERE polarad_clients.id = polarad_meta_data.client_id
    AND polarad_clients.is_active = true
  )
);

CREATE POLICY "polarad_anon_read_naver_data"
ON polarad_naver_data FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM polarad_clients
    WHERE polarad_clients.id = polarad_naver_data.client_id
    AND polarad_clients.is_active = true
  )
);

CREATE POLICY "polarad_anon_read_keyword_stats"
ON polarad_keyword_stats FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM polarad_clients
    WHERE polarad_clients.id = polarad_keyword_stats.client_id
    AND polarad_clients.is_active = true
  )
);
