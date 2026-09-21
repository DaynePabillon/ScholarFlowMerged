-- Module 1.3: Manual Sync Rate-Limiter logs
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  synced_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (status IN ('success', 'failed', 'rate_limited', 'in_progress'))
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_project ON sync_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_org ON sync_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at DESC);

-- Module 1.2: Conflict Resolution logs
CREATE TABLE IF NOT EXISTS conflict_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  sheet_value TEXT,
  kanban_value TEXT,
  merged_value TEXT,
  resolution VARCHAR(20) NOT NULL,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (resolution IN ('keep_sheet', 'keep_kanban', 'merged'))
);

CREATE INDEX IF NOT EXISTS idx_conflict_logs_task ON conflict_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_conflict_logs_project ON conflict_logs(project_id);
