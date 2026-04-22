/**
 * Team Signals Service
 * -----------------------------------------------------------------------------
 * Computes rich per-team signals (progress, schedule, engagement, distribution,
 * quality) used by the deterministic health-score classifier and by the AI
 * insights narrator.
 *
 * Everything here is pure SQL + deterministic code — NO AI calls. Safe to run
 * on every analytics page load; no token cost.
 */

import { pool } from '../config/database';
import logger from '../config/logger';

export interface StatusBreakdown {
  todo: number;
  in_progress: number;
  review: number;
  completed: number;
}

export interface PriorityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
  none: number;
}

export interface TeamSignals {
  // Identity
  team_id: string;
  team_number: number;
  team_code: string | null;
  name: string;
  adviser_name: string | null;
  proposed_project: string | null;
  grade: string | null;
  status: string;
  member_count: number;

  // Progress
  total_count: number;
  completed_count: number;
  overall_progress_pct: number;
  velocity_7d: number;
  velocity_30d: number;
  stalled_days: number | null;

  // Schedule
  first_work_created_at: string | null;
  last_due_date: string | null;
  expected_progress_pct: number;
  schedule_delta_pct: number; // actual - expected (positive = ahead)
  overdue_count: number;
  due_next_7_days: number;

  // Engagement
  team_discussions: number;
  task_discussions: number;
  total_discussions: number;
  last_activity_at: string | null;
  active_members_7d: number;
  participation_ratio: number; // 0..1

  // Distribution
  status_breakdown: StatusBreakdown;
  priority_breakdown: PriorityBreakdown;
  work_concentration: number; // 0..1, higher = one person carrying more

  // Quality
  blocked_count: number; // heuristic
  avg_completion_days: number | null;
  rework_count: number;
}

export interface ClassMedians {
  progress_pct: number;
  velocity_7d: number;
  discussions: number;
  overdue_count: number;
  participation_ratio: number;
  team_count: number;
}

/**
 * Compute per-team signals for an organization.
 * Uses a single SQL query to pull all raw work items, then aggregates in JS.
 * This is cheaper than N round-trips and keeps the SQL readable.
 */
