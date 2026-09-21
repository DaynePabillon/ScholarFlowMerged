-- Module 2.4: Google Doc / PDF Export report history
CREATE TABLE IF NOT EXISTS report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES users(id),
  report_type VARCHAR(50) NOT NULL,
  format VARCHAR(10) NOT NULL DEFAULT 'pdf',
  title VARCHAR(255) NOT NULL,
  sprint_label VARCHAR(100),
  date_range_start DATE,
  date_range_end DATE,
  google_doc_id VARCHAR(255),
  google_doc_url TEXT,
  pdf_url TEXT,
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (format IN ('pdf', 'google_doc')),
  CHECK (status IN ('pending', 'completed', 'failed')),
  CHECK (report_type IN ('sprint_summary', 'team_performance', 'task_status', 'dependency_report', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_report_history_project ON report_history(project_id);
CREATE INDEX IF NOT EXISTS idx_report_history_org ON report_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_history_created ON report_history(created_at DESC);
