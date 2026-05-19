import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Get time entries for a task
router.get('/tasks/:taskId/time-entries', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;

        const result = await pool.query(
            `SELECT te.*, u.name as user_name
       FROM time_entries te
       LEFT JOIN users u ON te.user_id = u.id
       WHERE te.task_id = $1
       ORDER BY te.date DESC, te.created_at DESC`,
            [taskId]
        );

        // Calculate total hours
        const totalHours = result.rows.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);

        res.json({ timeEntries: result.rows, totalHours });
    } catch (error) {
        console.error('Error fetching time entries:', error);
        res.status(500).json({ error: 'Failed to fetch time entries' });
    }
});

// Log time for a task
router.post('/tasks/:taskId/time-entries', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;
        const { hours, date, notes } = req.body;
        const user = (req as any).user;

        if (!hours || hours <= 0) {
            return res.status(400).json({ error: 'Valid hours are required' });
        }

        const result = await pool.query(
            `INSERT INTO time_entries (task_id, user_id, user_name, hours, date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [taskId, user.id, user.name, hours, date || new Date(), notes || null]
        );

        res.status(201).json({ timeEntry: result.rows[0] });
    } catch (error) {
        console.error('Error logging time:', error);
        res.status(500).json({ error: 'Failed to log time' });
    }
});

// Delete a time entry
router.delete('/time-entries/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        const result = await pool.query(
            `DELETE FROM time_entries WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Time entry not found or not authorized' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting time entry:', error);
        res.status(500).json({ error: 'Failed to delete time entry' });
    }
});

// Get user's time entries for a date range
router.get('/time-entries', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { startDate, endDate } = req.query;

        let query = `
      SELECT te.*, t.title as task_title
      FROM time_entries te
      LEFT JOIN tasks t ON te.task_id = t.id
      WHERE te.user_id = $1
    `;
        const params: any[] = [userId];

        if (startDate) {
            params.push(startDate);
            query += ` AND te.date >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            query += ` AND te.date <= $${params.length}`;
        }

        query += ` ORDER BY te.date DESC, te.created_at DESC`;

        const result = await pool.query(query, params);
        const totalHours = result.rows.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);

        res.json({ timeEntries: result.rows, totalHours });
    } catch (error) {
        console.error('Error fetching user time entries:', error);
        res.status(500).json({ error: 'Failed to fetch time entries' });
    }
});

export default router;