export async function getTeamSignals(orgId: string): Promise<TeamSignals[]> {
  try {
    // 1. Pull all teams for the org
    const teamsRes = await pool.query(
      `SELECT tg.id, tg.name, tg.team_number, tg.team_code, tg.adviser_name,
              tg.proposed_project, tg.status, tg.grade,
              (SELECT COUNT(*) FROM team_group_members WHERE team_group_id = tg.id) as member_count
       FROM team_groups tg
       WHERE tg.organization_id = $1
       ORDER BY tg.team_number ASC`,
      [orgId]
    );

    if (teamsRes.rows.length === 0) return [];

    const teamIds = teamsRes.rows.map((t: any) => t.id);

    // 2. Pull all work items (team_checkpoints + tasks + sheet_tasks) in one UNION
    const workRes = await pool.query(
      `SELECT team_id, status, priority, due_date, created_at, updated_at, completed_at,
              assignee_key, source
       FROM (
         -- Team-level checkpoints
         SELECT tc.team_group_id AS team_id,
                CASE WHEN tc.status IN ('completed','done','Done') THEN 'completed'
                     WHEN tc.status IN ('in_progress','in-progress') THEN 'in_progress'
                     WHEN tc.status = 'review' THEN 'review'
                     ELSE 'pending' END AS status,
                'none'::varchar AS priority,
                tc.due_date, tc.created_at, tc.updated_at, tc.completed_at,
                tc.member_id::text AS assignee_key,
                'checkpoint' AS source
         FROM team_checkpoints tc
         WHERE tc.team_group_id = ANY($1::uuid[])

         UNION ALL

         -- Regular tasks assigned to a team
         SELECT t.team_id,
                CASE WHEN t.status IN ('completed','done','Done') THEN 'completed'
                     WHEN t.status IN ('in_progress','in-progress') THEN 'in_progress'
                     WHEN t.status = 'review' THEN 'review'
                     ELSE 'pending' END AS status,
                COALESCE(LOWER(t.priority), 'none') AS priority,
                t.due_date, t.created_at, t.updated_at, t.completed_at,
                COALESCE(t.assigned_to::text, t.assignee_email) AS assignee_key,
                'task' AS source
         FROM tasks t
         WHERE t.team_id = ANY($1::uuid[])

         UNION ALL

         -- Sheet tasks
         SELECT st.team_id,
                CASE WHEN st.status IN ('completed','done','Done') THEN 'completed'
                     WHEN st.status IN ('in_progress','in-progress') THEN 'in_progress'
                     WHEN st.status = 'review' THEN 'review'
                     ELSE 'pending' END AS status,
                COALESCE(LOWER(st.priority), 'none') AS priority,
                st.due_date, st.created_at, st.updated_at,
                -- sheet_tasks has no completed_at column; infer from synced_at when status is completed
                CASE WHEN st.status IN ('completed','done','Done') THEN st.synced_at ELSE NULL END AS completed_at,
                st.assignee_email AS assignee_key,
                'sheet_task' AS source
         FROM sheet_tasks st
         WHERE st.team_id = ANY($1::uuid[])
       ) combined`,
      [teamIds]
    );

    // 3. Pull comments (team-level + task-level) for these teams
    const commentsRes = await pool.query(
      `SELECT team_id, user_key, created_at FROM (
         SELECT tc.team_group_id AS team_id, COALESCE(tc.user_name, tc.user_id::text) AS user_key, tc.created_at
         FROM team_comments tc
         WHERE tc.team_group_id = ANY($1::uuid[])

         UNION ALL

         SELECT t.team_id, COALESCE(u.name, c.user_id::text) AS user_key, c.created_at
         FROM task_comments c
         LEFT JOIN users u ON c.user_id = u.id
         JOIN tasks t ON c.task_id = t.id
         WHERE t.team_id = ANY($1::uuid[])

         UNION ALL

         SELECT st.team_id, COALESCE(u.name, c.user_id::text) AS user_key, c.created_at
         FROM task_comments c
         LEFT JOIN users u ON c.user_id = u.id
         JOIN sheet_tasks st ON c.task_id = st.id
         WHERE st.team_id = ANY($1::uuid[])
       ) combined`,
      [teamIds]
    );

    // Also classify each comment as team- or task-level for breakdown
    const teamCommentsRes = await pool.query(
      `SELECT team_group_id AS team_id FROM team_comments WHERE team_group_id = ANY($1::uuid[])`,
      [teamIds]
    );

    // 4. Pull members for participation ratio
    const membersRes = await pool.query(
      `SELECT tgm.team_group_id AS team_id, tgm.id AS member_id, tgm.user_id, tgm.email
       FROM team_group_members tgm
       WHERE tgm.team_group_id = ANY($1::uuid[])`,
      [teamIds]
    );

    // 5. Aggregate per team
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sevenDaysHence = new Date(now.getTime() + 7 * 86400000);

    const signals: TeamSignals[] = teamsRes.rows.map((team: any) => {
      const teamWork = workRes.rows.filter((w: any) => w.team_id === team.id);
      const teamComments = commentsRes.rows.filter((c: any) => c.team_id === team.id);
      const teamLevelComments = teamCommentsRes.rows.filter((c: any) => c.team_id === team.id);
      const teamMembers = membersRes.rows.filter((m: any) => m.team_id === team.id);

      // --- Progress ---
      const total = teamWork.length;
      const completed = teamWork.filter((w: any) => w.status === 'completed').length;
      const overall_pct = total > 0 ? Math.round((completed / total) * 10000) / 100 : 0;

      const velocity_7d = teamWork.filter((w: any) =>
        w.completed_at && new Date(w.completed_at) >= sevenDaysAgo
      ).length;
      const velocity_30d = teamWork.filter((w: any) =>
        w.completed_at && new Date(w.completed_at) >= thirtyDaysAgo
      ).length;

      const completedDates = teamWork
        .filter((w: any) => w.completed_at)
        .map((w: any) => new Date(w.completed_at).getTime());
      const lastCompletedAt = completedDates.length > 0 ? Math.max(...completedDates) : null;
      const stalled_days = lastCompletedAt
        ? Math.floor((now.getTime() - lastCompletedAt) / 86400000)
        : null;

      // --- Schedule ---
      const createdTimestamps = teamWork.map((w: any) => new Date(w.created_at).getTime());
      const first_created = createdTimestamps.length > 0 ? Math.min(...createdTimestamps) : null;
      const dueDates = teamWork
        .filter((w: any) => w.due_date)
        .map((w: any) => new Date(w.due_date).getTime());
      const last_due = dueDates.length > 0 ? Math.max(...dueDates) : null;

      let expected_pct = 0;
      if (first_created && last_due && last_due > first_created) {
        const elapsed = now.getTime() - first_created;
        const span = last_due - first_created;
        expected_pct = Math.max(0, Math.min(100, Math.round((elapsed / span) * 10000) / 100));
      } else if (first_created) {
        // No due dates → assume 12-week default span from first activity
        const span = 12 * 7 * 86400000;
        const elapsed = now.getTime() - first_created;
        expected_pct = Math.max(0, Math.min(100, Math.round((elapsed / span) * 10000) / 100));
      }

      const overdue_count = teamWork.filter((w: any) =>
        w.due_date &&
        new Date(w.due_date) < now &&
        w.status !== 'completed'
      ).length;

      const due_next_7 = teamWork.filter((w: any) =>
        w.due_date &&
        new Date(w.due_date) >= now &&
        new Date(w.due_date) <= sevenDaysHence &&
        w.status !== 'completed'
      ).length;

      // --- Engagement ---
      const team_discussions = teamLevelComments.length;
      const task_discussions = teamComments.length - team_discussions;
      const allActivityTimes: number[] = [
        ...teamComments.map((c: any) => new Date(c.created_at).getTime()),
        ...teamWork.map((w: any) => new Date(w.updated_at).getTime()),
      ];
      const last_activity_ts = allActivityTimes.length > 0 ? Math.max(...allActivityTimes) : null;

      // Active members in last 7 days: members whose assignee_key appears as completer OR commenter
      const activeKeys = new Set<string>();
      teamWork.forEach((w: any) => {
        if (w.completed_at && new Date(w.completed_at) >= sevenDaysAgo && w.assignee_key) {
          activeKeys.add(String(w.assignee_key).toLowerCase());
        }
      });
      teamComments.forEach((c: any) => {
        if (new Date(c.created_at) >= sevenDaysAgo && c.user_key) {
          activeKeys.add(String(c.user_key).toLowerCase());
        }
      });
      // Count members whose user_id OR email matches any active key
      const active_members_7d = teamMembers.filter((m: any) => {
        const keys = [m.user_id, m.member_id, m.email].filter(Boolean).map((x: any) => String(x).toLowerCase());
        return keys.some(k => activeKeys.has(k));
      }).length;
      const participation_ratio = teamMembers.length > 0
        ? Math.round((active_members_7d / teamMembers.length) * 1000) / 1000
        : 0;

      // --- Distribution ---
      const status_breakdown: StatusBreakdown = { todo: 0, in_progress: 0, review: 0, completed: 0 };
      const priority_breakdown: PriorityBreakdown = { critical: 0, high: 0, medium: 0, low: 0, none: 0 };
      teamWork.forEach((w: any) => {
        const s = w.status as keyof StatusBreakdown;
        if (s === 'completed' || s === 'in_progress' || s === 'review') status_breakdown[s]++;
        else status_breakdown.todo++;

        const p = (w.priority || 'none') as keyof PriorityBreakdown;
        if (p in priority_breakdown) priority_breakdown[p]++;
        else priority_breakdown.none++;
      });

      // Work concentration: max assignee load / total assigned tasks
      const assignedWork = teamWork.filter((w: any) => w.assignee_key);
      const assigneeCounts = new Map<string, number>();
      assignedWork.forEach((w: any) => {
        const k = String(w.assignee_key).toLowerCase();
        assigneeCounts.set(k, (assigneeCounts.get(k) || 0) + 1);
      });
      const maxAssigneeCount = assigneeCounts.size > 0 ? Math.max(...assigneeCounts.values()) : 0;
      const work_concentration = assignedWork.length > 0
        ? Math.round((maxAssigneeCount / assignedWork.length) * 1000) / 1000
        : 0;

      // --- Quality ---
      // Blocked heuristic: in_progress, updated_at older than 7 days
      const blocked_count = teamWork.filter((w: any) =>
        w.status === 'in_progress' &&
        w.updated_at &&
        new Date(w.updated_at) < sevenDaysAgo
      ).length;

      // Avg completion days: (completed_at - created_at) avg
      const completionDays = teamWork
        .filter((w: any) => w.completed_at && w.created_at)
        .map((w: any) => (new Date(w.completed_at).getTime() - new Date(w.created_at).getTime()) / 86400000)
        .filter((d: number) => d >= 0);
      const avg_completion_days = completionDays.length > 0
        ? Math.round((completionDays.reduce((a: number, b: number) => a + b, 0) / completionDays.length) * 10) / 10
        : null;

      // Rework: not directly tracked → 0 for now (future: activity_log diffing)
      const rework_count = 0;

      return {
        team_id: team.id,
        team_number: team.team_number,
        team_code: team.team_code,
        name: team.name,
        adviser_name: team.adviser_name,
        proposed_project: team.proposed_project,
        grade: team.grade,
        status: team.status,
        member_count: parseInt(team.member_count),

        total_count: total,
        completed_count: completed,
        overall_progress_pct: overall_pct,
        velocity_7d,
        velocity_30d,
        stalled_days,

        first_work_created_at: first_created ? new Date(first_created).toISOString() : null,
        last_due_date: last_due ? new Date(last_due).toISOString() : null,
        expected_progress_pct: expected_pct,
        schedule_delta_pct: Math.round((overall_pct - expected_pct) * 100) / 100,
        overdue_count,
        due_next_7_days: due_next_7,

        team_discussions,
        task_discussions,
        total_discussions: team_discussions + task_discussions,
        last_activity_at: last_activity_ts ? new Date(last_activity_ts).toISOString() : null,
        active_members_7d,
        participation_ratio,

        status_breakdown,
        priority_breakdown,
        work_concentration,

        blocked_count,
        avg_completion_days,
        rework_count,
      };
    });

    return signals;
  } catch (err: any) {
    logger.error('getTeamSignals error:', err);
    throw err;
  }
}

/**
 * Compute class-wide medians used for normalization in the health score.
 */
export function getClassMedians(signals: TeamSignals[]): ClassMedians {
  if (signals.length === 0) {
    return {
      progress_pct: 0,
      velocity_7d: 0,
      discussions: 0,
      overdue_count: 0,
      participation_ratio: 0,
      team_count: 0,
    };
  }

  const median = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  return {
    progress_pct: median(signals.map(s => s.overall_progress_pct)),
    velocity_7d: median(signals.map(s => s.velocity_7d)),
    discussions: median(signals.map(s => s.total_discussions)),
    overdue_count: median(signals.map(s => s.overdue_count)),
    participation_ratio: median(signals.map(s => s.participation_ratio)),
    team_count: signals.length,
  };
}
