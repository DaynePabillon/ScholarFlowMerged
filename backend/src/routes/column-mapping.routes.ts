import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

const VALID_KANBAN_COLUMNS = ['todo', 'in_progress', 'review', 'done', 'blocked'];

// GET /api/column-mappings?project_id=&synced_sheet_id=
router.get('/column-mappings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id, synced_sheet_id } = req.query;

    if (!project_id && !synced_sheet_id) {
      return res.status(400).json({ error: 'project_id or synced_sheet_id is required' });
    }

    const whereField = synced_sheet_id ? 'synced_sheet_id' : 'project_id';
    const whereValue = synced_sheet_id || project_id;

    const result = await query(
      `SELECT cm.*, u.name as created_by_name
       FROM column_mappings cm
       LEFT JOIN users u ON cm.created_by = u.id
       WHERE cm.${whereField} = $1 AND cm.is_active = true
       ORDER BY cm.created_at DESC`,
      [whereValue]
    );

    res.json({ mappings: result.rows });
  } catch (error) {
    logger.error('Error fetching column mappings:', error);
    res.status(500).json({ error: 'Failed to fetch column mappings' });
  }
});

// POST /api/column-mappings — upsert a set of mappings
router.post('/column-mappings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id, synced_sheet_id, mappings } = req.body;
    const userId = req.user!.id;

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ error: 'mappings array is required' });
    }

    // Validate mappings
    const errors: string[] = [];
    const seenSheetCols = new Set<string>();
    const seenKanbanCols = new Set<string>();

    for (const m of mappings) {
      if (!m.sheet_column || !m.kanban_column) {
        errors.push(`Missing sheet_column or kanban_column in mapping`);
        continue;
      }
      if (!VALID_KANBAN_COLUMNS.includes(m.kanban_column)) {
        errors.push(`"${m.kanban_column}" is not a valid Kanban column`);
      }
      if (seenSheetCols.has(m.sheet_column)) {
        errors.push(`Duplicate sheet column: "${m.sheet_column}"`);
      }
      if (seenKanbanCols.has(m.kanban_column)) {
        errors.push(`Duplicate Kanban target column: "${m.kanban_column}"`);
      }
      seenSheetCols.add(m.sheet_column);
      seenKanbanCols.add(m.kanban_column);
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const saved = [];
    for (const m of mappings) {
      const result = await query(
        `INSERT INTO column_mappings (synced_sheet_id, project_id, sheet_column, kanban_column, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (synced_sheet_id, sheet_column) DO UPDATE
           SET kanban_column = EXCLUDED.kanban_column,
               updated_at = NOW(),
               is_active = true
         RETURNING *`,
        [synced_sheet_id || null, project_id || null, m.sheet_column, m.kanban_column, userId]
      );
      saved.push(result.rows[0]);
    }

    res.status(201).json({ mappings: saved });
  } catch (error) {
    logger.error('Error saving column mappings:', error);
    res.status(500).json({ error: 'Failed to save column mappings' });
  }
});

// DELETE /api/column-mappings/:id
router.delete('/column-mappings/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE column_mappings SET is_active = false WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting column mapping:', error);
    res.status(500).json({ error: 'Failed to delete column mapping' });
  }
});

export default router;
