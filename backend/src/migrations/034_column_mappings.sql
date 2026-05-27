-- Module 1.1: Interactive Column Mapping
CREATE TABLE IF NOT EXISTS column_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_sheet_id UUID REFERENCES synced_sheets(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  sheet_column VARCHAR(255) NOT NULL,
  kanban_column VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (synced_sheet_id, sheet_column)
);

CREATE INDEX IF NOT EXISTS idx_column_mappings_sheet ON column_mappings(synced_sheet_id);
CREATE INDEX IF NOT EXISTS idx_column_mappings_project ON column_mappings(project_id);
