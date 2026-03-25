-- Migration: 029_add_luxury_weight_to_tasks.sql
-- Add luxury_weight column to both tasks and sheet_tasks for column alignment in UNION queries

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS luxury_weight INTEGER DEFAULT 1;
ALTER TABLE sheet_tasks ADD COLUMN IF NOT EXISTS luxury_weight INTEGER DEFAULT 1;

-- Update existing records to have a default value
UPDATE tasks SET luxury_weight = 1 WHERE luxury_weight IS NULL;
UPDATE sheet_tasks SET luxury_weight = 1 WHERE luxury_weight IS NULL;
