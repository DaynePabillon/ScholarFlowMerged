-- Migration: 025_add_progress_to_sheet_tasks.sql
-- Add progress tracking to sheet tasks for hierarchical auto-calculation

ALTER TABLE sheet_tasks 
ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100);

-- Also add it to regular tasks if missing (ensuring consistency)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100);
