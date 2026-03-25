-- Migration: 007_workspace_sync.sql
-- Google Workspace Live Sync Tables

-- Workspaces: Connected Google Drive folders
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    root_folder_id VARCHAR(255) NOT NULL,  -- Google Drive folder ID
    root_folder_name VARCHAR(255),
    sync_status VARCHAR(20) DEFAULT 'active' CHECK (sync_status IN ('active', 'paused', 'error', 'syncing')),
    last_synced_at TIMESTAMP,
    sync_error TEXT,
    drive_channel_id VARCHAR(255),         -- For push notifications
    drive_channel_expiration TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, root_folder_id)
);

-- Synced Sheets: Google Sheets connected as data sources
CREATE TABLE IF NOT EXISTS synced_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    sheet_id VARCHAR(255) NOT NULL,         -- Google Sheet ID
    sheet_name VARCHAR(255) NOT NULL,
    sheet_type VARCHAR(50) DEFAULT 'tasks' CHECK (sheet_type IN ('tasks', 'members', 'custom')),
    
    -- Column mapping (JSON: {title: 0, status: 1, priority: 2, assignee: 3, dueDate: 4})
    column_mapping JSONB DEFAULT '{}',
    
    -- Link to project (optional - auto-detected from folder)
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    
    sync_status VARCHAR(20) DEFAULT 'active',
    last_synced_at TIMESTAMP,
    row_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, sheet_id)
);

-- Sheet Tasks: Tasks synced from Google Sheets
CREATE TABLE IF NOT EXISTS sheet_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    synced_sheet_id UUID REFERENCES synced_sheets(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    
    -- Row tracking for sync
    sheet_row_index INTEGER NOT NULL,       -- Row number in sheet (1-indexed, excluding header)
    
    -- Task data from sheet
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo',
    priority VARCHAR(20) DEFAULT 'medium',
    assignee_email VARCHAR(255),
    due_date TIMESTAMP,
    
    -- Extra columns stored as JSON
    extra_data JSONB DEFAULT '{}',
    
    -- Sync metadata
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sheet_updated_at TIMESTAMP,             -- When row was last modified in sheet
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(synced_sheet_id, sheet_row_index)
);

-- Sync logs for debugging
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,        -- 'sync_started', 'sync_completed', 'sync_error', 'sheet_changed'
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_synced_sheets_workspace ON synced_sheets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sheet_tasks_sheet ON sheet_tasks(synced_sheet_id);
CREATE INDEX IF NOT EXISTS idx_sheet_tasks_project ON sheet_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_sheet_tasks_assignee ON sheet_tasks(assignee_email);
CREATE INDEX IF NOT EXISTS idx_sync_logs_workspace ON sync_logs(workspace_id, created_at DESC);
