-- 리포트 스키마 마이그레이션
-- 월간/주간 리포트 및 관리자 코멘트 지원

-- 리포트 테이블
CREATE TABLE IF NOT EXISTS polarad_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR(255) NOT NULL REFERENCES polarad_clients(client_id) ON DELETE CASCADE,
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('monthly', 'weekly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  year INT NOT NULL,
  month INT CHECK (month >= 1 AND month <= 12),
  week INT CHECK (week >= 1 AND week <= 53),

  -- 리포트 상태
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,

  -- KPI 요약 (캐시)
  summary_data JSONB,

  -- AI 인사이트 (캐시)
  ai_insights JSONB,
  ai_generated_at TIMESTAMPTZ,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255),

  -- 유니크 제약: 같은 클라이언트, 타입, 기간에 중복 리포트 방지
  CONSTRAINT unique_report UNIQUE (client_id, report_type, period_start, period_end)
);

-- 관리자 코멘트 테이블 (월간 리포트만)
CREATE TABLE IF NOT EXISTS polarad_report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES polarad_reports(id) ON DELETE CASCADE,

  -- 코멘트 내용
  content TEXT NOT NULL,
  content_html TEXT, -- 렌더링된 HTML (마크다운 지원용)

  -- 작성자 정보
  author_name VARCHAR(100) DEFAULT '폴라애드 광고운영팀',
  author_role VARCHAR(100),

  -- 상태
  is_visible BOOLEAN DEFAULT TRUE,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 하나의 리포트에 하나의 코멘트만
  CONSTRAINT one_comment_per_report UNIQUE (report_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reports_client_id ON polarad_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON polarad_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_period ON polarad_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_reports_status ON polarad_reports(status);
CREATE INDEX IF NOT EXISTS idx_report_comments_report_id ON polarad_report_comments(report_id);

-- RLS 정책
ALTER TABLE polarad_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE polarad_report_comments ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 published 리포트 읽기 가능
CREATE POLICY "Anyone can read published reports" ON polarad_reports
  FOR SELECT USING (status = 'published');

-- 서비스 역할은 모든 작업 가능
CREATE POLICY "Service role full access on reports" ON polarad_reports
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on comments" ON polarad_report_comments
  FOR ALL USING (auth.role() = 'service_role');

-- 코멘트는 visible인 것만 읽기 가능
CREATE POLICY "Anyone can read visible comments" ON polarad_report_comments
  FOR SELECT USING (is_visible = TRUE);

-- Updated at 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON polarad_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_comments_updated_at
  BEFORE UPDATE ON polarad_report_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 코멘트 (한글 설명)
COMMENT ON TABLE polarad_reports IS '월간/주간 리포트 메타데이터';
COMMENT ON TABLE polarad_report_comments IS '리포트 관리자 코멘트 (월간 리포트만)';
COMMENT ON COLUMN polarad_reports.summary_data IS 'KPI 요약 데이터 캐시 (JSON)';
COMMENT ON COLUMN polarad_reports.ai_insights IS 'AI 생성 인사이트 캐시 (JSON)';
COMMENT ON COLUMN polarad_report_comments.content IS '마크다운 형식 코멘트 내용';
COMMENT ON COLUMN polarad_report_comments.content_html IS '렌더링된 HTML 코멘트';
