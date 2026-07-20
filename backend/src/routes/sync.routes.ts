import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

const SYNC_COOLDOWN_SECONDS = 30;

// GET /api/sync/sheets?project_id= — sheets connected to a project
router.get('/sync/sheets', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const result = await query(
      `SELECT ss.id, ss.sheet_id, ss.sheet_name, ss.last_synced_at, ss.sync_status,
              (SELECT COUNT(*) FROM sheet_tasks WHERE synced_sheet_id = ss.id) AS task_count
       FROM synced_sheets ss
       WHERE ss.project_id = $1
       ORDER BY ss.created_at DESC`,
      [project_id]
    );

    res.json({ sheets: result.rows });
  } catch (error) {
    logger.error('Error fetching connected sheets:', error);
    res.status(500).json({ error: 'Failed to fetch connected sheets' });
  }
});

// DELETE /api/sync/sheets/:sheetId — unlink a sheet from a project
router.delete('/sync/sheets/:sheetId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sheetId } = req.params;
    await query(`DELETE FROM synced_sheets WHERE id = $1`, [sheetId]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing connected sheet:', error);
    res.status(500).json({ error: 'Failed to remove sheet' });
  }
});

// GET /api/sync/status?project_id= — last sync time + cooldown state
router.get('/sync/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    // IMPORTANT: exclude 'rate_limited' rows when determining the last *real* sync.
    // Each blocked attempt previously inserted a 'rate_limited' row with a fresh
    // created_at timestamp — if that row were treated as "the last sync", every
    // subsequent status check (and the /sync/trigger cooldown check below) would
    // see an ever-more-recent timestamp and the cooldown would never expire,
    // creating a perpetual lockout. Only successful/failed/in-progress syncs
    // count as the reference point for cooldown + "last synced" display.
    const result = await query(
      `SELECT created_at, status, synced_count, triggered_by,
              u.name as triggered_by_name
       FROM sync_logs sl
       LEFT JOIN users u ON sl.triggered_by = u.id
       WHERE sl.project_id = $1 AND sl.status != 'rate_limited'
       ORDER BY sl.created_at DESC
       LIMIT 1`,
      [project_id]
    );

    const lastSync = result.rows[0] || null;
    const now = Date.now();
    const lastSyncTime = lastSync ? new Date(lastSync.created_at).getTime() : 0;
    const elapsedSeconds = (now - lastSyncTime) / 1000;
    const onCooldown = elapsedSeconds < SYNC_COOLDOWN_SECONDS;
    const remainingSeconds = onCooldown ? Math.ceil(SYNC_COOLDOWN_SECONDS - elapsedSeconds) : 0;

    res.json({
      lastSync,
      onCooldown,
      remainingSeconds,
      cooldownSeconds: SYNC_COOLDOWN_SECONDS
    });
  } catch (error) {
    logger.error('Error fetching sync status:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

// GET /api/sync/logs?project_id= — recent sync history
router.get('/sync/logs', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const result = await query(
      `SELECT sl.*, u.name as triggered_by_name
       FROM sync_logs sl
       LEFT JOIN users u ON sl.triggered_by = u.id
       WHERE sl.project_id = $1
       ORDER BY sl.created_at DESC
       LIMIT 20`,
      [project_id]
    );

    res.json({ logs: result.rows });
  } catch (error) {
    logger.error('Error fetching sync logs:', error);
    res.status(500).json({ error: 'Failed to fetch sync logs' });
  }
});

// POST /api/sync/trigger — manual sync with rate-limit enforcement
router.post('/sync/trigger', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.body;
    const userId = req.user!.id;

    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    // Check cooldown — last sync timestamp
    // IMPORTANT: exclude 'rate_limited' rows from the lookup. Each blocked
    // attempt below inserts a 'rate_limited' log row (for the History view).
    // If THAT row were used as "the last sync", the very next request would
    // see an even-more-recent timestamp than the original sync, perpetually
    // resetting the cooldown window — a cascading lockout where the button
    // never re-enables. Only count real sync attempts (success/failed/in_progress)
    // as the cooldown reference point.
    const lastResult = await query(
      `SELECT created_at FROM sync_logs
       WHERE project_id = $1 AND status != 'rate_limited'
       ORDER BY created_at DESC LIMIT 1`,
      [project_id]
    );

    if (lastResult.rows.length > 0) {
      const lastSyncTime = new Date(lastResult.rows[0].created_at).getTime();
      const elapsedSeconds = (Date.now() - lastSyncTime) / 1000;

      // Enforce cooldown period — block requests made too soon after the last real sync
      if (elapsedSeconds < SYNC_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(SYNC_COOLDOWN_SECONDS - elapsedSeconds);
        await query(
          `INSERT INTO sync_logs (project_id, triggered_by, status, synced_count)
           VALUES ($1, $2, 'rate_limited', 0)`,
          [project_id, userId]
        );
        // Show warning message — frontend renders "Please wait before syncing again"
        return res.status(429).json({
          error: 'Sync rate limit active',
          remainingSeconds: remaining,
          message: `Please wait ${remaining} seconds before syncing again`
        });
      }
    }
    // Cooldown expired (or no prior sync) — allow this sync to proceed

    // Perform the actual sync (re-use existing workspace sync logic)
    const { WorkspaceSyncService } = await import('../services/workspace.service');
    const syncService = new WorkspaceSyncService();

    // Get project's synced sheets
    // synced_sheets.project_id is the direct link — no workspace JOIN needed
    const sheetsResult = await query(
      `SELECT ss.id FROM synced_sheets ss WHERE ss.project_id = $1`,
      [project_id]
    );

    if (sheetsResult.rows.length === 0) {
      // No sheets linked to this project — succeed with a helpful message
      await query(
        `INSERT INTO sync_logs (project_id, triggered_by, status, synced_count, error_message)
         VALUES ($1, $2, 'success', 0, 'No sheets connected to this project')`,
        [project_id, userId]
      );
      return res.json({ success: true, syncedCount: 0, message: 'No Google Sheets are connected to this project yet. Link a sheet via the workspace panel first.' });
    }

    // Fetch user-defined column_mappings for this project and pass them as
    // status overrides so custom values (e.g. "Not Started" → "todo") are respected
    const mappingsResult = await query(
      `SELECT LOWER(sheet_column) as sheet_column, kanban_column
       FROM column_mappings
       WHERE project_id = $1 AND is_active = true`,
      [project_id]
    );
    const statusOverrides: Record<string, string> = {};
    for (const m of mappingsResult.rows) {
      statusOverrides[m.sheet_column] = m.kanban_column;
    }

    let syncedCount = 0;
    let syncError: string | null = null;

    try {
      for (const sheet of sheetsResult.rows) {
        await syncService.syncSheet(sheet.id, Object.keys(statusOverrides).length ? statusOverrides : undefined);
        syncedCount++;
      }
    } catch (err: any) {
      syncError = err.message;
    }

    await query(
      `INSERT INTO sync_logs (project_id, triggered_by, status, synced_count, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [project_id, userId, syncError ? 'failed' : 'success', syncedCount, syncError]
    );

    res.json({
      success: !syncError,
      syncedCount,
      error: syncError
    });
  } catch (error) {
    logger.error('Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

export default router;
