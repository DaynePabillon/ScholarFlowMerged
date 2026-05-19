-- Migration: 021_progress_sync_trigger.sql
-- PostgreSQL trigger to calculate project progress and notify ScholarSync

-- Function to calculate project progress and send notification
CREATE OR REPLACE FUNCTION notify_progress_update()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id UUID;
    v_ss_group_id UUID;
    v_total_tasks INTEGER;
    v_completed_tasks INTEGER;
    v_progress DECIMAL(5,2);
BEGIN
    -- Get the project_id from the task
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
    
    -- Get the ss_group_id from the project
    SELECT ss_group_id INTO v_ss_group_id
    FROM projects
    WHERE id = v_project_id;
    
    -- Only proceed if this project is linked to a ScholarSync group
    IF v_ss_group_id IS NOT NULL THEN
        -- Count total tasks for this project (exclude archived)
        SELECT COUNT(*) INTO v_total_tasks
        FROM tasks
        WHERE project_id = v_project_id
        AND status != 'archived';
        
        -- Count completed tasks (status = 'done')
        SELECT COUNT(*) INTO v_completed_tasks
        FROM tasks
        WHERE project_id = v_project_id
        AND status = 'done';
        
        -- Calculate progress percentage
        IF v_total_tasks > 0 THEN
            v_progress := ROUND((v_completed_tasks::DECIMAL / v_total_tasks::DECIMAL) * 100, 2);
        ELSE
            v_progress := 0.00;
        END IF;
        
        -- Send notification to ScholarSync via NOTIFY
        PERFORM pg_notify(
            'progress_update',
            json_build_object(
                'group_id', v_ss_group_id,
                'project_id', v_project_id,
                'progress', v_progress,
                'total_tasks', v_total_tasks,
                'completed_tasks', v_completed_tasks,
                'timestamp', EXTRACT(EPOCH FROM NOW())
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tasks table for INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS task_progress_update ON tasks;

CREATE TRIGGER task_progress_update
AFTER INSERT OR UPDATE OF status OR DELETE ON tasks
FOR EACH ROW
EXECUTE FUNCTION notify_progress_update();

COMMENT ON FUNCTION notify_progress_update() IS 'Calculates project progress and notifies ScholarSync via pg_notify';
COMMENT ON TRIGGER task_progress_update ON tasks IS 'Triggers progress calculation when task status changes';
