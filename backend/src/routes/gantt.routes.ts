import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

// GET /api/projects/:projectId/gantt
// Returns all tasks with dates and dependencies for Gantt chart rendering
router.get('/projects/:projectId/gantt', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { assignee, priority } = req.query;

    let whereClause = 'WHERE t.project_id = $1';
    const params: any[] = [projectId];
    let paramCount = 1;

    if (assignee) {
      paramCount++;
      whereClause += ` AND t.assigned_to = $${paramCount}`;
      params.push(assignee);
    }
    if (priority) {
      paramCount++;
      whereClause += ` AND t.priority = $${paramCount}`;
      params.push(priority);
    }

    const [tasksResult, depsResult, membersResult] = await Promise.all([
      query(
        `SELECT t.id, t.title, t.status, t.priority, t.wbs_code,
                t.start_date, t.due_date,
                COALESCE(t.progress_percent, 0) AS progress,
                t.estimated_hours, t.assigned_to, t.parent_task_id,
                ARRAY_REMOVE(ARRAY[u.name], NULL) AS assignee_names
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assigned_to
         ${whereClause}
         ORDER BY
           -- Sort WBS codes numerically (handles 1,2,...9,10 correctly instead of 1,10,2,3)
           CASE WHEN t.wbs_code ~ '^\d+$' THEN t.wbs_code::integer ELSE NULL END NULLS LAST,
           t.wbs_code NULLS LAST,
           t.created_at`,
        params
      ),
      query(
        `SELECT td.task_id, td.depends_on_task_id, td.dependency_type
         FROM task_dependencies td
         JOIN tasks t ON td.task_id = t.id
         WHERE t.project_id = $1`,
        [projectId]
      ),
      query(
        `SELECT u.id, u.name
         FROM project_members pm
         JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = $1`,
        [projectId]
      )
    ]);

    res.json({
      tasks: tasksResult.rows,
      dependencies: depsResult.rows,
      members: membersResult.rows
    });
  } catch (error) {
    logger.error('Error fetching gantt data:', error);
    res.status(500).json({ error: 'Failed to fetch Gantt data' });
  }
});

export default router;
