import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import { getGoogleClients } from '../config/google';
import logger from '../config/logger';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/drive/files - List user's files from Google Drive
router.get('/files', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const view = req.query.view as string || 'my-drive';

    // Get user's tokens from database
    const userResult = await query(
      'SELECT access_token, refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { access_token, refresh_token } = userResult.rows[0];

    // Fetch files directly from Google Drive API
    const { drive } = getGoogleClients(access_token, refresh_token);

    // Build query based on view
    // Exclude Google Sheets (they are shown in the Sheets page)
    const excludeSheets = ` and mimeType!='application/vnd.google-apps.spreadsheet'`;
    let q = '';
    switch (view) {
      case 'my-drive':
        q = `'me' in owners and trashed=false${excludeSheets}`;
        break;
      case 'shared':
        q = `not 'me' in owners and sharedWithMe=true and trashed=false${excludeSheets}`;
        break;
      case 'recent':
        q = `trashed=false${excludeSheets}`;
        break;
      case 'starred':
        q = `starred=true and trashed=false${excludeSheets}`;
        break;
      case 'trash':
        q = `trashed=true${excludeSheets}`;
        break;
      default:
        q = `trashed=false${excludeSheets}`;
    }

    const response = await drive.files.list({
      pageSize: 50,
      q: q,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink, thumbnailLink, starred, trashed, owners)',
      orderBy: view === 'recent' ? 'viewedByMeTime desc' : 'modifiedTime desc',
    });

    const files = response.data.files || [];
    logger.info(`Fetched ${files.length} drive files for user ${userId} (view: ${view})`);

    return res.json({ files });
  } catch (error) {
    logger.error('Error fetching drive files:', error);
    return res.status(500).json({ error: 'Failed to fetch drive files' });
  }
});

// POST /api/drive/folder - Create a new folder
router.post('/folder', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    // Get user's tokens
    const userResult = await query(
      'SELECT access_token, refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { access_token, refresh_token } = userResult.rows[0];
    const { drive } = getGoogleClients(access_token, refresh_token);

    // Create folder in Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id, name, mimeType, webViewLink',
    });

    logger.info(`Created folder "${name}" for user ${userId}`);
    return res.json({ folder: response.data });
  } catch (error) {
    logger.error('Error creating folder:', error);
    return res.status(500).json({ error: 'Failed to create folder' });
  }
});

// GET /api/drive/files/:fileId - Get file metadata
router.get('/files/:fileId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { fileId } = req.params;

    // Get user's tokens
    const userResult = await query(
      'SELECT access_token, refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { access_token, refresh_token } = userResult.rows[0];

    const { drive } = getGoogleClients(access_token, refresh_token);

    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, modifiedTime, webViewLink, iconLink, thumbnailLink',
    });

    return res.json({ file: response.data });
  } catch (error) {
    logger.error('Error fetching file:', error);
    return res.status(500).json({ error: 'Failed to fetch file' });
  }
});

export default router;
