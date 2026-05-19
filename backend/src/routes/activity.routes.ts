import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth.middleware';
import activityService from '../services/activity.service';

const router = Router();

// Get activity feed for organization
router.get('/organizations/:orgId/activity', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { orgId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        const activities = await activityService.getActivityFeed(orgId, limit);

        res.json({ activities });
    } catch (error) {
        console.error('Error fetching activity feed:', error);
        res.status(500).json({ error: 'Failed to fetch activity feed' });
    }
});

// Get activity for a specific task (for task timeline)
router.get('/tasks/:taskId/activity', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        // Get task info with creator and assignee details
        const taskResult = await pool.query(
            `SELECT t.*, 
                    creator.name as creator_name, creator.email as creator_email,
                    assignee.name as assignee_name, assignee.email as assignee_email
             FROM tasks t
             LEFT JOIN users creator ON t.created_by = creator.id
             LEFT JOIN users assignee ON t.assigned_to = assignee.id
             WHERE t.id = $1`,
            [taskId]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskResult.rows[0];

        // Get activity logs for this task
        const activityResult = await pool.query(
            `SELECT * FROM activity_log 
             WHERE entity_type = 'task' AND entity_id = $1 
             ORDER BY created_at ASC 
             LIMIT $2`,
            [taskId, limit]
        );

        // Get comments for this task
        const commentsResult = await pool.query(
            `SELECT c.*, u.name as user_name, u.email as user_email
             FROM task_comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.task_id = $1
             ORDER BY c.created_at ASC`,
            [taskId]
        );

        res.json({
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                due_date: task.due_date,
                created_at: task.created_at,
                creator_name: task.creator_name,
                creator_email: task.creator_email,
                assignee_name: task.assignee_name,
                assignee_email: task.assignee_email
            },
            activities: activityResult.rows,
            comments: commentsResult.rows
        });
    } catch (error) {
        console.error('Error fetching task activity:', error);
        res.status(500).json({ error: 'Failed to fetch task activity' });
    }
});

export default router;

