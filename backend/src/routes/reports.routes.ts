import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

// Creator email - only this user can view reports
const CREATOR_EMAIL = 'waynepabillon667@gmail.com';

/**
 * POST /api/reports
 * Submit a bug report (any authenticated user)
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userEmail = req.user?.email;
        const userName = req.user?.name;

        const { category, title, description, pageUrl } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }

        const validCategories = ['bug', 'feature', 'feedback', 'other'];
        const reportCategory = validCategories.includes(category) ? category : 'bug';

        const result = await query(
            `INSERT INTO bug_reports (user_id, user_email, user_name, category, title, description, page_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
            [userId, userEmail, userName, reportCategory, title, description, pageUrl]
        );

        logger.info(`Bug report submitted by ${userEmail}: ${title}`);

        return res.status(201).json({
            success: true,
            reportId: result.rows[0].id,
            message: 'Thank you for your report! The creator will review it soon.'
        });
    } catch (error) {
        logger.error('Error submitting bug report:', error);
        return res.status(500).json({ error: 'Failed to submit report' });
    }
});

/**
 * GET /api/reports
 * Get all bug reports (ONLY creator can access)
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;

        // Check if user is the creator
        if (userEmail !== CREATOR_EMAIL) {
            logger.warn(`Unauthorized access attempt to reports by ${userEmail}`);
            return res.status(403).json({ error: 'Access denied. Creator only.' });
        }

        const { status, category } = req.query;

        let queryStr = `SELECT * FROM bug_reports`;
        const conditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(status);
        }

        if (category) {
            conditions.push(`category = $${paramIndex++}`);
            values.push(category);
        }

        if (conditions.length > 0) {
            queryStr += ` WHERE ${conditions.join(' AND ')}`;
        }

        queryStr += ` ORDER BY created_at DESC`;

        const result = await query(queryStr, values);

        return res.json({
            reports: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        logger.error('Error fetching bug reports:', error);
        return res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

/**
 * GET /api/reports/stats
 * Get report statistics (ONLY creator can access)
 */
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;

        if (userEmail !== CREATOR_EMAIL) {
            return res.status(403).json({ error: 'Access denied. Creator only.' });
        }

        const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
        COUNT(*) FILTER (WHERE category = 'bug') as bug_count,
        COUNT(*) FILTER (WHERE category = 'feature') as feature_count,
        COUNT(*) FILTER (WHERE category = 'feedback') as feedback_count
      FROM bug_reports
    `);

        return res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error fetching report stats:', error);
        return res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * PATCH /api/reports/:id
 * Update report status (ONLY creator can access)
 */
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;

        if (userEmail !== CREATOR_EMAIL) {
            return res.status(403).json({ error: 'Access denied. Creator only.' });
        }

        const { id } = req.params;
        const { status, creatorNotes } = req.body;

        const updates: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let paramIndex = 1;

        if (status) {
            const validStatuses = ['new', 'reviewed', 'resolved', 'dismissed'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            updates.push(`status = $${paramIndex++}`);
            values.push(status);
        }

        if (creatorNotes !== undefined) {
            updates.push(`creator_notes = $${paramIndex++}`);
            values.push(creatorNotes);
        }

        values.push(id);

        await query(
            `UPDATE bug_reports SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        logger.info(`Bug report ${id} updated by creator`);

        return res.json({ success: true, message: 'Report updated' });
    } catch (error) {
        logger.error('Error updating bug report:', error);
        return res.status(500).json({ error: 'Failed to update report' });
    }
});

/**
 * DELETE /api/reports/:id
 * Delete a report (ONLY creator can access)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;

        if (userEmail !== CREATOR_EMAIL) {
            return res.status(403).json({ error: 'Access denied. Creator only.' });
        }

        const { id } = req.params;

        await query('DELETE FROM bug_reports WHERE id = $1', [id]);

        logger.info(`Bug report ${id} deleted by creator`);

        return res.json({ success: true, message: 'Report deleted' });
    } catch (error) {
        logger.error('Error deleting bug report:', error);
        return res.status(500).json({ error: 'Failed to delete report' });
    }
});

/**
 * GET /api/reports/check-creator
 * Check if current user is the creator (for frontend UI)
 */
router.get('/check-creator', authenticateToken, async (req: AuthRequest, res: Response) => {
    const userEmail = req.user?.email;
    return res.json({ isCreator: userEmail === CREATOR_EMAIL });
});

export default router;
