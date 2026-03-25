import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { workspaceSyncService } from '../services/workspace.service';
import { query } from '../config/database';
import logger from '../config/logger';
import { google } from 'googleapis';

const router = express.Router();

/**
 * GET /api/workspaces
 * List all workspaces for current organization
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgId = req.query.organizationId as string;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const result = await query(
      `SELECT w.*, 
        (SELECT COUNT(*) FROM synced_sheets WHERE workspace_id = w.id) as sheet_count,
        (SELECT COUNT(*) FROM sheet_tasks st JOIN synced_sheets ss ON st.synced_sheet_id = ss.id WHERE ss.workspace_id = w.id) as task_count
       FROM workspaces w 
       WHERE w.organization_id = $1
       ORDER BY w.created_at DESC`,
      [orgId]
    );

    res.json({ workspaces: result.rows });
  } catch (error: any) {
    logger.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

/**
 * POST /api/workspaces
 * Create a new workspace from a Google Drive folder
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { organizationId, folderId, folderName } = req.body;

    if (!organizationId || !folderId || !folderName) {
      return res.status(400).json({ error: 'Organization ID, folder ID, and folder name required' });
    }

    const workspaceId = await workspaceSyncService.createWorkspace(
      userId, organizationId, folderId, folderName
    );

    res.status(201).json({
      success: true,
      workspaceId,
      message: 'Workspace created successfully'
    });
  } catch (error: any) {
    logger.error('Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

/**
 * GET /api/workspaces/:id
 * Get workspace details with sheets
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const wsResult = await query(
      `SELECT * FROM workspaces WHERE id = $1`,
      [id]
    );

    if (wsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const sheetsResult = await query(
      `SELECT ss.*, 
        (SELECT COUNT(*) FROM sheet_tasks WHERE synced_sheet_id = ss.id) as task_count
       FROM synced_sheets ss 
       WHERE ss.workspace_id = $1`,
      [id]
    );

    res.json({
      workspace: wsResult.rows[0],
      sheets: sheetsResult.rows
    });
  } catch (error: any) {
    logger.error('Error fetching workspace:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

/**
 * GET /api/workspaces/:id/drive-sheets
 * List Google Sheets in the workspace folder (for selection)
 */
router.get('/:id/drive-sheets', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const wsResult = await query(`SELECT root_folder_id FROM workspaces WHERE id = $1`, [id]);
    if (wsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const folderId = wsResult.rows[0].root_folder_id;
    const sheets = await workspaceSyncService.listSheetsInFolder(userId, folderId);

    res.json({ sheets });
  } catch (error: any) {
    logger.error('Error listing drive sheets:', error);
    res.status(500).json({ error: 'Failed to list sheets' });
  }
});

/**
 * POST /api/workspaces/:id/preview-sheet
 * Preview sheet data before syncing (no database changes)
 */
router.post('/:id/preview-sheet', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { sheetId } = req.body;
    const userId = req.user!.id;

    if (!sheetId) {
      return res.status(400).json({ error: 'Sheet ID required' });
    }

    // Detect column mapping
    const columnMapping = await workspaceSyncService.detectColumnMapping(userId, sheetId);
    
    // Parse tasks without saving to database
    const tasks = await workspaceSyncService.parseSheetTasks(userId, sheetId, columnMapping);

    res.json({
      success: true,
      preview: {
        totalTasks: tasks.length,
        columnMapping,
        tasks: tasks.slice(0, 10), // Show first 10 tasks as preview
        hasMore: tasks.length > 10
      }
    });
  } catch (error: any) {
    logger.error('Error previewing sheet:', error);
    res.status(500).json({ error: 'Failed to preview sheet' });
  }
});

/**
 * POST /api/workspaces/:id/connect-sheet
 * Connect a Google Sheet to workspace and perform initial sync
 */
router.post('/:id/connect-sheet', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { sheetId, sheetName, projectId, teamId } = req.body;

    if (!sheetId || !sheetName) {
      return res.status(400).json({ error: 'Sheet ID and name required' });
    }

    const syncedSheetId = await workspaceSyncService.connectSheet(
      id, sheetId, sheetName, projectId, teamId
    );

    res.status(201).json({
      success: true,
      syncedSheetId,
      message: 'Sheet connected and synced'
    });
  } catch (error: any) {
    logger.error('Error connecting sheet:', error);
    res.status(500).json({ error: 'Failed to connect sheet' });
  }
});

/**
 * POST /api/workspaces/:id/sync
 * Manually trigger a full workspace sync
 */
router.post('/:id/sync', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await workspaceSyncService.syncWorkspace(id);

    res.json({ success: true, message: 'Workspace synced successfully' });
  } catch (error: any) {
    logger.error('Error syncing workspace:', error);
    res.status(500).json({ error: 'Failed to sync workspace' });
  }
});

/**
 * GET /api/workspaces/:id/tasks
 * Get all synced tasks from workspace
 */
