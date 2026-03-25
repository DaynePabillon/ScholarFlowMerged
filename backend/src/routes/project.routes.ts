import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      organization_id,
      name,
      description,
      status,
      priority,
      start_date,
      end_date,
      budget,
    } = req.body;
    const userId = req.user!.id;

    if (!organization_id || !name) {
      return res.status(400).json({ error: 'Organization ID and name are required' });
    }

    // Check if user is manager or admin
    const roleCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = $3',
      [organization_id, userId, 'active']
    );

    if (roleCheck.rows.length === 0 || !['admin', 'manager'].includes(roleCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Manager or admin access required' });
    }

    // Create project
    const result = await query(
      `INSERT INTO projects (
        organization_id, name, description, status, priority,
        start_date, end_date, budget, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [organization_id, name, description, status || 'planning', priority || 'medium',
        start_date, end_date, budget, userId]
    );

    // Add creator as project lead
    await query(
      'INSERT INTO project_members (project_id, user_id, role, assigned_by) VALUES ($1, $2, $3, $4)',
      [result.rows[0].id, userId, 'lead', userId]
    );

    logger.info(`Project created: ${result.rows[0].id} by user ${userId}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * GET /api/projects
 * Get projects for user's organizations
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { organization_id, status } = req.query;

    let queryText = `
      SELECT DISTINCT p.*, 
             o.name as organization_name,
             u.name as created_by_name,
             pm.role as user_role
      FROM projects p
      INNER JOIN organizations o ON p.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
      WHERE om.user_id = $1 AND om.status = 'active'
    `;

    const params: any[] = [userId];

    if (organization_id) {
      queryText += ` AND p.organization_id = $${params.length + 1}`;
      params.push(organization_id);
    }

    if (status) {
      queryText += ` AND p.status = $${params.length + 1}`;
      params.push(status);
    }

    queryText += ' ORDER BY p.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/projects/:id
 * Get project details
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if user has access
    const accessCheck = await query(
      `SELECT 1 FROM projects p
       INNER JOIN organization_members om ON p.organization_id = om.organization_id
       WHERE p.id = $1 AND om.user_id = $2 AND om.status = $3`,
      [id, userId, 'active']
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get project details
    const projectResult = await query(
      `SELECT p.*, o.name as organization_name, u.name as created_by_name
       FROM projects p
       INNER JOIN organizations o ON p.organization_id = o.id
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get task counts by status
    const taskStats = await query(
      `SELECT status, COUNT(*) as count
       FROM tasks
       WHERE project_id = $1
       GROUP BY status`,
      [id]
    );

    // Get member count
    const memberCount = await query(
      'SELECT COUNT(*) FROM project_members WHERE project_id = $1',
      [id]
    );

    const project = {
      ...projectResult.rows[0],
      taskStats: taskStats.rows,
      memberCount: parseInt(memberCount.rows[0].count),
    };

    res.json(project);
  } catch (error) {
    logger.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * PUT /api/projects/:id
 * Update project
 */
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { name, description, status, priority, start_date, end_date, budget } = req.body;

    // Check if user is project lead or org admin/manager
    const roleCheck = await query(
      `SELECT pm.role as project_role, om.role as org_role
       FROM projects p
       INNER JOIN organization_members om ON p.organization_id = om.organization_id
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1 AND om.user_id = $2 AND om.status = $3`,
      [id, userId, 'active']
    );

    if (roleCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { project_role, org_role } = roleCheck.rows[0];
    if (project_role !== 'lead' && !['admin', 'manager'].includes(org_role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const result = await query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           priority = COALESCE($4, priority),
           start_date = COALESCE($5, start_date),
           end_date = COALESCE($6, end_date),
           budget = COALESCE($7, budget)
       WHERE id = $8
       RETURNING *`,
      [name, description, status, priority, start_date, end_date, budget, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project (admin only)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if user is org admin
    const roleCheck = await query(
      `SELECT om.role
       FROM projects p
       INNER JOIN organization_members om ON p.organization_id = om.organization_id
       WHERE p.id = $1 AND om.user_id = $2`,
      [id, userId]
    );

    if (roleCheck.rows.length === 0 || roleCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await query('DELETE FROM projects WHERE id = $1', [id]);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/**
 * GET /api/projects/:id/members
 * Get project members
 */
router.get('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check access
    const accessCheck = await query(
      `SELECT 1 FROM projects p
       INNER JOIN organization_members om ON p.organization_id = om.organization_id
       WHERE p.id = $1 AND om.user_id = $2 AND om.status = $3`,
      [id, userId, 'active']
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      `SELECT u.id, u.name, u.email, u.profile_picture,
              pm.role, pm.assigned_at
       FROM project_members pm
       INNER JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.assigned_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching project members:', error);
    res.status(500).json({ error: 'Failed to fetch project members' });
  }
});

/**
 * POST /api/projects/:id/members
 * Add member to project
 */
router.post('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.body;
    const currentUserId = req.user!.id;

    if (!user_id || !role) {
      return res.status(400).json({ error: 'User ID and role are required' });
    }

    // Check if current user is project lead or org admin/manager
    const roleCheck = await query(
      `SELECT pm.role as project_role, om.role as org_role
       FROM projects p
       INNER JOIN organization_members om ON p.organization_id = om.organization_id
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1 AND om.user_id = $2 AND om.status = $3`,
      [id, currentUserId, 'active']
    );

    if (roleCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { project_role, org_role } = roleCheck.rows[0];
    if (project_role !== 'lead' && !['admin', 'manager'].includes(org_role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Add member
    const result = await query(
      `INSERT INTO project_members (project_id, user_id, role, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3
       RETURNING *`,
      [id, user_id, role, currentUserId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error adding project member:', error);
    res.status(500).json({ error: 'Failed to add project member' });
  }
});

/**
 * DELETE /api/projects/:id/members/:userId
 * Remove member from project
 */
router.delete('/:id/members/:memberId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user!.id;

    // Check if user is project lead or org admin/manager
    const roleCheck = await query(
      `SELECT pm.role as project_role, om.role as org_role
       FROM projects p
       INNER JOIN organization_members om ON p.organization_id = om.organization_id
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1 AND om.user_id = $2 AND om.status = $3`,
      [id, userId, 'active']
    );

    if (roleCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { project_role, org_role } = roleCheck.rows[0];
    if (project_role !== 'lead' && !['admin', 'manager'].includes(org_role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [id, memberId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    logger.error('Error removing project member:', error);
    res.status(500).json({ error: 'Failed to remove project member' });
  }
});

/**
 * GET /api/projects/:id/tasks
 * Get all tasks for a project
 */
router.get('/:id/tasks', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check access
    const accessCheck = await query(
      `SELECT 1 FROM projects p
       INNER JOIN organization_members om ON p.organization_id = om.organization_id
       WHERE p.id = $1 AND om.user_id = $2 AND om.status = $3`,
      [id, userId, 'active']
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      `SELECT t.*, u.name as assigned_to_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.project_id = $1
       ORDER BY 
         CASE t.status WHEN 'todo' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'review' THEN 3 WHEN 'done' THEN 4 ELSE 5 END,
         t.created_at DESC`,
      [id]
    );

    res.json({ tasks: result.rows });
  } catch (error) {
    logger.error('Error fetching project tasks:', error);
    res.status(500).json({ error: 'Failed to fetch project tasks' });
  }
});

export default router;
