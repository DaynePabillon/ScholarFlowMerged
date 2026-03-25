import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import { getGoogleClients } from '../config/google';
import logger from '../config/logger';
import { WorkspaceSyncService } from '../services/workspace.service';

const router = Router();

// ─── Helper: Extract Google Sheet ID from various URL formats ───
function extractSheetId(url: string): string | null {
  // Matches: https://docs.google.com/spreadsheets/d/SHEET_ID/...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Plain ID fallback (no URL, just the ID itself)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim();
  return null;
}

// ─── Helper: Map sheet status string → SkyFlow status ───
function mapStatus(raw: string): string {
  const s = (raw || '').toLowerCase().trim();
  if (s.includes('done') || s.includes('complete')) return 'done';
  if (s.includes('progress') || s.includes('in prog')) return 'in_progress';
  if (s.includes('review')) return 'review';
  if (s.includes('block')) return 'blocked';
  return 'todo';
}

// ─── Helper: Map sheet priority string → SkyFlow priority ───
function mapPriority(raw: string): string {
  const p = (raw || '').toLowerCase().trim();
  if (p.includes('critical') || p.includes('urgent')) return 'critical';
  if (p.includes('high')) return 'high';
  if (p.includes('low')) return 'low';
  return 'medium';
}

/**
 * POST /api/wbs/import
 * Import tasks from a hierarchical WBS Google Sheet into a SkyFlow project.
 *
 * Body: { sheetUrl: string, projectId: string }
 *
 * Expected sheet columns (row 1 = header):
 *   A: WBS ID   B: Level   C: Item Type   D: Item Name
 *   E: Description   F: Owner (email)   G: Status   H: Priority
 *   I: Start Date   J: End Date   K: Progress %
 */
