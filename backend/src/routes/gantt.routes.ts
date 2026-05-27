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
    const { sprint, assignee, priority } = req.query;

    let whereClause = 'WHERE t.project_id = $1';
    const params: any[] = [projectId];
    let paramCount = 1;

    if (sprint) {
      paramCount++;
      whereClause += ` AND t.sprint_label = $${paramCount}`;
      params.push(sprint);
    }
    if (assignee) {
      paramCount++;
      whereClause += ` AND $${paramCount} = ANY(t.assigned_to_ids)`;
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
                t.start_date, t.due_date, t.progress, t.estimated_hours,
                t.assigned_to_ids, t.parent_task_id,
                array_agg(DISTINCT u.name) FILTER (WHERE u.id IS NOT NULL) as assignee_names
         FROM tasks t
         LEFT JOIN users u ON u.id = ANY(t.assigned_to_ids)
         ${whereClause}
         GROUP BY t.id
         ORDER BY t.wbs_code NULLS LAST, t.created_at`,
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
