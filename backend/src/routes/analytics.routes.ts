import { Router, Response } from 'express';
import { pool } from '../config/database';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../config/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { getTeamSignals, getClassMedians, TeamSignals } from '../services/teamSignals.service';
import { computeHealthScore, HealthResult } from '../services/teamHealth.service';

// Minimum time between Gemini calls even when data hash changes.
// Protects token budget against drag-drop bursts.
const MIN_REFRESH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

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

// Helper: compute a hash of team data so we know when something changed.
// IMPORTANT: Includes per-status counts so any status transition (todo → in_progress,
// in_progress → review, etc.) invalidates the cache, not just completion.
async function computeDataHash(orgId: string): Promise<string> {
    const result = await pool.query(
        `SELECT
       (SELECT COUNT(*) FROM team_groups WHERE organization_id = $1) as teams,
       (SELECT COUNT(*) FROM team_group_members tgm JOIN team_groups tg ON tgm.team_group_id = tg.id WHERE tg.organization_id = $1) as members,
       (SELECT COUNT(*) FROM team_checkpoints tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1)
         + (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1)
         + (SELECT COUNT(*) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1) as checkpoints,
       -- Per-status breakdown (any status transition changes at least two of these)
       (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1 AND t.status IN ('todo', 'pending')) as todo,
       (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1 AND t.status IN ('in_progress', 'in-progress'))
         + (SELECT COUNT(*) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1 AND st.status IN ('in_progress', 'in-progress'))
         + (SELECT COUNT(*) FROM team_checkpoints tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1 AND tc.status = 'in_progress') as in_progress,
       (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1 AND t.status = 'review')
         + (SELECT COUNT(*) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1 AND st.status = 'review') as review,
       (SELECT COUNT(*) FROM team_checkpoints tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1 AND tc.status = 'completed')
         + (SELECT COUNT(*) FROM tasks t JOIN team_groups tg ON t.team_id = tg.id WHERE tg.organization_id = $1 AND t.status IN ('completed', 'done', 'Done'))
         + (SELECT COUNT(*) FROM sheet_tasks st JOIN team_groups tg ON st.team_id = tg.id WHERE tg.organization_id = $1 AND st.status IN ('completed', 'done', 'Done')) as completed,
       (SELECT COUNT(*) FROM team_comments tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1)
         + (SELECT COUNT(*) FROM task_comments c JOIN tasks t ON c.task_id = t.id JOIN team_groups tg ON tg.id = t.team_id WHERE tg.organization_id = $1)
         + (SELECT COUNT(*) FROM task_comments c JOIN sheet_tasks st ON c.task_id = st.id JOIN team_groups tg ON tg.id = st.team_id WHERE tg.organization_id = $1) as comments,
       GREATEST(
         (SELECT MAX(tc.created_at) FROM team_comments tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1),
         (SELECT MAX(c.created_at) FROM task_comments c JOIN tasks t ON c.task_id = t.id JOIN team_groups tg ON tg.id = t.team_id WHERE tg.organization_id = $1),
         (SELECT MAX(c.created_at) FROM task_comments c JOIN sheet_tasks st ON c.task_id = st.id JOIN team_groups tg ON tg.id = st.team_id WHERE tg.organization_id = $1)
       ) as last_comment,
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
            `SELECT (
               (SELECT COUNT(*) FROM team_comments tc
                JOIN team_groups tg ON tc.team_group_id = tg.id
                WHERE tg.organization_id = $1 ${teamFilter})
               +
               (SELECT COUNT(*) FROM task_comments c
                JOIN tasks t ON c.task_id = t.id
                JOIN team_groups tg ON tg.id = t.team_id
                WHERE tg.organization_id = $1 ${teamFilter})
               +
               (SELECT COUNT(*) FROM task_comments c
                JOIN sheet_tasks st ON c.task_id = st.id
                JOIN team_groups tg ON tg.id = st.team_id
                WHERE tg.organization_id = $1 ${teamFilter})
             ) AS count`,
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

        // Recent discussion activity — unions team-level comments AND
        // task/sheet-task comments so discussions inside individual board
        // tasks also show up here.
        const recentActivity = await pool.query(
            `SELECT user_name, content, created_at, team_name, source FROM (
                -- Team-level discussion
                SELECT tc.user_name, tc.content, tc.created_at, tg.name AS team_name, 'team' AS source
                FROM team_comments tc
                JOIN team_groups tg ON tc.team_group_id = tg.id
                WHERE tg.organization_id = $1 ${teamFilter}

                UNION ALL

                -- Task-level discussion (regular tasks)
                SELECT COALESCE(u.name, 'Unknown') AS user_name,
                       c.comment AS content,
                       c.created_at,
                       tg.name AS team_name,
                       'task' AS source
                FROM task_comments c
                LEFT JOIN users u ON c.user_id = u.id
                JOIN tasks t ON c.task_id = t.id
                JOIN team_groups tg ON tg.id = t.team_id
                WHERE tg.organization_id = $1 ${teamFilter}

                UNION ALL

                -- Task-level discussion (sheet tasks)
                SELECT COALESCE(u.name, 'Unknown') AS user_name,
                       c.comment AS content,
                       c.created_at,
                       tg.name AS team_name,
                       'task' AS source
                FROM task_comments c
                LEFT JOIN users u ON c.user_id = u.id
                JOIN sheet_tasks st ON c.task_id = st.id
                JOIN team_groups tg ON tg.id = st.team_id
                WHERE tg.organization_id = $1 ${teamFilter}
            ) AS combined
            ORDER BY created_at DESC
            LIMIT 10`,
            [orgId]
        );

        return res.json({ totalTeams, totalMembers, totalComments, checkpoints, teamsByStatus, teams: teamsBreakdown.rows, recentActivity: recentActivity.rows });
    } catch (err: any) {
        logger.error('Analytics overview error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/analytics/ai-insights ───
// Strategy:
//   1. ALWAYS compute deterministic team signals + health classifications
//      (no AI cost). This fixes the "AI labels wrong" bug — UI always shows
//      correct rankings based on data.
//   2. AI is used ONLY to narrate the classifications (executive summary,
//      per-team prose, focus-this-week). Narrative is cached and debounced.
//   3. Token protection:
//        - Same data_hash → return cached narrative (free)
//        - Hash changed but cache < 10 min old → return cached narrative
//        - Force refresh bypasses the 10-min window but still respects hash
router.get('/analytics/ai-insights', authenticateToken, requireAdviserRole, async (req: AuthRequest, res: Response) => {
    const orgId = req.headers['x-organization-id'] as string;
    const forceRefresh = req.query.refresh === 'true';
    const apiKey = process.env.GEMINI_API_KEY;

    try {
        // ------------------------------------------------------------------
        // Stage A — Deterministic signals + classification (ALWAYS FRESH).
        // ------------------------------------------------------------------
        const signals = await getTeamSignals(orgId);

        if (signals.length === 0) {
            return res.json({
                summary: 'No teams found. Import your class data from ScholarSync to get started.',
                recommendations: [],
                atRiskTeams: [],
                topPerformers: [],
                keyInsight: '',
                class_health: { overall_score: 0, team_count: 0, medians: {} },
                teams: [],
                cached: false,
            });
        }

        const medians = getClassMedians(signals);
        const healthResults: HealthResult[] = signals.map(s => computeHealthScore(s, medians));
        healthResults.sort((a, b) => b.health_score - a.health_score);

        const classAvg = Math.round(
            (healthResults.reduce((sum, h) => sum + h.health_score, 0) / healthResults.length) * 10
        ) / 10;

        // Build backwards-compatible legacy arrays (atRiskTeams, topPerformers)
        // so existing UI keeps rendering. We'll add richer fields alongside.
        const atRiskTeams = healthResults
            .filter(h => h.classification === 'At Risk' || h.classification === 'Watch')
            .map(h => ({
                name: h.name,
                classification: h.classification,
                score: h.health_score,
                reason: h.concerns.slice(0, 2).join('; ') || 'Below class health threshold',
            }));

        // Always surface at least one top performer when teams exist
        const topPerformers = healthResults
            .filter(h => h.classification === 'Top Performer' || h.classification === 'On Track')
            .slice(0, Math.min(3, healthResults.length))
            .map(h => ({
                name: h.name,
                classification: h.classification,
                score: h.health_score,
                reason: h.strengths.slice(0, 2).join('; ') || `Health score ${h.health_score}`,
            }));

        // Fallback: if nothing qualifies, surface the highest-scoring team anyway
        if (topPerformers.length === 0 && healthResults.length > 0) {
            const top = healthResults[0];
            topPerformers.push({
                name: top.name,
                classification: top.classification,
                score: top.health_score,
                reason: `Highest health score in class (${top.health_score})`,
            });
        }

        // ------------------------------------------------------------------
        // Stage B — Narrative (cached, debounced, token-protected).
        // ------------------------------------------------------------------
        const currentHash = await computeDataHash(orgId);

        let narrative: any = null;
        let narrativeCached = false;
        let narrativeGeneratedAt: string | null = null;

        const cached = await pool.query(
            'SELECT insights_json, data_hash, generated_at FROM ai_insights_cache WHERE organization_id = $1',
            [orgId]
        );

        const cachedRow = cached.rows[0];
        const cachedAgeMs = cachedRow
            ? Date.now() - new Date(cachedRow.generated_at).getTime()
            : Infinity;

        const canUseCache = cachedRow &&
            (cachedRow.data_hash === currentHash || cachedAgeMs < MIN_REFRESH_WINDOW_MS) &&
            !forceRefresh;

        if (canUseCache) {
            narrative = cachedRow.insights_json;
            narrativeCached = true;
            narrativeGeneratedAt = cachedRow.generated_at;
        } else if (!apiKey) {
            // No API key → return classifications only with a fallback narrative
            narrative = buildFallbackNarrative(healthResults, medians, classAvg);
        } else {
            // Generate fresh narrative via Gemini
            try {
                narrative = await generateNarrative(apiKey, healthResults, signals, medians, classAvg);
                await pool.query(
                    `INSERT INTO ai_insights_cache (organization_id, insights_json, data_hash, generated_at)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (organization_id) DO UPDATE
                     SET insights_json = $2, data_hash = $3, generated_at = NOW()`,
                    [orgId, JSON.stringify(narrative), currentHash]
                );
                narrativeGeneratedAt = new Date().toISOString();
            } catch (err: any) {
                logger.warn('Gemini narrative failed, using fallback:', err.message);
                narrative = buildFallbackNarrative(healthResults, medians, classAvg);
                if (cachedRow) {
                    narrative = cachedRow.insights_json;
                    narrativeCached = true;
                    narrativeGeneratedAt = cachedRow.generated_at;
                }
            }
        }

        return res.json({
            // Legacy keys (backwards compat)
            summary: narrative?.summary || narrative?.executive_summary || '',
            recommendations: narrative?.recommendations || [],
            atRiskTeams,
            topPerformers,
            keyInsight: narrative?.keyInsight || narrative?.focus_this_week || '',

            // Rich new keys
            class_health: {
                overall_score: classAvg,
                team_count: healthResults.length,
                medians,
            },
            teams: healthResults.map(h => {
                const signal = signals.find(s => s.team_id === h.team_id);
                const teamNarrative = narrative?.teams?.find((t: any) => t.name === h.name);
                return {
                    ...h,
                    narrative: teamNarrative?.narrative || null,
                    signals: signal,
                };
            }),
            executive_summary: narrative?.executive_summary || narrative?.summary || '',
            focus_this_week: narrative?.focus_this_week || narrative?.keyInsight || '',

            cached: narrativeCached,
            generated_at: narrativeGeneratedAt || new Date().toISOString(),
        });
    } catch (err: any) {
        logger.error('AI insights error:', err);
        return res.status(500).json({ error: 'Failed to generate insights: ' + err.message });
    }
});

// ─── POST /api/analytics/ai-insights/feedback ───
// Teacher logs feedback on a classification (correct/incorrect/unsure).
// Used to improve the model over time and suppress repeated false positives.
router.post('/analytics/ai-insights/feedback', authenticateToken, requireAdviserRole, async (req: AuthRequest, res: Response) => {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = req.user?.id;
    const { team_group_id, classification, feedback, notes } = req.body;

    if (!team_group_id || !classification || !feedback) {
        return res.status(400).json({ error: 'team_group_id, classification, and feedback are required' });
    }
    if (!['correct', 'incorrect', 'unsure'].includes(feedback)) {
        return res.status(400).json({ error: 'feedback must be correct, incorrect, or unsure' });
    }

    try {
        await pool.query(
            `INSERT INTO ai_classification_feedback
             (team_group_id, organization_id, user_id, classification, feedback, notes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [team_group_id, orgId, userId, classification, feedback, notes || null]
        );
        return res.json({ success: true });
    } catch (err: any) {
        logger.error('AI feedback error:', err);
        return res.status(500).json({ error: 'Failed to record feedback' });
    }
});

