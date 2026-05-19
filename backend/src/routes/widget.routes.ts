import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Get widgets for an organization
router.get('/organizations/:orgId/widgets', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { orgId } = req.params;

        const result = await pool.query(
            `SELECT * FROM board_widgets 
       WHERE organization_id = $1 
       ORDER BY position ASC, created_at ASC`,
            [orgId]
        );

        res.json({ widgets: result.rows });
    } catch (error) {
        console.error('Error fetching widgets:', error);
        res.status(500).json({ error: 'Failed to fetch widgets' });
    }
});

// Add a widget
router.post('/organizations/:orgId/widgets', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { orgId } = req.params;
        const { widget_type, title, config } = req.body;
        const userId = (req as any).user.id;

        if (!widget_type) {
            return res.status(400).json({ error: 'Widget type is required' });
        }

        // Get next position
        const posResult = await pool.query(
            `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM board_widgets WHERE organization_id = $1`,
            [orgId]
        );
        const position = posResult.rows[0].next_pos;

        const result = await pool.query(
            `INSERT INTO board_widgets (organization_id, widget_type, title, config, position, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [orgId, widget_type, title || getDefaultTitle(widget_type), config || {}, position, userId]
        );

        res.status(201).json({ widget: result.rows[0] });
    } catch (error) {
        console.error('Error creating widget:', error);
        res.status(500).json({ error: 'Failed to create widget' });
    }
});

// Update widget config
router.patch('/widgets/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, config, position } = req.body;

        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (title !== undefined) {
            updates.push(`title = $${paramCount++}`);
            values.push(title);
        }
        if (config !== undefined) {
            updates.push(`config = $${paramCount++}`);
            values.push(JSON.stringify(config));
        }
        if (position !== undefined) {
            updates.push(`position = $${paramCount++}`);
            values.push(position);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE board_widgets SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Widget not found' });
        }

        res.json({ widget: result.rows[0] });
    } catch (error) {
        console.error('Error updating widget:', error);
        res.status(500).json({ error: 'Failed to update widget' });
    }
});

// Delete a widget
router.delete('/widgets/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM board_widgets WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Widget not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting widget:', error);
        res.status(500).json({ error: 'Failed to delete widget' });
    }
});

function getDefaultTitle(widgetType: string): string {
    const titles: Record<string, string> = {
        'pie_status': 'Tasks by Status',
        'bar_assignee': 'Tasks by Team Member',
        'line_timeline': 'Tasks Over Time',
        'number_summary': 'Summary',
        'pie_priority': 'Tasks by Priority',
        'bar_workload': 'Team Workload'
    };
    return titles[widgetType] || 'Chart Widget';
}

export default router;
