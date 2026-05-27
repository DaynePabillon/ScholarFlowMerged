import axios from 'axios';
import { query } from '../config/database';
import logger from '../config/logger';

const MS_CLIENT_ID = process.env.MS365_CLIENT_ID || '';
const MS_CLIENT_SECRET = process.env.MS365_CLIENT_SECRET || '';
const MS_TENANT = process.env.MS365_TENANT_ID || 'common';
const REDIRECT_URI = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/ms365/callback`;

const SCOPES = [
  'offline_access',
  'User.Read',
  'Files.ReadWrite',
  'Sites.ReadWrite.All'
].join(' ');

export const isMS365Configured = () => !!(MS_CLIENT_ID && MS_CLIENT_SECRET);

export const getAuthorizationUrl = (state: string) => {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    response_mode: 'query'
  });
  return `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params}`;
};

export const exchangeCodeForTokens = async (code: string) => {
  const response = await axios.post(
    `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data;
};

export const refreshAccessToken = async (refreshToken: string) => {
  const response = await axios.post(
    `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPES
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data;
};

const getValidToken = async (userId: string, organizationId: string): Promise<string> => {
  const result = await query(
    `SELECT access_token, refresh_token, expires_at FROM ms365_tokens WHERE user_id = $1 AND organization_id = $2`,
    [userId, organizationId]
  );

  if (result.rows.length === 0) throw new Error('No MS365 token found. Please connect your account.');

  const token = result.rows[0];
  if (new Date(token.expires_at) > new Date(Date.now() + 60000)) {
    return token.access_token;
  }

  // Refresh
  const refreshed = await refreshAccessToken(token.refresh_token);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await query(
    `UPDATE ms365_tokens SET access_token = $1, expires_at = $2, updated_at = NOW()
     WHERE user_id = $3 AND organization_id = $4`,
    [refreshed.access_token, expiresAt, userId, organizationId]
  );

  return refreshed.access_token;
};

export const listWorkbooks = async (userId: string, organizationId: string) => {
  const token = await getValidToken(userId, organizationId);
  const response = await axios.get(
    'https://graph.microsoft.com/v1.0/me/drive/root/search(q=\'.xlsx\')?$select=id,name,webUrl',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.value || [];
};

export const listWorksheets = async (userId: string, organizationId: string, workbookId: string) => {
  const token = await getValidToken(userId, organizationId);
  const response = await axios.get(
    `https://graph.microsoft.com/v1.0/me/drive/items/${workbookId}/workbook/worksheets`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.value || [];
};

export const getWorksheetData = async (
  userId: string,
  organizationId: string,
  workbookId: string,
  worksheetId: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> => {
  const token = await getValidToken(userId, organizationId);

  // Get used range
  const response = await axios.get(
    `https://graph.microsoft.com/v1.0/me/drive/items/${workbookId}/workbook/worksheets/${worksheetId}/usedRange`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const values: string[][] = response.data.values || [];
  if (values.length < 2) return { headers: [], rows: [] };

  const headers = values[0].map(String);
  const rows = values.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = String(row[i] ?? ''); });
    return obj;
  });

  return { headers, rows };
};

export const syncWorksheetToTasks = async (
  userId: string,
  organizationId: string,
  projectId: string,
  workbookId: string,
  worksheetId: string,
  fieldMappings: Record<string, string>
): Promise<{ synced: number; errors: string[] }> => {
  const { headers, rows } = await getWorksheetData(userId, organizationId, workbookId, worksheetId);
  const errors: string[] = [];
  let synced = 0;

  const titleField = fieldMappings['title'] || headers[0];

  for (const row of rows) {
    const title = row[titleField];
    if (!title) continue;

    try {
      const status = fieldMappings['status'] ? row[fieldMappings['status']] : undefined;
      const dueDate = fieldMappings['due_date'] ? row[fieldMappings['due_date']] : undefined;

      const existing = await query(`SELECT id FROM tasks WHERE project_id = $1 AND title = $2`, [projectId, title]);

      if (existing.rows.length > 0) {
        const updates: string[] = [];
        const vals: any[] = [];
        let n = 1;
        if (status) { updates.push(`status = $${n++}`); vals.push(status); }
        if (dueDate) { updates.push(`due_date = $${n++}`); vals.push(dueDate); }
        if (updates.length > 0) {
          vals.push(existing.rows[0].id);
          await query(`UPDATE tasks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${n}`, vals);
        }
      } else {
        await query(
          `INSERT INTO tasks (project_id, title, status, due_date, created_at) VALUES ($1, $2, $3, $4, NOW())`,
          [projectId, title, status || 'todo', dueDate || null]
        );
      }
      synced++;
    } catch (err: any) {
      errors.push(`Row "${title}": ${err.message}`);
    }
  }

  logger.info(`MS365 sync: ${synced} tasks synced for project ${projectId}`);
  return { synced, errors };
};
