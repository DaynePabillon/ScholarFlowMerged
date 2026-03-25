import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

/**
 * Helper: Get user's role in an organization
 */
async function getUserOrgRole(userId: string, orgId: string): Promise<string | null> {
    const result = await query(
        'SELECT role FROM organization_members WHERE user_id = $1 AND organization_id = $2 AND status = $3',
        [userId, orgId, 'active']
    );
    return result.rows[0]?.role || null;
}

// ==================== TEAM GROUPS ====================

/**
 * GET /api/organizations/:orgId/team-groups
 * List teams in an organization — filtered by role:
 *   admin  → ALL teams
 *   manager → only teams they advise (adviser_id or adviser_name match)
 *   member  → all teams (no filtering for now — campus emails ≠ Google accounts)
 */
router.get('/organizations/:orgId/team-groups', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { orgId } = req.params;
        const userId = req.user!.id;

        // Verify membership
        const role = await getUserOrgRole(userId, orgId);
        if (!role) {
            return res.status(403).json({ error: 'Not a member of this organization' });
        }

        let result;

        if (role === 'manager') {
            // Get the manager's name for adviser_name matching
            const userResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
            const userName = userResult.rows[0]?.name || '';

            result = await query(
                `SELECT tg.*,
                  (SELECT COUNT(*) FROM team_group_members WHERE team_group_id = tg.id) as member_count,
                  (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id) + 
                  (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id) + 
                  (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id) as total_checkpoints,
                  (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id AND status = 'completed') + 
                  (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id AND status IN ('completed', 'done', 'Done')) + 
                  (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id AND status IN ('completed', 'done', 'Done')) as completed_checkpoints
           FROM team_groups tg
           WHERE tg.organization_id = $1
             AND (tg.adviser_id = $2 OR LOWER(tg.adviser_name) = LOWER($3))
           ORDER BY tg.team_number ASC`,
                [orgId, userId, userName]
            );
        } else if (role === 'member') {
            // member: see only their own team
            const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
            const userEmail = userResult.rows[0]?.email;
            
            if (userEmail) {
                result = await query(
                    `SELECT tg.*,
                      (SELECT COUNT(*) FROM team_group_members WHERE team_group_id = tg.id) as member_count,
                      (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id) + 
                      (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id) + 
                      (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id) as total_checkpoints,
                      (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id AND status = 'completed') + 
                      (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id AND status IN ('completed', 'done', 'Done')) + 
                      (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id AND status IN ('completed', 'done', 'Done')) as completed_checkpoints
               FROM team_groups tg
               WHERE tg.organization_id = $1
                 AND tg.id IN (
                   SELECT team_group_id FROM team_group_members WHERE email = $2
                 )
               ORDER BY tg.team_number ASC`,
                    [orgId, userEmail]
                );
            } else {
                result = { rows: [] };
            }
        } else {
            // admin: see all teams
            result = await query(
                `SELECT tg.*,
                  (SELECT COUNT(*) FROM team_group_members WHERE team_group_id = tg.id) as member_count,
                  (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id) + 
                  (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id) + 
                  (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id) as total_checkpoints,
                  (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id AND status = 'completed') + 
                  (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id AND status IN ('completed', 'done', 'Done')) + 
                  (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id AND status IN ('completed', 'done', 'Done')) as completed_checkpoints
           FROM team_groups tg
           WHERE tg.organization_id = $1
           ORDER BY tg.team_number ASC`,
                [orgId]
            );
        }

        res.json({ teams: result.rows, userRole: role });
    } catch (error) {
        logger.error('Error fetching team groups:', error);
        res.status(500).json({ error: 'Failed to fetch team groups' });
    }
});

/**
 * GET /api/team-groups/:id
 * Get team detail with members, checkpoints
 */
router.get('/team-groups/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Get team info
        const teamResult = await query('SELECT * FROM team_groups WHERE id = $1', [id]);
        if (teamResult.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const team = teamResult.rows[0];

        // Get members
        const membersResult = await query(
            'SELECT * FROM team_group_members WHERE team_group_id = $1 ORDER BY member_number ASC',
            [id]
        );

        // Get checkpoints (Union of actual checkpoints and granular tasks)
        const checkpointsResult = await query(
            `-- Actual Checkpoints
             SELECT tc.id, tc.title, tc.description, tc.status, tc.due_date, tc.completed_at, 
                    tgm.name as member_name, tc.member_id
             FROM team_checkpoints tc
             LEFT JOIN team_group_members tgm ON tc.member_id = tgm.id
             WHERE tc.team_group_id = $1
             
             UNION ALL
             
             -- Regular Tasks for this team
             SELECT t.id, t.title, t.description, 
                    CASE WHEN t.status IN ('done', 'completed', 'Done') THEN 'completed' 
                         WHEN t.status IN ('in_progress', 'in-progress') THEN 'in_progress'
                         ELSE 'pending' END as status,
                    t.due_date, t.completed_at,
                    COALESCE(tgm.name, u.name) as member_name, tgm.id as member_id
             FROM tasks t
             LEFT JOIN users u ON t.assigned_to = u.id
             LEFT JOIN team_group_members tgm ON (COALESCE(t.assignee_email, u.email) = tgm.email OR t.assigned_to = tgm.user_id) AND tgm.team_group_id = $1
             WHERE t.team_id = $1 OR (t.team_id IS NULL AND tgm.team_group_id = $1)
             
             UNION ALL
             
             -- Sheet Items for this team
             SELECT st.id, st.title, st.description,
                    CASE WHEN st.status IN ('done', 'completed', 'Done') THEN 'completed'
                         WHEN st.status IN ('in_progress', 'in-progress') THEN 'in_progress'
                         ELSE 'pending' END as status,
                    st.due_date, NULL as completed_at,
                    tgm.name as member_name, tgm.id as member_id
             FROM sheet_tasks st
             LEFT JOIN team_group_members tgm ON st.assignee_email = tgm.email AND tgm.team_group_id = $1
             WHERE st.team_id = $1 OR (st.team_id IS NULL AND tgm.team_group_id = $1)
             
             ORDER BY due_date ASC NULLS LAST`,
            [id]
        );

        res.json({
            team,
            members: membersResult.rows,
            checkpoints: checkpointsResult.rows
        });
    } catch (error) {
        logger.error('Error fetching team detail:', error);
        res.status(500).json({ error: 'Failed to fetch team detail' });
    }
});