// ─── GET /api/analytics/team-health/trend/:teamId ───
// Returns last 30 days of health snapshots for a team (for sparkline).
router.get('/analytics/team-health/trend/:teamId', authenticateToken, requireAdviserRole, async (req: AuthRequest, res: Response) => {
    const { teamId } = req.params;
    const orgId = req.headers['x-organization-id'] as string;

    try {
        const result = await pool.query(
            `SELECT snapshot_date, health_score, classification, progress_pct,
                    velocity_7d, overdue_count
             FROM team_health_snapshots
             WHERE team_group_id = $1 AND organization_id = $2
               AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
             ORDER BY snapshot_date ASC`,
            [teamId, orgId]
        );
        return res.json({ trend: result.rows });
    } catch (err: any) {
        logger.error('Team health trend error:', err);
        return res.status(500).json({ error: 'Failed to fetch trend' });
    }
});

// ─────────────────────────────────────────────────────────────────────────
// Narrative helpers
// ─────────────────────────────────────────────────────────────────────────

async function generateNarrative(
    apiKey: string,
    health: HealthResult[],
    signals: TeamSignals[],
    medians: any,
    classAvg: number
): Promise<any> {
    const teamBriefs = health.map(h => {
        const s = signals.find(x => x.team_id === h.team_id);
        if (!s) return '';
        return `Team: ${h.name} (#${h.team_number})
  Classification: ${h.classification} | Health: ${h.health_score}/100
  Progress: ${s.overall_progress_pct}% (expected ${s.expected_progress_pct}%, delta ${s.schedule_delta_pct >= 0 ? '+' : ''}${s.schedule_delta_pct})
  Completed: ${s.completed_count}/${s.total_count} | Velocity 7d: ${s.velocity_7d} | Overdue: ${s.overdue_count} | Blocked: ${s.blocked_count}
  Members active 7d: ${s.active_members_7d}/${s.member_count} (${Math.round(s.participation_ratio * 100)}%)
  Discussions: ${s.total_discussions} (team ${s.team_discussions} + task ${s.task_discussions})
  Work concentration: ${Math.round(s.work_concentration * 100)}%
  Strengths: ${h.strengths.join('; ') || 'none flagged'}
  Concerns: ${h.concerns.join('; ') || 'none flagged'}`;
    }).join('\n\n');

    const prompt = `You are a teaching assistant writing performance summaries for a university adviser.
You will NOT change the classifications below — those are computed from hard data.
Your job: translate the data into concise, warm, teacher-friendly prose.

CLASS OVERVIEW
  Teams: ${health.length}
  Class average health score: ${classAvg}/100
  Median progress: ${medians.progress_pct}%
  Median velocity (7d): ${medians.velocity_7d}
  Median discussions: ${medians.discussions}

TEAMS (classifications are FINAL — do not reclassify):
${teamBriefs}

Respond with STRICT JSON only (no markdown fences):
{
  "executive_summary": "2-3 sentence class overview",
  "focus_this_week": "One specific actionable focus for the adviser this week",
  "recommendations": ["rec 1", "rec 2", "rec 3"],
  "teams": [
    { "name": "<team name>", "narrative": "1-2 sentences explaining this team's classification using their actual numbers" }
  ]
}

Rules:
- Every team in TEAMS must appear in "teams" with a narrative
- Narratives must cite at least one concrete number from the brief
- Do NOT contradict the given classification
- Keep each narrative under 40 words
- No markdown, no code fences, valid JSON only`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
}

