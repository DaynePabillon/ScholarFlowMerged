-- Module 2.1: Microsoft 365 / Excel Online Sync
CREATE TABLE IF NOT EXISTS ms365_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  ms_user_id VARCHAR(255),
  ms_user_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS ms365_sync_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  workbook_id VARCHAR(255),
  workbook_name VARCHAR(255),
  worksheet_id VARCHAR(255),
  worksheet_name VARCHAR(255),
  field_mappings JSONB DEFAULT '{}',
  auto_sync_enabled BOOLEAN DEFAULT false,
  sync_interval_minutes INTEGER DEFAULT 60,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_ms365_tokens_user ON ms365_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_ms365_sync_configs_project ON ms365_sync_configs(project_id);
