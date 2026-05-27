import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

// GET /api/conflicts?project_id= — get open conflicts for a project
router.get('/conflicts', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    // Detect conflicts: tasks where synced sheet value differs from Kanban value
    // We compare sheet_tasks status to tasks status for tasks linked by title match
    const result = await query(
      `SELECT t.id as task_id, t.title, t.status as kanban_status, t.due_date as kanban_due_date,
              st.status as sheet_status, st.due_date as sheet_due_date,
              st.id as sheet_task_id
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       JOIN synced_sheets ss ON ss.project_id = p.id
       JOIN sheet_tasks st ON st.synced_sheet_id = ss.id AND LOWER(st.title) = LOWER(t.title)
       WHERE t.project_id = $1
         AND (t.status <> st.status OR t.due_date::date IS DISTINCT FROM st.due_date::date)`,
      [project_id]
    );

    res.json({ conflicts: result.rows });
  } catch (error) {
    logger.error('Error detecting conflicts:', error);
    res.status(500).json({ error: 'Failed to detect conflicts' });
  }
});

// GET /api/conflicts/log?project_id= — past resolutions
router.get('/conflicts/log', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const result = await query(
      `SELECT cl.*, u.name as resolved_by_name, t.title as task_title
       FROM conflict_logs cl
       LEFT JOIN users u ON cl.resolved_by = u.id
       LEFT JOIN tasks t ON cl.task_id = t.id
       WHERE cl.project_id = $1
       ORDER BY cl.resolved_at DESC
       LIMIT 100`,
      [project_id]
    );

    res.json({ log: result.rows });
  } catch (error) {
    logger.error('Error fetching conflict log:', error);
    res.status(500).json({ error: 'Failed to fetch conflict log' });
  }
});

// POST /api/conflicts/resolve — apply resolution for one conflict field
router.post('/conflicts/resolve', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { task_id, project_id, field_name, resolution, sheet_value, kanban_value, merged_value } = req.body;
    const userId = req.user!.id;

    if (!task_id || !field_name || !resolution) {
      return res.status(400).json({ error: 'task_id, field_name, and resolution are required' });
    }

    const validResolutions = ['keep_sheet', 'keep_kanban', 'merged'];
    if (!validResolutions.includes(resolution)) {
      return res.status(400).json({ error: `resolution must be one of: ${validResolutions.join(', ')}` });
    }

    // Apply the resolution to the task
    let appliedValue = resolution === 'keep_sheet' ? sheet_value
      : resolution === 'keep_kanban' ? kanban_value
      : merged_value;

    if (field_name === 'status' && appliedValue) {
      await query(`UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2`, [appliedValue, task_id]);
    } else if (field_name === 'due_date' && appliedValue) {
      await query(`UPDATE tasks SET due_date = $1, updated_at = NOW() WHERE id = $2`, [appliedValue, task_id]);
    }

    // Log the resolution
    await query(
      `INSERT INTO conflict_logs (task_id, project_id, field_name, sheet_value, kanban_value, merged_value, resolution, resolved_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [task_id, project_id, field_name, sheet_value, kanban_value, merged_value || null, resolution, userId]
    );

    res.json({ success: true, applied_value: appliedValue });
  } catch (error) {
    logger.error('Error resolving conflict:', error);
    res.status(500).json({ error: 'Failed to resolve conflict' });
  }
});

export default router;