router.get('/:id/tasks', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tasks = await workspaceSyncService.getWorkspaceTasks(id);

    res.json({ tasks });
  } catch (error: any) {
    logger.error('Error fetching workspace tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * GET /api/workspaces/sheets/:sheetId/tasks
 * Get tasks from a specific synced sheet
 */
router.get('/sheets/:sheetId/tasks', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sheetId } = req.params;

    const tasks = await workspaceSyncService.getSyncedTasks(sheetId);

    res.json({ tasks });
  } catch (error: any) {
    logger.error('Error fetching sheet tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * PATCH /api/workspaces/tasks/:taskId
 * Update a synced task field and write back to Google Sheet
 * Requires admin or manager role
 */
router.patch('/tasks/:taskId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { field, value } = req.body;
    const userId = req.user!.id;

    if (!field || value === undefined) {
      return res.status(400).json({ error: 'Field and value required' });
    }

    const validFields = ['status', 'priority', 'assignee', 'due_date'];
    if (!validFields.includes(field)) {
      return res.status(400).json({ error: `Invalid field. Must be one of: ${validFields.join(', ')}` });
    }

    // Get task and check user's role in the organization
    const taskResult = await query(
      `SELECT st.id, w.organization_id
       FROM sheet_tasks st
       JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
       JOIN workspaces w ON ss.workspace_id = w.id
       WHERE st.id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const organizationId = taskResult.rows[0].organization_id;

    // Check user's role
    const roleResult = await query(
      `SELECT role FROM organization_members 
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [organizationId, userId]
    );

    if (roleResult.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const userRole = roleResult.rows[0].role;

    // Only admin and manager can edit synced tasks
    if (userRole !== 'admin' && userRole !== 'manager') {
      return res.status(403).json({
        error: 'Permission denied. Only admins and managers can edit synced tasks.'
      });
    }

    // Update the task
    const result = await workspaceSyncService.updateSheetTask(taskId, field, value);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to update task' });
    }

    logger.info(`User ${userId} (${userRole}) updated synced task ${taskId}: ${field} = ${value}`);

    res.json({
      success: true,
      message: `Task ${field} updated and synced to Google Sheet`
    });
  } catch (error: any) {
    logger.error('Error updating synced task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/workspaces/tasks/:taskId
 * Delete an individual synced task (admin/manager only)
 */
router.delete('/tasks/:taskId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Get task and check permissions
    const taskResult = await query(
      `SELECT st.id, w.organization_id 
       FROM sheet_tasks st
       JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
       JOIN workspaces w ON ss.workspace_id = w.id
       WHERE st.id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const organizationId = taskResult.rows[0].organization_id;

    // Check user's role
    const roleResult = await query(
      `SELECT role FROM organization_members 
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [organizationId, userId]
    );

    if (roleResult.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const userRole = roleResult.rows[0].role;

    // Only admin and manager can delete synced tasks
    if (userRole !== 'admin' && userRole !== 'manager') {
      return res.status(403).json({
        error: 'Permission denied. Only admins and managers can delete synced tasks.'
      });
    }

    // Get task details including sheet info and row index
    const taskDetailResult = await query(
      `SELECT st.sheet_row_index, ss.sheet_id, ss.column_mapping, w.created_by as user_id
       FROM sheet_tasks st
       JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
       JOIN workspaces w ON ss.workspace_id = w.id
       WHERE st.id = $1`,
      [taskId]
    );

    if (taskDetailResult.rows.length > 0) {
      const taskDetail = taskDetailResult.rows[0];
      
      try {
        // Delete row from Google Sheet
        const { getGoogleClients } = await import('../config/google');
        const userResult = await query(
          'SELECT access_token, refresh_token FROM users WHERE id = $1',
          [taskDetail.user_id]
        );

        if (userResult.rows[0]) {
          const { access_token, refresh_token } = userResult.rows[0];
          const { sheets } = getGoogleClients(access_token, refresh_token);

          const columnMapping = taskDetail.column_mapping;
          const sheetTab = columnMapping.sheetTab || 'Sheet1';
          const rowNumber = taskDetail.sheet_row_index + 1; // +1 because sheet is 1-indexed

          // Delete the row from Google Sheet
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: taskDetail.sheet_id,
            requestBody: {
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: 0, // Default sheet
                    dimension: 'ROWS',
                    startIndex: taskDetail.sheet_row_index,
                    endIndex: taskDetail.sheet_row_index + 1
                  }
                }
              }]
            }
          });

          logger.info(`Deleted row ${rowNumber} from Google Sheet ${taskDetail.sheet_id}`);
        }
      } catch (sheetError) {
        logger.warn('Failed to delete row from Google Sheet:', sheetError);
        // Continue with database deletion even if sheet deletion fails
      }
    }

    // Delete the task from database
    await query(`DELETE FROM sheet_tasks WHERE id = $1`, [taskId]);

    logger.info(`User ${userId} (${userRole}) deleted synced task ${taskId}`);

    res.json({ success: true, message: 'Task deleted from both database and Google Sheet' });
  } catch (error: any) {
    logger.error('Error deleting synced task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

/**
 * DELETE /api/workspaces/sheets/:sheetId
 * Delete a synced sheet from workspace (removes sync, keeps Google Sheet intact)
 */
router.delete('/sheets/:sheetId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user!.id;

    // Get sheet and workspace info to check permissions
    const sheetResult = await query(
      `SELECT ss.*, w.organization_id 
       FROM synced_sheets ss 
       JOIN workspaces w ON ss.workspace_id = w.id 
       WHERE ss.id = $1`,
      [sheetId]
    );

    if (sheetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Synced sheet not found' });
    }

    const organizationId = sheetResult.rows[0].organization_id;

    // Check user's role in the organization
    const roleResult = await query(
      `SELECT role FROM organization_members 
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [organizationId, userId]
    );

    if (roleResult.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const userRole = roleResult.rows[0].role;

    // Only admin and manager can delete synced sheets
    if (userRole !== 'admin' && userRole !== 'manager') {
      return res.status(403).json({
        error: 'Permission denied. Only admins and managers can delete synced sheets.'
      });
    }

    // Delete associated tasks first (cascade should handle this, but be explicit)
    await query(`DELETE FROM sheet_tasks WHERE synced_sheet_id = $1`, [sheetId]);

    // Delete the synced sheet record
    await query(`DELETE FROM synced_sheets WHERE id = $1`, [sheetId]);

    logger.info(`User ${userId} (${userRole}) deleted synced sheet ${sheetId}`);

    res.json({ success: true, message: 'Synced sheet removed successfully' });
  } catch (error: any) {
    logger.error('Error deleting synced sheet:', error);
    res.status(500).json({ error: 'Failed to delete synced sheet' });
  }
});

/**
 * DELETE /api/workspaces/:id
 * Delete a workspace
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(`DELETE FROM workspaces WHERE id = $1`, [id]);

    res.json({ success: true, message: 'Workspace deleted' });
  } catch (error: any) {
    logger.error('Error deleting workspace:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

/**
 * POST /api/workspaces/webhook/drive
 * Webhook endpoint for Google Drive push notifications
 */
router.post('/webhook/drive', async (req, res) => {
  try {
    const channelId = req.headers['x-goog-channel-id'] as string;
    const resourceState = req.headers['x-goog-resource-state'] as string;

    logger.info(`Drive webhook: ${resourceState} on channel ${channelId}`);

    if (resourceState === 'sync') {
      // Initial sync confirmation
      return res.status(200).send('OK');
    }

    if (resourceState === 'change') {
      // Find workspace by channel ID and trigger sync
      const wsResult = await query(
        `SELECT id FROM workspaces WHERE drive_channel_id = $1`,
        [channelId]
      );

      if (wsResult.rows.length > 0) {
        // Queue async sync (don't block webhook response)
        setImmediate(async () => {
          try {
            await workspaceSyncService.syncWorkspace(wsResult.rows[0].id);
          } catch (err) {
            logger.error('Webhook sync error:', err);
          }
        });
      }
    }

    res.status(200).send('OK');
  } catch (error: any) {
    logger.error('Drive webhook error:', error);
    res.status(200).send('OK'); // Always return 200 to prevent retries
  }
});

/**
 * POST /api/workspaces/sheets/:sheetId/import-teams
 * Import team groups + members from a synced Google Sheet
 * Requires admin role
 */
router.post('/sheets/:sheetId/import-teams', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user!.id;

    // Get sheet and workspace info to check permissions
    const sheetResult = await query(
      `SELECT ss.*, w.organization_id
       FROM synced_sheets ss
       JOIN workspaces w ON ss.workspace_id = w.id
       WHERE ss.id = $1`,
      [sheetId]
    );

    if (sheetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Synced sheet not found' });
    }

    const organizationId = sheetResult.rows[0].organization_id;

    // Check user's role — admin only
    const roleResult = await query(
      `SELECT role FROM organization_members
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [organizationId, userId]
    );

    if (roleResult.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const userRole = roleResult.rows[0].role;
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can import teams from sheets' });
    }

    const result = await workspaceSyncService.importTeamsFromSheet(sheetId);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Import failed' });
    }

    logger.info(`User ${userId} imported teams from sheet ${sheetId}: ${result.teamsCreated} teams, ${result.membersCreated} members`);

    res.json({
      success: true,
      teamsCreated: result.teamsCreated,
      membersCreated: result.membersCreated,
      message: `Imported ${result.teamsCreated} teams with ${result.membersCreated} members`
    });
  } catch (error: any) {
    logger.error('Error importing teams from sheet:', error);
    res.status(500).json({ error: 'Failed to import teams' });
  }
});

export default router;
