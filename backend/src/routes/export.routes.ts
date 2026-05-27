import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

// GET /api/export/reports?project_id= — report history
router.get('/export/reports', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const result = await query(
      `SELECT rh.*, u.name as generated_by_name
       FROM report_history rh
       LEFT JOIN users u ON rh.generated_by = u.id
       WHERE rh.project_id = $1
       ORDER BY rh.created_at DESC
       LIMIT 50`,
      [project_id]
    );

    res.json({ reports: result.rows });
  } catch (error) {
    logger.error('Error fetching report history:', error);
    res.status(500).json({ error: 'Failed to fetch report history' });
  }
});

// POST /api/export/generate — generate a report
router.post('/export/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      project_id, organization_id, report_type, format,
      sprint_label, date_range_start, date_range_end, title
    } = req.body;
    const userId = req.user!.id;

    if (!project_id || !report_type || !format) {
      return res.status(400).json({ error: 'project_id, report_type, and format are required' });
    }

    // Gather report data
    let taskQuery = `SELECT t.id, t.title, t.status, t.priority, t.wbs_code, t.due_date, t.progress,
                            t.estimated_hours, t.assigned_to_ids,
                            array_agg(DISTINCT u.name) FILTER (WHERE u.id IS NOT NULL) as assignee_names
                     FROM tasks t
                     LEFT JOIN users u ON u.id = ANY(t.assigned_to_ids)
                     WHERE t.project_id = $1`;
    const taskParams: any[] = [project_id];
    let pCount = 1;

    if (date_range_start) { pCount++; taskQuery += ` AND t.created_at >= $${pCount}`; taskParams.push(date_range_start); }
    if (date_range_end)   { pCount++; taskQuery += ` AND t.created_at <= $${pCount}`; taskParams.push(date_range_end); }

    taskQuery += ' GROUP BY t.id ORDER BY t.wbs_code NULLS LAST, t.created_at';

    const tasksResult = await query(taskQuery, taskParams);
    const tasks = tasksResult.rows;

    const reportTitle = title || `${report_type.replace(/_/g, ' ')} – ${new Date().toLocaleDateString()}`;

    // Generate Google Doc if requested and configured
    let googleDocId: string | null = null;
    let googleDocUrl: string | null = null;

    if (format === 'google_doc' && process.env.GOOGLE_CLIENT_ID) {
      try {
        const { GoogleDocsService } = await import('../services/scholar/googleDocs.service');
        const docsService = new GoogleDocsService();
        const docResult = await docsService.createReport(userId, reportTitle, tasks);
        googleDocId = docResult.docId;
        googleDocUrl = docResult.docUrl;
      } catch (err: any) {
        logger.warn('Google Docs export failed, falling back to data response:', err.message);
      }
    }

    // Save to history
    const insertResult = await query(
      `INSERT INTO report_history (project_id, organization_id, generated_by, report_type, format, title, sprint_label, date_range_start, date_range_end, google_doc_id, google_doc_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'completed')
       RETURNING *`,
      [project_id, organization_id, userId, report_type, format, reportTitle, sprint_label || null,
       date_range_start || null, date_range_end || null, googleDocId, googleDocUrl]
    );

    res.json({
      report: insertResult.rows[0],
      data: { tasks, title: reportTitle },
      googleDocUrl
    });
  } catch (error: any) {
    logger.error('Error generating report:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

export default router;