/**
 * POST /api/organizations/:orgId/team-groups
 * Create a new team (admin only)
 */
router.post('/organizations/:orgId/team-groups', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { orgId } = req.params;
        const userId = req.user!.id;

        const role = await getUserOrgRole(userId, orgId);
        if (role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can create teams' });
        }

        const { team_code, team_number, name, description, adviser_name, members } = req.body;

        if (!team_number || !name) {
            return res.status(400).json({ error: 'team_number and name are required' });
        }

        // Create team group
        const teamResult = await query(
            `INSERT INTO team_groups (organization_id, team_code, team_number, name, description, adviser_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [orgId, team_code || null, team_number, name, description || null, adviser_name || null, userId]
        );

        const team = teamResult.rows[0];

        // Add members if provided
        if (members && Array.isArray(members)) {
            for (const member of members) {
                await query(
                    `INSERT INTO team_group_members (team_group_id, member_number, name, email, student_id, is_leader)
           VALUES ($1, $2, $3, $4, $5, $6)`,
                    [team.id, member.member_number, member.name, member.email || null, member.student_id || null, member.is_leader || false]
                );
            }
        }

        logger.info(`Team group created: ${team.id} by user ${userId}`);
        res.status(201).json(team);
    } catch (error) {
        logger.error('Error creating team group:', error);
        res.status(500).json({ error: 'Failed to create team group' });
    }
});

/**
 * PUT /api/team-groups/:id
 * Update team (admin only)
 */
router.put('/team-groups/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        // Get team to find org
        const teamCheck = await query('SELECT organization_id FROM team_groups WHERE id = $1', [id]);
        if (teamCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const role = await getUserOrgRole(userId, teamCheck.rows[0].organization_id);
        if (role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can update teams' });
        }

        const { team_code, team_number, name, description, adviser_name, status } = req.body;

        const result = await query(
            `UPDATE team_groups
       SET team_code = COALESCE($1, team_code),
           team_number = COALESCE($2, team_number),
           name = COALESCE($3, name),
           description = COALESCE($4, description),
           adviser_name = COALESCE($5, adviser_name),
           status = COALESCE($6, status),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
            [team_code, team_number, name, description, adviser_name, status, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error updating team group:', error);
        res.status(500).json({ error: 'Failed to update team group' });
    }
});

/**
 * DELETE /api/team-groups/:id
 * Delete team (admin only)
 */
router.delete('/team-groups/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const teamCheck = await query('SELECT organization_id FROM team_groups WHERE id = $1', [id]);
        if (teamCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const role = await getUserOrgRole(userId, teamCheck.rows[0].organization_id);
        if (role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete teams' });
        }

        await query('DELETE FROM team_groups WHERE id = $1', [id]);
        logger.info(`Team group deleted: ${id} by user ${userId}`);
        res.json({ message: 'Team deleted successfully' });
    } catch (error) {
        logger.error('Error deleting team group:', error);
        res.status(500).json({ error: 'Failed to delete team group' });
    }
});

// ==================== TEAM MEMBERS ====================

/**
 * POST /api/team-groups/:id/members
 * Add a member (admin, manager)
 */