router.post('/import', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sheetUrl, projectId } = req.body;

    if (!sheetUrl || !projectId) {
      return res.status(400).json({ error: 'sheetUrl and projectId are required' });
    }

    // 1. Extract Sheet ID
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      return res.status(400).json({ error: 'Invalid Google Sheet URL. Please paste a valid link.' });
    }

    // 2. Verify user has access to the project (admin/manager)
    const accessCheck = await query(
      `SELECT om.role FROM projects p
       INNER JOIN organization_members om ON p.organization_id = om.organization_id
       WHERE p.id = $1 AND om.user_id = $2 AND om.status = 'active'`,
      [projectId, userId]
    );
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }
    const userRole = accessCheck.rows[0].role;
    if (userRole === 'member') {
      return res.status(403).json({ error: 'Only admins and managers can import WBS sheets' });
    }

    // 3. Get Google API client
    const userResult = await query(
      'SELECT access_token, refresh_token FROM users WHERE id = $1',
      [userId]
    );
    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User tokens not found. Please re-authenticate with Google.' });
    }
    const { access_token, refresh_token } = userResult.rows[0];
    const { sheets } = getGoogleClients(access_token, refresh_token);

    // 4. Fetch all data from the sheet (first tab)
    let sheetData;
    try {
      const metaRes = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const firstTab = metaRes.data.sheets?.[0]?.properties?.title || 'Sheet1';

      const dataRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${firstTab}!A1:K500`,
      });
      sheetData = dataRes.data.values;
    } catch (sheetErr: any) {
      logger.error('Google Sheets API error:', sheetErr.message);
      if (sheetErr.code === 403 || sheetErr.code === 404) {
        return res.status(400).json({
          error: 'Cannot access the sheet. Make sure it is shared as "Anyone with the link can view".'
        });
      }
      throw sheetErr;
    }

    if (!sheetData || sheetData.length < 2) {
      return res.status(400).json({ error: 'Sheet is empty or has no data rows (only a header).' });
    }

    // 5. Parse header row to find column indices
    const header = sheetData[0].map((h: string) => (h || '').toLowerCase().trim());
    const colIdx = {
      wbsId:       header.findIndex((h: string) => h.includes('wbs') && h.includes('id')),
      level:       header.findIndex((h: string) => h === 'level'),
      itemType:    header.findIndex((h: string) => h.includes('item') && h.includes('type')),
      itemName:    header.findIndex((h: string) => h.includes('item') && h.includes('name')),
      description: header.findIndex((h: string) => h.includes('desc')),
      owner:       header.findIndex((h: string) => h.includes('owner') || h.includes('assignee') || h.includes('email')),
      status:      header.findIndex((h: string) => h.includes('status')),
      priority:    header.findIndex((h: string) => h.includes('priority')),
      startDate:   header.findIndex((h: string) => h.includes('start')),
      endDate:     header.findIndex((h: string) => h.includes('end') || h.includes('due')),
      progress:    header.findIndex((h: string) => h.includes('progress')),
    };

    // Must have at least WBS ID and Item Name
    if (colIdx.wbsId === -1 || colIdx.itemName === -1) {
      return res.status(400).json({
        error: 'Sheet must have "WBS ID" and "Item Name" columns in the header row.',
        detectedHeaders: header,
      });
    }

    // 6. Parse data rows
    const dataRows = sheetData.slice(1).filter((row: string[]) => {
      const wbs = row[colIdx.wbsId];
      const name = row[colIdx.itemName];
      return wbs && name; // skip empty rows
    });

    if (dataRows.length === 0) {
      return res.status(400).json({ error: 'No valid data rows found in the sheet.' });
    }

    // 7. Delete existing WBS-imported tasks for this project (clean re-import)
    await query('DELETE FROM tasks WHERE project_id = $1 AND wbs_code IS NOT NULL', [projectId]);

    // 8. Create tasks — first pass: insert all tasks
    const wbsToTaskId: Record<string, string> = {};
    const created: any[] = [];

    for (const row of dataRows) {
      const wbsCode   = (row[colIdx.wbsId] || '').toString().trim();
      const itemName  = (row[colIdx.itemName] || '').toString().trim();
      const level     = colIdx.level !== -1 ? parseInt(row[colIdx.level]) || 1 : wbsCode.split('.').length;
      const itemType  = colIdx.itemType !== -1 ? (row[colIdx.itemType] || '') : '';
      const desc      = colIdx.description !== -1 ? (row[colIdx.description] || '') : '';
      const owner     = colIdx.owner !== -1 ? (row[colIdx.owner] || '') : '';
      const status    = colIdx.status !== -1 ? mapStatus(row[colIdx.status] || '') : 'todo';
      const priority  = colIdx.priority !== -1 ? mapPriority(row[colIdx.priority] || '') : 'medium';
      const startDate = colIdx.startDate !== -1 ? (row[colIdx.startDate] || null) : null;
      const endDate   = colIdx.endDate !== -1 ? (row[colIdx.endDate] || null) : null;
      const progress  = colIdx.progress !== -1 ? parseInt((row[colIdx.progress] || '0').toString().replace('%', '')) || 0 : 0;

      // Determine complexity weight from level (modules heavier)
      const complexityWeight = Math.max(1, 5 - level);

      // Resolve owner email → user id (if they exist in the system)
      let assignedTo: string | null = null;
      if (owner && owner.includes('@')) {
        const ownerResult = await query('SELECT id FROM users WHERE email = $1', [owner.trim()]);
        if (ownerResult.rows[0]) {
          assignedTo = ownerResult.rows[0].id;
        }
      }

      // Build description with item type prefix if present
      const fullDesc = itemType ? `[${itemType}] ${desc}` : desc;

      const result = await query(
        `INSERT INTO tasks (
          project_id, title, description, status, priority,
          start_date, due_date, created_by, wbs_code, 
          complexity_weight, assigned_to, is_absolute
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, title, wbs_code, status`,
        [
          projectId, itemName, fullDesc || null, status, priority,
          startDate || null, endDate || null, userId, wbsCode,
          complexityWeight, assignedTo, false
        ]
      );

      const task = result.rows[0];
      wbsToTaskId[wbsCode] = task.id;
      created.push({ ...task, level, wbsCode });
    }

    // 9. Second pass: resolve parent_task_id from WBS hierarchy
    let parentsLinked = 0;
    for (const task of created) {
      const parts = task.wbsCode.split('.');
      if (parts.length > 1) {
        const parentWbs = parts.slice(0, -1).join('.');
        const parentId = wbsToTaskId[parentWbs];
        if (parentId) {
          await query('UPDATE tasks SET parent_task_id = $1 WHERE id = $2', [parentId, task.id]);
          parentsLinked++;
        }
      }
    }

    // 10. Store sheet URL on project for future re-sync
    await query(
      `UPDATE projects SET description = 
         CASE WHEN description IS NULL OR description = '' 
           THEN $1 
           ELSE description || E'\n' || $1 
         END
       WHERE id = $2`,
      [`📊 WBS Sheet: ${sheetUrl}`, projectId]
    );

    logger.info(`WBS import complete: ${created.length} tasks created, ${parentsLinked} parent links for project ${projectId}`);

    res.status(201).json({
      success: true,
      summary: {
        tasksCreated: created.length,
        parentsLinked,
        sheetId,
      },
      tasks: created,
      message: `Successfully imported ${created.length} tasks from WBS sheet.`
    });

  } catch (error: any) {
    logger.error('WBS import error:', error);
    res.status(500).json({ error: error.message || 'Failed to import WBS sheet' });
  }
});

/**
 * POST /api/wbs/template
 * Create a blank WBS template Google Sheet
 */
router.post('/template', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { folderId } = req.body;

    const workspaceService = new WorkspaceSyncService();
    const result = await workspaceService.createWbsTemplate(userId, folderId);

    logger.info(`WBS template created by user ${userId}: ${result.id}`);
    
    res.status(201).json({
      success: true,
      spreadsheet: result,
      message: 'WBS template created successfully. You can now add your tasks to the sheet.'
    });
  } catch (error) {
    logger.error('Error creating WBS template:', error);
    res.status(500).json({ error: 'Failed to create WBS template' });
  }
});

/**
 * POST /api/wbs/template/sample
 * Create a WBS template Google Sheet with sample data
 */
router.post('/template/sample', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { folderId } = req.body;

    const workspaceService = new WorkspaceSyncService();
    const result = await workspaceService.createWbsTemplate(userId, folderId);

    // Add sample data to the created sheet
    const { getGoogleClients } = await import('../config/google');
    const userResult = await import('../config/database').then(db => 
      db.query('SELECT access_token, refresh_token FROM users WHERE id = $1', [userId])
    );
    
    if (userResult.rows[0]) {
      const { access_token, refresh_token } = userResult.rows[0];
      const { sheets } = getGoogleClients(access_token, refresh_token);

      // Add sample tasks
      await sheets.spreadsheets.values.update({
        spreadsheetId: result.id,
        range: 'Sheet1!A2:E4',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['1. User Authentication', 'student1@example.com', '2026-03-20', '2026-03-27', 'To Do'],
            ['2. Database Schema', 'student2@example.com', '2026-03-20', '2026-03-25', 'In Progress'],
            ['3. API Development', 'student3@example.com', '2026-03-22', '2026-03-30', 'To Do']
          ]
        }
      });
    }

    logger.info(`WBS sample template created by user ${userId}: ${result.id}`);
    
    res.status(201).json({
      success: true,
      spreadsheet: result,
      message: 'WBS sample template created successfully with example tasks.'
    });
  } catch (error) {
    logger.error('Error creating sample WBS template:', error);
    res.status(500).json({ error: 'Failed to create sample WBS template' });
  }
});

export default router;
