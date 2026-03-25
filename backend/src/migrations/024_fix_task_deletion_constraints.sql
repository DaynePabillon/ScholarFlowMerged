-- Migration: 024_fix_task_deletion_constraints.sql
-- Ensures all task-related foreign keys have proper CASCADE behavior for deletion

-- Fix task_followers if it exists without CASCADE
DO $$ 
BEGIN
    -- Drop and recreate task_followers constraint if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'task_followers_task_id_fkey' 
        AND table_name = 'task_followers'
    ) THEN
        ALTER TABLE task_followers DROP CONSTRAINT task_followers_task_id_fkey;
        ALTER TABLE task_followers ADD CONSTRAINT task_followers_task_id_fkey 
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    END IF;

    -- Ensure task_assignees has CASCADE
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'task_assignees_task_id_fkey' 
        AND table_name = 'task_assignees'
    ) THEN
        ALTER TABLE task_assignees DROP CONSTRAINT task_assignees_task_id_fkey;
        ALTER TABLE task_assignees ADD CONSTRAINT task_assignees_task_id_fkey 
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    END IF;

    -- Ensure notifications has CASCADE for task_id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'notifications_task_id_fkey' 
        AND table_name = 'notifications'
    ) THEN
        ALTER TABLE notifications DROP CONSTRAINT notifications_task_id_fkey;
        ALTER TABLE notifications ADD CONSTRAINT notifications_task_id_fkey 
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    END IF;

    -- Ensure task_comments has CASCADE
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'task_comments_task_id_fkey' 
        AND table_name = 'task_comments'
    ) THEN
        ALTER TABLE task_comments DROP CONSTRAINT task_comments_task_id_fkey;
        ALTER TABLE task_comments ADD CONSTRAINT task_comments_task_id_fkey 
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    END IF;

    -- Ensure time_entries has CASCADE
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'time_entries_task_id_fkey' 
        AND table_name = 'time_entries'
    ) THEN
        ALTER TABLE time_entries DROP CONSTRAINT time_entries_task_id_fkey;
        ALTER TABLE time_entries ADD CONSTRAINT time_entries_task_id_fkey 
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add index for better deletion performance
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task ON tasks(parent_task_id);
