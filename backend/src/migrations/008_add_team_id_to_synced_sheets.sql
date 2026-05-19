-- Migration: 008_fix_synced_sheets_constraints.sql
-- Ensures each team has a unique sheet mapping

-- Add index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_synced_sheets_team ON synced_sheets(team_id);

-- Update unique constraint to allow one sheet per team 
-- This allows different teams to have different sheets, but one team can't have multiple sheets linked 
-- and the same sheet can't be linked to multiple teams (unless using different team_ids)
ALTER TABLE synced_sheets 
DROP CONSTRAINT IF EXISTS synced_sheets_workspace_id_sheet_id_key;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'synced_sheets_team_sheet_unique') THEN
        ALTER TABLE synced_sheets ADD CONSTRAINT synced_sheets_team_sheet_unique UNIQUE(team_id, sheet_id);
    END IF;
END $$;
