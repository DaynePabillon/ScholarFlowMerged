-- Migration: 020_add_progress_to_team_groups.sql
-- Add progress tracking column to team_groups table

ALTER TABLE team_groups 
ADD COLUMN IF NOT EXISTS progress DECIMAL(5,2) DEFAULT 0.00 CHECK (progress >= 0 AND progress <= 100);

COMMENT ON COLUMN team_groups.progress IS 'Overall task completion percentage (0-100) synced from SkyFlow';
