import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

// GET /api/tasks/:taskId/dependencies
router.get('/tasks/:taskId/dependencies', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;

    const [blocking, blockedBy] = await Promise.all([
      // Tasks that depend on this task (this task blocks them)
      query(
        `SELECT td.id, td.dependency_type, td.created_at,
                t.id as task_id, t.title, t.status, t.priority, t.wbs_code
         FROM task_dependencies td
         JOIN tasks t ON td.task_id = t.id
         WHERE td.depends_on_task_id = $1`,
        [taskId]
      ),
      // Tasks this task depends on (blocked by them)
      query(
        `SELECT td.id, td.dependency_type, td.created_at,
                t.id as task_id, t.title, t.status, t.priority, t.wbs_code
         FROM task_dependencies td
         JOIN tasks t ON td.depends_on_task_id = t.id
         WHERE td.task_id = $1`,
        [taskId]
      )
    ]);

    res.json({ blocking: blocking.rows, blockedBy: blockedBy.rows });
  } catch (error) {
    logger.error('Error fetching dependencies:', error);
    res.status(500).json({ error: 'Failed to fetch dependencies' });
  }
});

// GET /api/projects/:projectId/dependencies — all deps in a project (for graph view)
router.get('/projects/:projectId/dependencies', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const result = await query(
      `SELECT td.id, td.dependency_type, td.created_at,
              td.task_id, t1.title as task_title, t1.status as task_status,
              td.depends_on_task_id, t2.title as depends_on_title, t2.status as depends_on_status
       FROM task_dependencies td
       JOIN tasks t1 ON td.task_id = t1.id
       JOIN tasks t2 ON td.depends_on_task_id = t2.id
       WHERE t1.project_id = $1`,
      [projectId]
    );

    res.json({ dependencies: result.rows });
  } catch (error) {
    logger.error('Error fetching project dependencies:', error);
    res.status(500).json({ error: 'Failed to fetch dependencies' });
  }
});

// POST /api/tasks/:taskId/dependencies
router.post('/tasks/:taskId/dependencies', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { depends_on_task_id, dependency_type = 'finish_to_start' } = req.body;
    const userId = req.user!.id;

    if (!depends_on_task_id) {
      return res.status(400).json({ error: 'depends_on_task_id is required' });
    }

    if (taskId === depends_on_task_id) {
      return res.status(400).json({ error: 'A task cannot depend on itself' });
    }

    // Cycle detection: check if depends_on_task_id already depends on taskId (directly or transitively)
    const cycleCheck = await query(
      `WITH RECURSIVE dep_chain AS (
         SELECT task_id, depends_on_task_id FROM task_dependencies WHERE task_id = $1
         UNION ALL
         SELECT td.task_id, td.depends_on_task_id
         FROM task_dependencies td
         INNER JOIN dep_chain dc ON td.task_id = dc.depends_on_task_id
       )
       SELECT 1 FROM dep_chain WHERE depends_on_task_id = $2 LIMIT 1`,
      [depends_on_task_id, taskId]
    );

    if (cycleCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This dependency would create a circular dependency' });
    }

    const result = await query(
      `INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_id, depends_on_task_id) DO NOTHING
       RETURNING *`,
      [taskId, depends_on_task_id, dependency_type, userId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'This dependency already exists' });
    }

    res.status(201).json({ dependency: result.rows[0] });
  } catch (error) {
    logger.error('Error creating dependency:', error);
    res.status(500).json({ error: 'Failed to create dependency' });
  }
});

// DELETE /api/dependencies/:dependencyId
router.delete('/dependencies/:dependencyId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { dependencyId } = req.params;

    const result = await query(
      `DELETE FROM task_dependencies WHERE id = $1 RETURNING *`,
      [dependencyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting dependency:', error);
    res.status(500).json({ error: 'Failed to delete dependency' });
  }
});

export default router;
