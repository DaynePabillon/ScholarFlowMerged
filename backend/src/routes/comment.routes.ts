import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth.middleware';
import activityService from '../services/activity.service';
import notificationService from '../services/notification.service';

const router = Router();

// Get comments for a task
router.get('/tasks/:taskId/comments', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;

        const result = await pool.query(
            `SELECT c.id, c.task_id, c.user_id, c.comment, c.created_at, c.updated_at,
                    u.name as user_name, u.email as user_email
       FROM task_comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
            [taskId]
        );

        res.json({ comments: result.rows });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Add comment to a task (supports both regular tasks and synced sheet_tasks)
router.post('/tasks/:taskId/comments', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;
        const commentText = req.body.comment || req.body.content; // Accept both for compatibility
        const user = (req as any).user;

        console.log('>>>COMMENT DEBUG<<< body:', JSON.stringify(req.body));
        console.log('>>>COMMENT DEBUG<<< commentText:', commentText);
        console.log('>>>COMMENT DEBUG<<< taskId:', taskId);

        if (!commentText || !commentText.trim()) {
            console.log('>>>COMMENT DEBUG<<< FAILING: comment is empty or missing');
            return res.status(400).json({ error: 'Comment content is required' });
        }

        // Try to get task from regular tasks table first
        let taskResult = await pool.query(
            `SELECT t.*, p.organization_id as org_id, 'app' as source_type
             FROM tasks t 
             LEFT JOIN projects p ON t.project_id = p.id 
             WHERE t.id = $1`,
            [taskId]
        );

        // If not found in tasks, check sheet_tasks
        if (taskResult.rows.length === 0) {
            taskResult = await pool.query(
                `SELECT st.*, w.organization_id as org_id, 'sheet' as source_type
                 FROM sheet_tasks st
                 JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
                 JOIN workspaces w ON ss.workspace_id = w.id
                 WHERE st.id = $1`,
                [taskId]
            );
        }

        if (taskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskResult.rows[0];

        // Insert comment
        const result = await pool.query(
            `INSERT INTO task_comments (task_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [taskId, user.id, commentText.trim()]
        );

        // Log activity
        await activityService.log({
            organization_id: task.org_id,
            user_id: user.id,
            user_name: user.name,
            action: 'commented',
            entity_type: 'task',
            entity_id: taskId,
            entity_name: task.title
        });

        // Notify task assignee if different from commenter (only for regular tasks with UUID assignee)
        if (task.source_type === 'app' && task.assigned_to && task.assigned_to !== user.id) {
            await notificationService.notifyNewComment(taskId, task.title, task.assigned_to, user.name);
        }

        res.status(201).json({ comment: result.rows[0] });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Delete a comment
router.delete('/comments/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        // Only allow deleting own comments
        const result = await pool.query(
            `DELETE FROM task_comments WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found or not authorized' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

export default router;
