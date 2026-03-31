-- Migration: 026_fix_sheet_tasks_trigger.sql
-- Separate the progress update trigger for sheet_tasks to prevent Postgres compiling errors with NEW.assigned_to

CREATE OR REPLACE FUNCTION notify_sheet_task_progress_update()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id UUID;
    v_ss_group_id UUID;
    v_team_id UUID;
    v_total_tasks INTEGER := 0;
    v_completed_tasks INTEGER := 0;
    v_progress DECIMAL(5,2);
BEGIN
    -- Get context from the task
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
    v_team_id := COALESCE(NEW.team_id, OLD.team_id);
    
    -- If no team_id on task, try to get it from synced_sheets
    IF v_team_id IS NULL THEN
        SELECT team_id INTO v_team_id FROM synced_sheets WHERE id = COALESCE(NEW.synced_sheet_id, OLD.synced_sheet_id);
    END IF;

    -- 1. Progress for Project-wide ScholarSync mapping
    SELECT ss_group_id INTO v_ss_group_id FROM projects WHERE id = v_project_id;
    
    -- 2. Team Progress Calculation (if team_id exists)
    IF v_team_id IS NOT NULL THEN
        -- Count regular tasks
        SELECT COUNT(*), COUNT(*) FILTER (WHERE LOWER(status) IN ('done', 'completed', 'verified'))
        INTO v_total_tasks, v_completed_tasks
        FROM tasks WHERE team_id = v_team_id AND status != 'archived';
        
        -- Add internal sheet tasks
        DECLARE
            vt_sheet_total INTEGER;
            vt_sheet_done INTEGER;
        BEGIN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE LOWER(status) IN ('done', 'completed', 'verified'))
            INTO vt_sheet_total, vt_sheet_done
            FROM sheet_tasks WHERE team_id = v_team_id;
            
            v_total_tasks := v_total_tasks + vt_sheet_total;
            v_completed_tasks := v_completed_tasks + vt_sheet_done;
        END;

        -- Add checkpoints
        DECLARE
            v_cp_total INTEGER;
            v_cp_done INTEGER;
        BEGIN
            SELECT COUNT(*), COUNT(*) FILTER (WHERE LOWER(status) = 'completed')
            INTO v_cp_total, v_cp_done
            FROM team_checkpoints WHERE team_group_id = v_team_id;
            
            v_total_tasks := v_total_tasks + v_cp_total;
            v_completed_tasks := v_completed_tasks + v_cp_done;
        END;

        -- Calculate and Update
        IF v_total_tasks > 0 THEN
            v_progress := ROUND((v_completed_tasks::DECIMAL / v_total_tasks::DECIMAL) * 100, 2);
        ELSE
            v_progress := 0.00;
        END IF;

        UPDATE team_groups SET progress = v_progress, updated_at = NOW() WHERE id = v_team_id;
    END IF;

    -- 3. ScholarSync Notification (Project-level)
    IF v_ss_group_id IS NOT NULL THEN
        PERFORM pg_notify('progress_update', json_build_object(
            'group_id', v_ss_group_id,
            'project_id', v_project_id,
            'progress', v_progress,
            'timestamp', EXTRACT(EPOCH FROM NOW())
        )::text);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the trigger on sheet_tasks
DROP TRIGGER IF EXISTS sheet_task_progress_update ON sheet_tasks;

CREATE TRIGGER sheet_task_progress_update
AFTER INSERT OR UPDATE OF status OR DELETE ON sheet_tasks
FOR EACH ROW
EXECUTE FUNCTION notify_sheet_task_progress_update();
