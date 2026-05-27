import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

const SYNC_COOLDOWN_SECONDS = 30;

// GET /api/sync/status?project_id= — last sync time + cooldown state
router.get('/sync/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const result = await query(
      `SELECT created_at, status, synced_count, triggered_by,
              u.name as triggered_by_name
       FROM sync_logs sl
       LEFT JOIN users u ON sl.triggered_by = u.id
       WHERE sl.project_id = $1
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

    // Check cooldown
    const lastResult = await query(
      `SELECT created_at FROM sync_logs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [project_id]
    );

    if (lastResult.rows.length > 0) {
      const lastSyncTime = new Date(lastResult.rows[0].created_at).getTime();
      const elapsedSeconds = (Date.now() - lastSyncTime) / 1000;

      if (elapsedSeconds < SYNC_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(SYNC_COOLDOWN_SECONDS - elapsedSeconds);
        await query(
          `INSERT INTO sync_logs (project_id, triggered_by, status, synced_count)
           VALUES ($1, $2, 'rate_limited', 0)`,
          [project_id, userId]
        );
        return res.status(429).json({
          error: 'Sync rate limit active',
          remainingSeconds: remaining,
          message: `Please wait ${remaining} seconds before syncing again`
        });
      }
    }

    // Perform the actual sync (re-use existing workspace sync logic)
    const { WorkspaceSyncService } = await import('../services/workspace.service');
    const syncService = new WorkspaceSyncService();

    // Get project's synced sheets
    const sheetsResult = await query(
      `SELECT ss.id FROM synced_sheets ss
       JOIN workspaces w ON ss.workspace_id = w.id
       WHERE w.project_id = $1 AND ss.is_active = true`,
      [project_id]
    );

    let syncedCount = 0;
    let syncError: string | null = null;

    try {
      for (const sheet of sheetsResult.rows) {
        await syncService.syncSheet(sheet.id);
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
