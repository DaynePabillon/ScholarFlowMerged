-- Migration: 032_ss_group_course_scope.sql
-- Adds course_id to ss_group so groups with the same name in different courses do not collide.

DO $$
BEGIN
    -- Add course_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ss_group' AND column_name = 'course_id'
    ) THEN
        ALTER TABLE public.ss_group ADD COLUMN course_id INTEGER REFERENCES ss_courses(id) ON DELETE SET NULL;
    END IF;

    -- Drop the old unique constraint on groupName alone (if it exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'ss_group' AND constraint_name = 'ss_group_groupName_key'
    ) THEN
        ALTER TABLE public.ss_group DROP CONSTRAINT "ss_group_groupName_key";
    END IF;

    -- Add new unique constraint scoped to (groupName, course_id)
    -- Use a partial index so NULLs in course_id don't break uniqueness for legacy rows
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'ss_group' AND indexname = 'ss_group_groupname_courseid_key'
    ) THEN
        CREATE UNIQUE INDEX ss_group_groupname_courseid_key
            ON public.ss_group ("groupName", course_id)
            WHERE course_id IS NOT NULL;
    END IF;
END $$;
