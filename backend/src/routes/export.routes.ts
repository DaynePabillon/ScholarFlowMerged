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
       LIMIT 10`,
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

    // Gather report data — assignees live in task_assignees junction table, not a column on tasks
    let taskQuery = `SELECT t.id, t.title, t.status, t.priority, t.wbs_code, t.due_date,
                            t.progress_percent, t.estimated_hours, t.actual_hours,
                            t.start_date, t.created_at, t.updated_at,
                            u_primary.name as assigned_to_name,
                            array_agg(DISTINCT u.name) FILTER (WHERE u.name IS NOT NULL) as assignee_names
                     FROM tasks t
                     LEFT JOIN users u_primary ON u_primary.id = t.assigned_to
                     LEFT JOIN task_assignees ta ON ta.task_id = t.id
                     LEFT JOIN users u ON u.id = ta.user_id
                     WHERE t.project_id = $1`;
    const taskParams: any[] = [project_id];
    let pCount = 1;

    if (date_range_start) { pCount++; taskQuery += ` AND t.created_at >= $${pCount}`; taskParams.push(date_range_start); }
    if (date_range_end)   { pCount++; taskQuery += ` AND t.created_at <= $${pCount}`; taskParams.push(date_range_end); }

    taskQuery += ` GROUP BY t.id, u_primary.name
                   ORDER BY
                     CASE WHEN t.wbs_code ~ '^\\d+$' THEN t.wbs_code::integer ELSE NULL END NULLS LAST,
                     t.wbs_code NULLS LAST, t.created_at`;

    const tasksResult = await query(taskQuery, taskParams);
    const tasks = tasksResult.rows;

    // For dependency reports fetch the actual links between tasks
    let dependencies: any[] = [];
    if (report_type === 'dependency_report') {
      const depsResult = await query(
        `SELECT td.dependency_type,
                ta.title AS from_title, ta.wbs_code AS from_wbs, ta.status AS from_status,
                tb.title AS to_title,   tb.wbs_code AS to_wbs,   tb.status AS to_status
         FROM task_dependencies td
         JOIN tasks ta ON td.depends_on_task_id = ta.id
         JOIN tasks tb ON td.task_id            = tb.id
         WHERE ta.project_id = $1
         ORDER BY ta.wbs_code NULLS LAST, tb.wbs_code NULLS LAST`,
        [project_id]
      );
      dependencies = depsResult.rows;
    }

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
      data: { tasks, dependencies, title: reportTitle },
      googleDocUrl
    });
  } catch (error: any) {
    logger.error('Error generating report:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

export default router;