router.post('/team-groups/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const teamCheck = await query('SELECT organization_id FROM team_groups WHERE id = $1', [id]);
        if (teamCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const role = await getUserOrgRole(userId, teamCheck.rows[0].organization_id);
        if (!role || role === 'member') {
            return res.status(403).json({ error: 'Only admins and managers can add members' });
        }

        const { member_number, name, email, student_id, is_leader } = req.body;

        if (!member_number || !name) {
            return res.status(400).json({ error: 'member_number and name are required' });
        }

        const result = await query(
            `INSERT INTO team_group_members (team_group_id, member_number, name, email, student_id, is_leader)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [id, member_number, name, email || null, student_id || null, is_leader || false]
        );

        // If is_leader, update team's leader_name
        if (is_leader) {
            await query('UPDATE team_groups SET leader_name = $1 WHERE id = $2', [name, id]);
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Error adding team member:', error);
        res.status(500).json({ error: 'Failed to add team member' });
    }
});

/**
 * DELETE /api/team-groups/:teamId/members/:memberId
 * Remove a member (admin, manager)
 */
router.delete('/team-groups/:teamId/members/:memberId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { teamId, memberId } = req.params;
        const userId = req.user!.id;

        const teamCheck = await query('SELECT organization_id FROM team_groups WHERE id = $1', [teamId]);
        if (teamCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const role = await getUserOrgRole(userId, teamCheck.rows[0].organization_id);
        if (!role || role === 'member') {
            return res.status(403).json({ error: 'Only admins and managers can remove members' });
        }

        await query('DELETE FROM team_group_members WHERE id = $1 AND team_group_id = $2', [memberId, teamId]);
        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        logger.error('Error removing team member:', error);
        res.status(500).json({ error: 'Failed to remove team member' });
    }
});

// ==================== CHECKPOINTS ====================

/**
 * POST /api/team-groups/:id/checkpoints
 * Create a checkpoint (manager/admin)
 */
router.post('/team-groups/:id/checkpoints', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const teamCheck = await query('SELECT organization_id FROM team_groups WHERE id = $1', [id]);
        if (teamCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const role = await getUserOrgRole(userId, teamCheck.rows[0].organization_id);
        if (!role || role === 'member') {
            return res.status(403).json({ error: 'Only admins and managers can create checkpoints' });
        }

        const { title, description, due_date, member_id } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'title is required' });
        }

        const result = await query(
            `INSERT INTO team_checkpoints (team_group_id, member_id, title, description, due_date, marked_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [id, member_id || null, title, description || null, due_date || null, userId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Error creating checkpoint:', error);
        res.status(500).json({ error: 'Failed to create checkpoint' });
    }
});

/**
 * PATCH /api/team-checkpoints/:id
 * Update checkpoint status (manager, or member for own)
 */
router.patch('/team-checkpoints/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;
        const { status, title, description } = req.body;

        // Get checkpoint + team info
        const cpResult = await query(
            `SELECT tc.*, tg.organization_id
       FROM team_checkpoints tc
       JOIN team_groups tg ON tc.team_group_id = tg.id
       WHERE tc.id = $1`,
            [id]
        );
        if (cpResult.rows.length === 0) {
            return res.status(404).json({ error: 'Checkpoint not found' });
        }

        const checkpoint = cpResult.rows[0];
        const role = await getUserOrgRole(userId, checkpoint.organization_id);

        // Members can only update status on their own checkpoints
        if (role === 'member') {
            if (checkpoint.member_id) {
                const memberCheck = await query(
                    'SELECT user_id FROM team_group_members WHERE id = $1', [checkpoint.member_id]
                );
                if (memberCheck.rows[0]?.user_id !== userId) {
                    return res.status(403).json({ error: 'Members can only update their own checkpoints' });
                }
            } else {
                return res.status(403).json({ error: 'Members cannot update team-level checkpoints' });
            }
        }

        const completedAt = status === 'completed' ? 'NOW()' : 'NULL';
        const result = await query(
            `UPDATE team_checkpoints
       SET status = COALESCE($1, status),
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
            [status, title, description, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error updating checkpoint:', error);
        res.status(500).json({ error: 'Failed to update checkpoint' });
    }
});

// ==================== TEAM COMMENTS ====================

/**
 * GET /api/team-groups/:id/comments
 * Get team comments
 */
router.get('/team-groups/:id/comments', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT * FROM team_comments WHERE team_group_id = $1 ORDER BY created_at ASC`,
            [id]
        );

        res.json({ comments: result.rows });
    } catch (error) {
        logger.error('Error fetching team comments:', error);
        res.status(500).json({ error: 'Failed to fetch team comments' });
    }
});

/**
 * POST /api/team-groups/:id/comments
 * Add a comment (admin, manager)
 */
router.post('/team-groups/:id/comments', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const teamCheck = await query('SELECT organization_id FROM team_groups WHERE id = $1', [id]);
        if (teamCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const role = await getUserOrgRole(userId, teamCheck.rows[0].organization_id);
        
        // Get user info and check if they're a team member
        const userRes = await query('SELECT name, email FROM users WHERE id = $1', [userId]);
        const userName = userRes.rows[0]?.name || 'Unknown';
        const userEmail = userRes.rows[0]?.email;

        if (role === 'member') {
            const memberCheck = await query(
                'SELECT id FROM team_group_members WHERE team_group_id = $1 AND (user_id = $2 OR email = $3)',
                [id, userId, userEmail]
            );
            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Only team members, admins, and managers can comment' });
            }
        }

        const { content } = req.body;

        const result = await query(
            `INSERT INTO team_comments (team_group_id, user_id, user_name, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [id, userId, userName, content]
        );

        res.status(201).json({ comment: result.rows[0] });
    } catch (error) {
        logger.error('Error adding team comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

export default router;
