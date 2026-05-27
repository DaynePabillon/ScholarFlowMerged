import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';
import * as ms365 from '../services/microsoft365.service';

const router = Router();

// GET /api/ms365/status?organization_id=
router.get('/ms365/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id } = req.query;
    const userId = req.user!.id;

    const configured = ms365.isMS365Configured();
    if (!configured) {
      return res.json({ connected: false, configured: false });
    }

    const result = await query(
      `SELECT ms_user_email, ms_user_id, expires_at, updated_at
       FROM ms365_tokens WHERE user_id = $1 AND organization_id = $2`,
      [userId, organization_id]
    );

    res.json({
      connected: result.rows.length > 0,
      configured: true,
      account: result.rows[0] || null
    });
  } catch (error) {
    logger.error('Error checking MS365 status:', error);
    res.status(500).json({ error: 'Failed to check MS365 status' });
  }
});

// GET /api/ms365/auth?organization_id= — get OAuth URL
router.get('/ms365/auth', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id } = req.query;
    const userId = req.user!.id;
    const state = Buffer.from(JSON.stringify({ userId, organization_id })).toString('base64');
    const url = ms365.getAuthorizationUrl(state);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

// POST /api/ms365/callback — exchange code for tokens
router.post('/ms365/callback', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { code, state } = req.body;
    const userId = req.user!.id;

    const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    const organizationId = stateData.organization_id;

    const tokens = await ms365.exchangeCodeForTokens(code);

    // Get MS user profile
    const { default: axios } = await import('axios');
    const profile = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await query(
      `INSERT INTO ms365_tokens (user_id, organization_id, access_token, refresh_token, expires_at, scope, ms_user_id, ms_user_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, organization_id) DO UPDATE
         SET access_token = EXCLUDED.access_token,
             refresh_token = EXCLUDED.refresh_token,
             expires_at = EXCLUDED.expires_at,
             ms_user_id = EXCLUDED.ms_user_id,
             ms_user_email = EXCLUDED.ms_user_email,
             updated_at = NOW()`,
      [userId, organizationId, tokens.access_token, tokens.refresh_token, expiresAt,
       tokens.scope, profile.data.id, profile.data.mail || profile.data.userPrincipalName]
    );

    res.json({ success: true, email: profile.data.mail || profile.data.userPrincipalName });
  } catch (error: any) {
    logger.error('MS365 callback error:', error);
    res.status(500).json({ error: 'Failed to connect Microsoft 365 account' });
  }
});

// DELETE /api/ms365/disconnect?organization_id=
router.delete('/ms365/disconnect', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id } = req.query;
    const userId = req.user!.id;

    await query(
      `DELETE FROM ms365_tokens WHERE user_id = $1 AND organization_id = $2`,
      [userId, organization_id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// GET /api/ms365/workbooks?organization_id=
router.get('/ms365/workbooks', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id } = req.query;
    const userId = req.user!.id;
    const workbooks = await ms365.listWorkbooks(userId, String(organization_id));
    res.json({ workbooks });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list workbooks' });
  }
});

// GET /api/ms365/worksheets?organization_id=&workbook_id=
router.get('/ms365/worksheets', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id, workbook_id } = req.query;
    const userId = req.user!.id;
    const worksheets = await ms365.listWorksheets(userId, String(organization_id), String(workbook_id));
    res.json({ worksheets });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list worksheets' });
  }
});

// GET /api/ms365/headers?organization_id=&workbook_id=&worksheet_id=
router.get('/ms365/headers', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id, workbook_id, worksheet_id } = req.query;
    const userId = req.user!.id;
    const { headers } = await ms365.getWorksheetData(userId, String(organization_id), String(workbook_id), String(worksheet_id));
    res.json({ headers });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get headers' });
  }
});

// POST /api/ms365/sync — sync worksheet to tasks
router.post('/ms365/sync', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { organization_id, project_id, workbook_id, worksheet_id, field_mappings } = req.body;
    const userId = req.user!.id;

    const result = await ms365.syncWorksheetToTasks(
      userId, organization_id, project_id, workbook_id, worksheet_id, field_mappings
    );

    // Store sync config
    await query(
      `INSERT INTO ms365_sync_configs (project_id, user_id, workbook_id, worksheet_id, field_mappings, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (project_id) DO UPDATE
         SET workbook_id = EXCLUDED.workbook_id, worksheet_id = EXCLUDED.worksheet_id,
             field_mappings = EXCLUDED.field_mappings, last_synced_at = NOW(), updated_at = NOW()`,
      [project_id, userId, workbook_id, worksheet_id, JSON.stringify(field_mappings)]
    );

    res.json(result);
  } catch (error: any) {
    logger.error('MS365 sync error:', error);
    res.status(500).json({ error: error.message || 'Sync failed' });
  }
});

// GET /api/ms365/config?project_id= — get saved sync config
router.get('/ms365/config', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query;
    const result = await query(`SELECT * FROM ms365_sync_configs WHERE project_id = $1`, [project_id]);
    res.json({ config: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

export default router;