/**
 * Build a narrative without calling Gemini (used when API key missing or call failed).
 */
function buildFallbackNarrative(health: HealthResult[], medians: any, classAvg: number): any {
    const top = health[0];
    const atRisk = health.filter(h => h.classification === 'At Risk');

    const executive_summary = health.length === 1
        ? `${health[0].name} is currently ${health[0].classification.toLowerCase()} with a health score of ${health[0].health_score}/100.`
        : `Class average health is ${classAvg}/100 across ${health.length} teams. ${top.name} leads at ${top.health_score}/100. ${atRisk.length === 0 ? 'No teams are currently at risk.' : `${atRisk.length} team${atRisk.length === 1 ? '' : 's'} need attention.`}`;

    let focus = 'Review each team\'s progress this week.';
    if (atRisk.length > 0) {
        focus = `Prioritize check-ins with ${atRisk.map(h => h.name).join(' and ')} — ${atRisk[0].concerns[0] || 'at-risk classification'}.`;
    } else if (top && top.classification === 'Top Performer') {
        focus = `Recognize ${top.name}'s momentum and consider sharing their practices with the class.`;
    }

    const recommendations: string[] = [];
    health.forEach(h => h.suggested_actions.forEach(a => {
        if (!recommendations.includes(a)) recommendations.push(a);
    }));

    return {
        executive_summary,
        focus_this_week: focus,
        recommendations: recommendations.slice(0, 5),
        teams: health.map(h => ({
            name: h.name,
            narrative: h.strengths.length > 0
                ? `${h.classification}. ${h.strengths[0]}.`
                : `${h.classification}. ${h.concerns[0] || 'Limited data so far.'}`,
        })),
    };
}

export default router;
