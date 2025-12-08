-- 리포트 테이블 (RLS 없이 간단 버전)

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
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  summary_data JSONB,
  ai_insights JSONB,
  ai_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255),
  CONSTRAINT unique_report UNIQUE (client_id, report_type, period_start, period_end)
);

-- 관리자 코멘트 테이블
CREATE TABLE IF NOT EXISTS polarad_report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES polarad_reports(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_html TEXT,
  author_name VARCHAR(100) DEFAULT '폴라애드 광고운영팀',
  author_role VARCHAR(100),
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_comment_per_report UNIQUE (report_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reports_client_id ON polarad_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON polarad_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_period ON polarad_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_reports_status ON polarad_reports(status);
CREATE INDEX IF NOT EXISTS idx_report_comments_report_id ON polarad_report_comments(report_id);
