-- Migration: 023_sheet_tasks_wbs_enhancement.sql
-- Add WBS hierarchy and Kanban fields to sheet_tasks for better Google Sheets integration

ALTER TABLE sheet_tasks 
ADD COLUMN IF NOT EXISTS wbs_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS parent_task_id UUID,
ADD COLUMN IF NOT EXISTS is_absolute BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS complexity_weight INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Update the existing data if any (optional)
-- UPDATE sheet_tasks SET complexity_weight = 1 WHERE complexity_weight IS NULL;
