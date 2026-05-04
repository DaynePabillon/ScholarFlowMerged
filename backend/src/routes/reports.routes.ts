import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';
import { sseService } from '../services/sse.service';

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

/**
 * GET /api/reports/users
 * Get all organization members with user names/emails (Creator only)
 */
router.get('/users', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;
        if (userEmail !== CREATOR_EMAIL) return res.status(403).json({ error: 'Access denied' });

        const result = await query(`
            SELECT 
                om.id as member_id,
                u.name as user_name,
                u.email as user_email,
                o.name as org_name,
                om.role,
                om.status
            FROM organization_members om
            JOIN users u ON om.user_id = u.id
            JOIN organizations o ON om.organization_id = o.id
            ORDER BY o.name ASC, u.name ASC
        `);
        return res.json({ members: result.rows });
    } catch (error) {
        logger.error('Error fetching org members for creator:', error);
        return res.status(500).json({ error: 'Failed to fetch members' });
    }
});

/**
 * PATCH /api/reports/users/:memberId/role
 * Update an organization member's role directly (Creator only)
 * This automatically triggers the sync to ss_account.
 */
router.patch('/users/:memberId/role', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;
        if (userEmail !== CREATOR_EMAIL) return res.status(403).json({ error: 'Access denied' });

        const { memberId } = req.params;
        const { role } = req.body;
        
        if (!['admin', 'manager', 'member'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        await query('UPDATE organization_members SET role = $1 WHERE id = $2', [role, memberId]);
        
        return res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
        logger.error('Error updating member role for creator:', error);
        return res.status(500).json({ error: 'Failed to update role' });
    }
});

// ── ANNOUNCEMENTS ──────────────────────────────────────────────────────────────

/**
 * GET /api/reports/announcement
 * Returns the currently active announcement (any authenticated user)
 */
router.get('/announcement', authenticateToken, async (_req: AuthRequest, res: Response) => {
    try {
        const result = await query(
            `SELECT * FROM announcements
             WHERE is_active = true
               AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY created_at DESC
             LIMIT 1`
        );
        return res.json({ announcement: result.rows[0] || null });
    } catch (error) {
        logger.error('Error fetching announcement:', error);
        return res.status(500).json({ error: 'Failed to fetch announcement' });
    }
});

/**
 * GET /api/reports/announcements/all
 * Returns all announcements (creator only)
 */
router.get('/announcements/all', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;
        if (userEmail !== CREATOR_EMAIL) return res.status(403).json({ error: 'Access denied' });

        const result = await query(`SELECT * FROM announcements ORDER BY created_at DESC`);
        return res.json({ announcements: result.rows });
    } catch (error) {
        logger.error('Error fetching all announcements:', error);
        return res.status(500).json({ error: 'Failed to fetch announcements' });
    }
});

/**
 * POST /api/reports/announcements
 * Create a new announcement (creator only)
 */
router.post('/announcements', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;
        if (userEmail !== CREATOR_EMAIL) return res.status(403).json({ error: 'Access denied' });

        const { message, type, expires_at } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const validTypes = ['info', 'warning', 'success', 'maintenance'];
        const announcementType = validTypes.includes(type) ? type : 'info';

        // Deactivate all existing active announcements first (only one active at a time)
        await query(`UPDATE announcements SET is_active = false`);

        const result = await query(
            `INSERT INTO announcements (message, type, is_active, expires_at, created_by)
             VALUES ($1, $2, true, $3, $4) RETURNING *`,
            [message, announcementType, expires_at || null, userEmail]
        );

        logger.info(`Announcement created by ${userEmail}: ${message.slice(0, 60)}`);
        sseService.broadcastAnnouncement(result.rows[0]);
        return res.status(201).json({ announcement: result.rows[0] });
    } catch (error) {
        logger.error('Error creating announcement:', error);
        return res.status(500).json({ error: 'Failed to create announcement' });
    }
});

/**
 * PATCH /api/reports/announcements/:id
 * Update / toggle active status (creator only)
 */
router.patch('/announcements/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;
        if (userEmail !== CREATOR_EMAIL) return res.status(403).json({ error: 'Access denied' });

        const { id } = req.params;
        const { message, type, is_active, expires_at } = req.body;

        const updates: string[] = [];
        const values: any[] = [];
        let i = 1;

        if (message !== undefined) { updates.push(`message = $${i++}`); values.push(message); }
        if (type !== undefined)    { updates.push(`type = $${i++}`);    values.push(type); }
        if (is_active !== undefined) {
            // If activating this one, deactivate all others first
            if (is_active) await query(`UPDATE announcements SET is_active = false`);
            updates.push(`is_active = $${i++}`);
            values.push(is_active);
        }
        if (expires_at !== undefined) { updates.push(`expires_at = $${i++}`); values.push(expires_at || null); }
        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await query(
            `UPDATE announcements SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
            values
        );
        if (!result.rows[0]) return res.status(404).json({ error: 'Announcement not found' });

        if (result.rows[0].is_active) {
            sseService.broadcastAnnouncement(result.rows[0]);
        } else {
            sseService.broadcastAnnouncement(null);
        }
        return res.json({ announcement: result.rows[0] });
    } catch (error) {
        logger.error('Error updating announcement:', error);
        return res.status(500).json({ error: 'Failed to update announcement' });
    }
});

/**
 * DELETE /api/reports/announcements/:id
 * Delete an announcement (creator only)
 */
router.delete('/announcements/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;
        if (userEmail !== CREATOR_EMAIL) return res.status(403).json({ error: 'Access denied' });

        await query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
        return res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting announcement:', error);
        return res.status(500).json({ error: 'Failed to delete announcement' });
    }
});

export default router;
