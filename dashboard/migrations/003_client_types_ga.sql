-- Migration: 클라이언트 타입 시스템 및 Google Analytics 연동
-- Date: 2026-01-05

-- 1. polarad_clients 테이블에 신규 컬럼 추가

-- 클라이언트 업종 타입
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) DEFAULT 'general';

-- 네이버 상세 설정
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS naver_enabled BOOLEAN DEFAULT true;
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS naver_show_keywords BOOLEAN DEFAULT true;
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS naver_show_detail_tab BOOLEAN DEFAULT true;
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS naver_fixed_budget INTEGER;

-- Google Analytics 설정
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS ga_property_id VARCHAR(50);
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS ga_enabled BOOLEAN DEFAULT false;
ALTER TABLE polarad_clients ADD COLUMN IF NOT EXISTS ga_credentials JSONB;

-- 2. 기존 클라이언트 타입 설정

-- H.E.A 판교: 식당 타입
UPDATE polarad_clients
SET
  client_type = 'restaurant',
  naver_enabled = true,
  naver_show_keywords = true,
  naver_show_detail_tab = true
WHERE slug = 'hea-pangyo';

-- 나라똔: 경영컨설팅 타입
UPDATE polarad_clients
SET
  client_type = 'consulting',
  naver_enabled = false,
  naver_show_keywords = false,
  naver_show_detail_tab = false,
  naver_fixed_budget = 1320000
WHERE slug = '나라똔';

-- 3. polarad_analytics_cache 테이블 생성

CREATE TABLE IF NOT EXISTS polarad_analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES polarad_clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- GA 메트릭
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  avg_session_duration DECIMAL(10,2) DEFAULT 0,
  new_users INTEGER DEFAULT 0,

  -- 메타데이터
  source VARCHAR(20) DEFAULT 'ga4',
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(client_id, date)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_analytics_cache_client_date
ON polarad_analytics_cache(client_id, date DESC);

-- 4. 코멘트 추가
COMMENT ON COLUMN polarad_clients.client_type IS '클라이언트 업종: restaurant, consulting, ecommerce, general';
COMMENT ON COLUMN polarad_clients.naver_enabled IS '네이버 데이터 표시 여부';
COMMENT ON COLUMN polarad_clients.naver_show_keywords IS '네이버 키워드 분석 표시';
COMMENT ON COLUMN polarad_clients.naver_show_detail_tab IS '네이버 상세 탭 표시';
COMMENT ON COLUMN polarad_clients.naver_fixed_budget IS '네이버 고정 예산 (브랜드검색용)';
COMMENT ON COLUMN polarad_clients.ga_property_id IS 'Google Analytics Property ID';
COMMENT ON COLUMN polarad_clients.ga_enabled IS 'GA 연동 활성화';
COMMENT ON COLUMN polarad_clients.ga_credentials IS 'GA 서비스 계정 JSON (암호화)';
