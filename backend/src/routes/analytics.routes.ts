import { Router, Response } from 'express';
import { pool } from '../config/database';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../config/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Middleware to check role (admin/manager only, NOT students/members)
const requireAdviserRole = async (req: AuthRequest, res: Response, next: any) => {
    const userId = req.user?.id;
    const orgId = req.headers['x-organization-id'] as string;

    if (!userId || !orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const memberResult = await pool.query(
            'SELECT role FROM organization_members WHERE user_id = $1 AND organization_id = $2',
            [userId, orgId]
        );
        const role = memberResult.rows[0]?.role;
        if (!role || role === 'member') {
            return res.status(403).json({ error: 'Analytics is available for adviser, managers, and admins only.' });
        }
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Failed to verify role' });
    }
};

// Helper: compute a hash of team data so we know when something changed
async function computeDataHash(orgId: string): Promise<string> {
    const result = await pool.query(
        `SELECT
       (SELECT COUNT(*) FROM team_groups WHERE organization_id = $1) as teams,
       (SELECT COUNT(*) FROM team_group_members tgm JOIN team_groups tg ON tgm.team_group_id = tg.id WHERE tg.organization_id = $1) as members,
       (SELECT COUNT(*) FROM team_checkpoints tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1)
         + (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1)
         + (SELECT COUNT(*) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1) as checkpoints,
       (SELECT COUNT(*) FROM team_checkpoints tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1 AND tc.status = 'completed')
         + (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1 AND t.status IN ('completed', 'done', 'Done'))
         + (SELECT COUNT(*) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1 AND st.status IN ('completed', 'done', 'Done')) as completed,
       (SELECT COUNT(*) FROM team_comments tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1) as comments,
       (SELECT MAX(tc.created_at) FROM team_comments tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1) as last_comment,
       GREATEST(
         (SELECT MAX(tc.updated_at) FROM team_checkpoints tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1),
         (SELECT MAX(t.updated_at) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1),
         (SELECT MAX(st.updated_at) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1)
       ) as last_checkpoint`,
        [orgId]
    );
    const raw = JSON.stringify(result.rows[0]);
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

// ─── GET /api/analytics/overview ───
router.get('/analytics/overview', authenticateToken, async (req: AuthRequest, res: Response) => {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = req.user?.id;

    try {
        // Check user role
        const memberResult = await pool.query(
            'SELECT role FROM organization_members WHERE user_id = $1 AND organization_id = $2',
            [userId, orgId]
        );
        const userRole = memberResult.rows[0]?.role;

        // For members, find their team
        let teamFilter = '';
        if (userRole === 'member') {
            const teamResult = await pool.query(
                `SELECT tgm.team_group_id 
                 FROM team_group_members tgm 
                 JOIN team_groups tg ON tgm.team_group_id = tg.id 
                 WHERE (tgm.user_id = $1 OR LOWER(tgm.email) = (SELECT LOWER(email) FROM users WHERE id = $1))
                   AND tg.organization_id = $2 
                 LIMIT 1`,
                [userId, orgId]
            );
            
            const memberTeamId = teamResult.rows[0]?.team_group_id;
            if (memberTeamId) {
                teamFilter = `AND tg.id = '${memberTeamId}'`;
            } else {
                // IMPORTANT: If student has no team, they should see NOTHING, not everything.
                teamFilter = `AND tg.id = '00000000-0000-0000-0000-000000000000'`;
            }
        }

        const totalTeams = parseInt((await pool.query(
            `SELECT COUNT(*) as count FROM team_groups tg WHERE tg.organization_id = $1 ${teamFilter}`,
            [orgId]
        )).rows[0].count);

        const totalMembers = parseInt((await pool.query(
            `SELECT COUNT(*) as count FROM team_group_members tgm 
             JOIN team_groups tg ON tgm.team_group_id = tg.id 
             WHERE tg.organization_id = $1 ${teamFilter}`,
            [orgId]
        )).rows[0].count);

        const checkpointsResult = await pool.query(
            `SELECT 
             (SELECT COUNT(*) FROM team_checkpoints tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1 ${teamFilter})
              + (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1 ${teamFilter})
              + (SELECT COUNT(*) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1 ${teamFilter}) as total,
             (SELECT COUNT(*) FROM team_checkpoints tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1 ${teamFilter} AND tc.status = 'completed')
              + (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1 ${teamFilter} AND t.status IN ('completed', 'done', 'Done'))
              + (SELECT COUNT(*) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1 ${teamFilter} AND st.status IN ('completed', 'done', 'Done')) as completed,
             (SELECT COUNT(*) FROM team_checkpoints tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1 ${teamFilter} AND tc.status = 'in_progress')
              + (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1 ${teamFilter} AND t.status IN ('in_progress', 'in-progress'))
              + (SELECT COUNT(*) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1 ${teamFilter} AND st.status IN ('in_progress', 'in-progress')) as in_progress,
             (SELECT COUNT(*) FROM team_checkpoints tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1 ${teamFilter} AND tc.status = 'pending')
              + (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1 ${teamFilter} AND t.status NOT IN ('completed', 'done', 'Done', 'in_progress', 'in-progress'))
              + (SELECT COUNT(*) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1 ${teamFilter} AND st.status NOT IN ('completed', 'done', 'Done', 'in_progress', 'in-progress')) as pending`,
            [orgId]
        );
        const checkpoints = {
            total: parseInt(checkpointsResult.rows[0].total),
            completed: parseInt(checkpointsResult.rows[0].completed),
            in_progress: parseInt(checkpointsResult.rows[0].in_progress),
            pending: parseInt(checkpointsResult.rows[0].pending),
        };

        const totalComments = parseInt((await pool.query(
            `SELECT COUNT(*) as count FROM team_comments tc 
             JOIN team_groups tg ON tc.team_group_id = tg.id 
             WHERE tg.organization_id = $1 ${teamFilter}`,
            [orgId]
        )).rows[0].count);

        const teamsBreakdown = await pool.query(
            `SELECT tg.id, tg.name, tg.team_number, tg.adviser_name, tg.proposed_project, tg.status, tg.grade,
         (SELECT COUNT(*) FROM team_group_members WHERE team_group_id = tg.id) as member_count,
         (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id)
           + (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id)
           + (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id) as total_checkpoints,
         (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id AND status = 'completed')
           + (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id AND status IN ('completed', 'done', 'Done'))
           + (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id AND status IN ('completed', 'done', 'Done')) as completed_checkpoints,
         (SELECT COUNT(*) FROM team_comments WHERE team_group_id = tg.id) as comment_count
       FROM team_groups tg WHERE tg.organization_id = $1 ${teamFilter} ORDER BY tg.team_number`,
            [orgId]
        );

        const statusBreakdown = await pool.query(
            `SELECT status, COUNT(*) as count FROM team_groups tg WHERE tg.organization_id = $1 ${teamFilter} GROUP BY status`, [orgId]
        );
        const teamsByStatus: Record<string, number> = {};
        statusBreakdown.rows.forEach((r: any) => { teamsByStatus[r.status] = parseInt(r.count); });

        const recentActivity = await pool.query(
            `SELECT tc.user_name, tc.content, tc.created_at, tg.name as team_name
       FROM team_comments tc JOIN team_groups tg ON tc.team_group_id = tg.id
       WHERE tg.organization_id = $1 ${teamFilter} ORDER BY tc.created_at DESC LIMIT 10`, [orgId]
        );

        return res.json({ totalTeams, totalMembers, totalComments, checkpoints, teamsByStatus, teams: teamsBreakdown.rows, recentActivity: recentActivity.rows });
    } catch (err: any) {
        logger.error('Analytics overview error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/analytics/ai-insights ───
// Uses caching: only calls Gemini when data has actually changed
router.get('/analytics/ai-insights', authenticateToken, requireAdviserRole, async (req: AuthRequest, res: Response) => {
    const orgId = req.headers['x-organization-id'] as string;
    const forceRefresh = req.query.refresh === 'true';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    try {
        // 1. Compute hash of current data
        const currentHash = await computeDataHash(orgId);

        // 2. Check cache (unless force refresh)
        if (!forceRefresh) {
            const cached = await pool.query(
                'SELECT insights_json, data_hash, generated_at FROM ai_insights_cache WHERE organization_id = $1',
                [orgId]
            );
            if (cached.rows.length > 0 && cached.rows[0].data_hash === currentHash) {
                // Data hasn't changed → return cached insights
                return res.json({
                    ...cached.rows[0].insights_json,
                    cached: true,
                    generated_at: cached.rows[0].generated_at,
                });
            }
        }

        // 3. Data changed or no cache → call Gemini
        const teamsData = await pool.query(
            `SELECT tg.name, tg.team_number, tg.adviser_name, tg.proposed_project, tg.status, tg.grade,
         (SELECT COUNT(*) FROM team_group_members WHERE team_group_id = tg.id) as member_count,
         (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id)
           + (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id)
           + (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id) as total_checkpoints,
         (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id AND status = 'completed')
           + (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id AND status IN ('completed', 'done', 'Done'))
           + (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id AND status IN ('completed', 'done', 'Done')) as completed_checkpoints,
         (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id AND status = 'pending')
           + (SELECT COUNT(*) FROM tasks WHERE team_id = tg.id AND status NOT IN ('completed', 'done', 'Done', 'in_progress', 'in-progress'))
           + (SELECT COUNT(*) FROM sheet_tasks WHERE team_id = tg.id AND status NOT IN ('completed', 'done', 'Done', 'in_progress', 'in-progress')) as pending_checkpoints,
         (SELECT COUNT(*) FROM team_comments WHERE team_group_id = tg.id) as comment_count,
         (SELECT MAX(created_at) FROM team_comments WHERE team_group_id = tg.id) as last_comment_date
       FROM team_groups tg WHERE tg.organization_id = $1 ORDER BY tg.team_number`, [orgId]
        );

        if (teamsData.rows.length === 0) {
            return res.json({
                summary: 'No teams found. Import your class data from ScholarSync to get started.',
                recommendations: [], atRiskTeams: [], topPerformers: [], keyInsight: '', cached: false,
            });
        }

        const teamSummaries = teamsData.rows.map((t: any) => {
            const progress = t.total_checkpoints > 0 ? Math.round((t.completed_checkpoints / t.total_checkpoints) * 100) : 0;
            return `- ${t.name}: ${t.member_count} members, ${progress}% progress (${t.completed_checkpoints}/${t.total_checkpoints}), ${t.comment_count} discussions, project: "${t.proposed_project || 'None'}", grade: "${t.grade || 'Not graded'}", last active: ${t.last_comment_date || 'Never'}`;
        }).join('\n');

        const prompt = `You are an AI assistant helping a university teacher analyze team performance in SkyFlow.

Data for ${teamsData.rows.length} teams:
${teamSummaries}

Respond with JSON only:
{
  "summary": "2-3 sentence performance summary",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "atRiskTeams": [{"name": "name", "reason": "why"}],
  "topPerformers": [{"name": "name", "reason": "why"}],
  "keyInsight": "One key focus for this week"
}

Rules: Be concise, actionable. Focus on checkpoints, discussions, and projects. JSON only, no markdown.`;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        let parsed: any;
        try {
            const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch {
            parsed = { summary: text, recommendations: [], atRiskTeams: [], topPerformers: [], keyInsight: '' };
        }

        // 4. Save to cache (upsert)
        await pool.query(
            `INSERT INTO ai_insights_cache (organization_id, insights_json, data_hash, generated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (organization_id) DO UPDATE SET insights_json = $2, data_hash = $3, generated_at = NOW()`,
            [orgId, JSON.stringify(parsed), currentHash]
        );

        return res.json({ ...parsed, cached: false, generated_at: new Date().toISOString() });
    } catch (err: any) {
        logger.error('AI insights error:', err);
        return res.status(500).json({ error: 'Failed to generate AI insights: ' + err.message });
    }
});

export default router;
