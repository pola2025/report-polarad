-- OAuth 인증 시스템을 위한 DB 마이그레이션
-- 실행: Supabase Dashboard > SQL Editor에서 실행

-- 1. auth_status를 status로 변경 (이미 auth_status가 있는 경우)
-- 기존 auth_status 컬럼이 있으면 status로 이름 변경
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'polarad_clients' AND column_name = 'auth_status'
  ) THEN
    ALTER TABLE polarad_clients RENAME COLUMN auth_status TO status;
  END IF;
END $$;

-- 2. status 컬럼이 없으면 추가
ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- 3. 기존 'error' 값을 'suspended'로 변환
UPDATE polarad_clients SET status = 'suspended' WHERE status = 'error';

-- 4. 상태 체크 제약조건 추가 (기존 제약조건 삭제 후 재생성)
ALTER TABLE polarad_clients DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE polarad_clients DROP CONSTRAINT IF EXISTS valid_auth_status;
ALTER TABLE polarad_clients
ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'suspended', 'expired'));

-- 5. OAuth 관련 필드 추가
ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS meta_token_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS meta_user_id VARCHAR(50);

ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS meta_token_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 6. 승인 관련 필드 추가
ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100);

ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS contract_start_date DATE;

ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS contract_end_date DATE;

ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE polarad_clients
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 7. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_polarad_clients_status ON polarad_clients(status);
CREATE INDEX IF NOT EXISTS idx_polarad_clients_meta_user_id ON polarad_clients(meta_user_id);

-- 8. 기존 active 클라이언트는 그대로 유지 (기존 데이터 보호)
-- is_active가 true인 클라이언트는 status도 active로 설정
UPDATE polarad_clients
SET status = 'active'
WHERE is_active = true AND status = 'pending';

-- 완료 메시지
DO $$ BEGIN RAISE NOTICE 'Migration completed: OAuth status fields added'; END $$;
