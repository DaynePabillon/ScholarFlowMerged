/**
 * Nightly Team Health Snapshot Job
 * -----------------------------------------------------------------------------
 * Once per day, writes one row per team to team_health_snapshots so we can
 * show 30-day trend sparklines on the analytics page.
 *
 * Uses setInterval instead of node-cron to avoid a new dependency. The first
 * run happens a few seconds after server startup (to avoid doubling-up on
 * cold start), then every 24 hours. Also runs on-demand via runHealthSnapshotNow().
 *
 * No AI calls — deterministic only.
 */

import { pool } from '../config/database';
import logger from '../config/logger';
import { getTeamSignals, getClassMedians } from '../services/teamSignals.service';
import { computeHealthScore } from '../services/teamHealth.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Run a snapshot for every organization that has teams.
 * Idempotent per day via UNIQUE(team_group_id, snapshot_date).
 */
export async function runHealthSnapshotNow(): Promise<{ orgs: number; teams: number }> {
  try {
    const orgsResult = await pool.query(
      `SELECT DISTINCT organization_id FROM team_groups`
    );

    let totalTeams = 0;
    for (const row of orgsResult.rows) {
      const orgId = row.organization_id;
      try {
        const signals = await getTeamSignals(orgId);
        if (signals.length === 0) continue;

        const medians = getClassMedians(signals);

        for (const s of signals) {
          const health = computeHealthScore(s, medians);
          await pool.query(
            `INSERT INTO team_health_snapshots
               (team_group_id, organization_id, snapshot_date, health_score, classification,
                progress_pct, expected_progress_pct, velocity_7d, velocity_30d,
                overdue_count, blocked_count, discussions_count,
                participation_ratio, work_concentration, score_breakdown)
             VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (team_group_id, snapshot_date) DO UPDATE SET
               health_score = EXCLUDED.health_score,
               classification = EXCLUDED.classification,
               progress_pct = EXCLUDED.progress_pct,
               expected_progress_pct = EXCLUDED.expected_progress_pct,
               velocity_7d = EXCLUDED.velocity_7d,
               velocity_30d = EXCLUDED.velocity_30d,
               overdue_count = EXCLUDED.overdue_count,
               blocked_count = EXCLUDED.blocked_count,
               discussions_count = EXCLUDED.discussions_count,
               participation_ratio = EXCLUDED.participation_ratio,
               work_concentration = EXCLUDED.work_concentration,
               score_breakdown = EXCLUDED.score_breakdown`,
            [
              s.team_id, orgId,
              health.health_score, health.classification,
              s.overall_progress_pct, s.expected_progress_pct,
              s.velocity_7d, s.velocity_30d,
              s.overdue_count, s.blocked_count, s.total_discussions,
              s.participation_ratio, s.work_concentration,
              JSON.stringify(health.breakdown),
            ]
          );
          totalTeams++;
        }
      } catch (err: any) {
        logger.warn(`Snapshot failed for org ${orgId}: ${err.message}`);
      }
    }

    logger.info(`📸 Health snapshot complete: ${orgsResult.rows.length} orgs, ${totalTeams} teams`);
    return { orgs: orgsResult.rows.length, teams: totalTeams };
  } catch (err: any) {
    logger.error('Snapshot job error:', err);
    return { orgs: 0, teams: 0 };
  }
}

/**
 * Schedule the job to run daily.
 * First run: 30 seconds after startup (gives migrations time to finish).
 * Subsequent runs: every 24 hours.
 */
export function startHealthSnapshotJob(): void {
  setTimeout(() => {
    runHealthSnapshotNow();
    setInterval(runHealthSnapshotNow, ONE_DAY_MS);
  }, 30 * 1000);

  logger.info('📅 Team health snapshot job scheduled (first run in 30s, then every 24h)');
}
