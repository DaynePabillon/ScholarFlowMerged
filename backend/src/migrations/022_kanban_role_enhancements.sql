-- Batch 1: Kanban & Role Enhancements
-- Adds support for Absolute Tasks, WBS Hierarchy, and Multi-Assignees

-- 1. Update tasks table with new columns
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_absolute BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS complexity_weight INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS wbs_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;

-- 2. Update status constraint to include 'on_hold'
-- First, drop the existing constraint if possible (we need to know its name, usually tasks_status_check)
-- Since we might not know the exact name, we'll try to add it and catch errors or better, just alter the type if it was an enum, but here it's a CHECK constraint.
DO $$ 
BEGIN 
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'in_progress', 'review', 'completed', 'blocked', 'on_hold'));
END $$;

-- 3. Create task_assignees table for multiple assignees per task
CREATE TABLE IF NOT EXISTS task_assignees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, user_id)
);

-- 4. Create index for task_assignees
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);
