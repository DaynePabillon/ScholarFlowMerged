/**
 * Team Health Service
 * -----------------------------------------------------------------------------
 * Deterministic health scoring — NO AI, NO token cost. Runs on every page
 * load; the AI is only used to *narrate* these classifications.
 *
 * health_score (0-100) =
 *    0.40 * schedule_fit        (progress vs expected timeline)
 *  + 0.20 * momentum            (recent velocity vs class median)
 *  + 0.15 * discipline          (1 - overdue ratio)
 *  + 0.10 * engagement          (participation_ratio)
 *  + 0.10 * distribution        (1 - work concentration)
 *  + 0.05 * collaboration       (discussions vs class median)
 */

import { TeamSignals, ClassMedians } from './teamSignals.service';

export type Classification = 'Top Performer' | 'On Track' | 'Watch' | 'At Risk';

export interface ScoreBreakdown {
  schedule_fit: number;     // 0..100
  momentum: number;          // 0..100
  discipline: number;        // 0..100
  engagement: number;        // 0..100
  distribution: number;      // 0..100
  collaboration: number;     // 0..100
}

export interface HealthResult {
  team_id: string;
  name: string;
  team_number: number;
  health_score: number;            // 0..100
  classification: Classification;
  breakdown: ScoreBreakdown;
  weighted_breakdown: ScoreBreakdown; // each * weight, summed = health_score
  strengths: string[];
  concerns: string[];
  suggested_actions: string[];
}

const WEIGHTS = {
  schedule_fit: 0.40,
  momentum: 0.20,
  discipline: 0.15,
  engagement: 0.10,
  distribution: 0.10,
  collaboration: 0.05,
};

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

/**
 * Compute a health score + classification for a team using its signals and
 * class-wide medians for comparative normalization.
 */
export function computeHealthScore(
  s: TeamSignals,
  medians: ClassMedians
): HealthResult {
  // -------------------------------------------------------------------------
  // 1. Schedule fit (40%)
  //    Maps schedule_delta_pct (actual - expected) to 0-100.
  //    -30 or worse → 0, 0 → 70 (on pace), +30 or better → 100.
  // -------------------------------------------------------------------------
  const delta = s.schedule_delta_pct;
  const schedule_fit = clamp(70 + delta); // delta of -70 → 0, -20 → 50, +30 → 100

  // -------------------------------------------------------------------------
  // 2. Momentum (20%)
  //    Compare velocity_7d to class median. 0 = no momentum, above median = 80+.
  //    Bonus for recency: low stalled_days boosts momentum.
  // -------------------------------------------------------------------------
  let momentum = 0;
  if (medians.velocity_7d > 0) {
    momentum = clamp((s.velocity_7d / Math.max(medians.velocity_7d, 1)) * 60);
  } else if (s.velocity_7d > 0) {
    // No class baseline but this team completed something → give credit
    momentum = 60;
  }
  // Stalled penalty: subtract up to 40 if stalled for a long time
  if (s.stalled_days !== null) {
    const stallPenalty = clamp(s.stalled_days * 2, 0, 40);
    momentum = clamp(momentum - stallPenalty);
  } else if (s.total_count > 0) {
    // Never completed anything despite having work → zero momentum
    momentum = 0;
  } else {
    // No work yet → neutral
    momentum = 50;
  }

  // -------------------------------------------------------------------------
  // 3. Discipline (15%) — on-time behavior.
  //    Penalizes overdue tasks relative to total.
  // -------------------------------------------------------------------------
  const overdueRatio = s.total_count > 0 ? s.overdue_count / s.total_count : 0;
  const discipline = clamp(100 - overdueRatio * 100 * 2); // 50% overdue → 0

  // -------------------------------------------------------------------------
  // 4. Engagement (10%) — % of members active in last 7 days.
  // -------------------------------------------------------------------------
  const engagement = clamp(s.participation_ratio * 100);

  // -------------------------------------------------------------------------
  // 5. Distribution (10%) — lower concentration is healthier.
  //    If no tasks assigned yet, neutral 50.
  // -------------------------------------------------------------------------
  let distribution = 50;
  if (s.member_count > 1 && s.total_count > 0) {
    // Ideal concentration = 1/member_count (even split). Penalize above that.
    const ideal = 1 / s.member_count;
    const excess = Math.max(0, s.work_concentration - ideal);
    distribution = clamp(100 - excess * 150); // excess of 0.67 → 0
  }

  // -------------------------------------------------------------------------
  // 6. Collaboration (5%) — discussions vs median.
  // -------------------------------------------------------------------------
  let collaboration = 0;
  if (medians.discussions > 0) {
    collaboration = clamp((s.total_discussions / Math.max(medians.discussions, 1)) * 70);
  } else if (s.total_discussions > 0) {
    collaboration = 70;
  } else {
    // No discussions in class at all → don't punish
    collaboration = 50;
  }

  const breakdown: ScoreBreakdown = {
    schedule_fit: Math.round(schedule_fit * 10) / 10,
    momentum: Math.round(momentum * 10) / 10,
    discipline: Math.round(discipline * 10) / 10,
    engagement: Math.round(engagement * 10) / 10,
    distribution: Math.round(distribution * 10) / 10,
    collaboration: Math.round(collaboration * 10) / 10,
  };

  const weighted_breakdown: ScoreBreakdown = {
    schedule_fit: Math.round(breakdown.schedule_fit * WEIGHTS.schedule_fit * 10) / 10,
    momentum: Math.round(breakdown.momentum * WEIGHTS.momentum * 10) / 10,
    discipline: Math.round(breakdown.discipline * WEIGHTS.discipline * 10) / 10,
    engagement: Math.round(breakdown.engagement * WEIGHTS.engagement * 10) / 10,
    distribution: Math.round(breakdown.distribution * WEIGHTS.distribution * 10) / 10,
    collaboration: Math.round(breakdown.collaboration * WEIGHTS.collaboration * 10) / 10,
  };

  const health_score = Math.round(
    (weighted_breakdown.schedule_fit +
      weighted_breakdown.momentum +
      weighted_breakdown.discipline +
      weighted_breakdown.engagement +
      weighted_breakdown.distribution +
      weighted_breakdown.collaboration) * 10
  ) / 10;

  const classification = classify(health_score);
  const { strengths, concerns, suggested_actions } = deriveInsights(s, breakdown, medians);

  return {
    team_id: s.team_id,
    name: s.name,
    team_number: s.team_number,
    health_score,
    classification,
    breakdown,
    weighted_breakdown,
    strengths,
    concerns,
    suggested_actions,
  };
}

/**
 * Classify a team based on numeric health score.
 */
export function classify(score: number): Classification {
  if (score >= 75) return 'Top Performer';
  if (score >= 50) return 'On Track';
  if (score >= 30) return 'Watch';
  return 'At Risk';
}

/**
 * Generate human-readable strengths, concerns, and suggested actions
 * directly from the signals — no AI needed. The AI will later polish these
 * into prose, but the underlying logic is deterministic and auditable.
 */
function deriveInsights(
  s: TeamSignals,
  b: ScoreBreakdown,
  medians: ClassMedians
): { strengths: string[]; concerns: string[]; suggested_actions: string[] } {
  const strengths: string[] = [];
  const concerns: string[] = [];
  const suggested_actions: string[] = [];

  // Progress signals
  if (s.overall_progress_pct >= 60) {
    strengths.push(`${s.overall_progress_pct}% overall progress (${s.completed_count}/${s.total_count} completed)`);
  }
  if (s.schedule_delta_pct > 10) {
    strengths.push(`Ahead of schedule by ${s.schedule_delta_pct.toFixed(0)} percentage points`);
  } else if (s.schedule_delta_pct < -10) {
    concerns.push(`Behind schedule by ${Math.abs(s.schedule_delta_pct).toFixed(0)} percentage points`);
    suggested_actions.push('Schedule a check-in to identify blockers and adjust deadlines if needed.');
  }

  // Momentum signals
  if (s.velocity_7d >= 3) {
    strengths.push(`Strong recent momentum — ${s.velocity_7d} completions in the last 7 days`);
  } else if (s.velocity_7d === 0 && s.total_count > 0 && s.overall_progress_pct < 100) {
    if (s.stalled_days !== null && s.stalled_days > 14) {
      concerns.push(`No completions in the last ${s.stalled_days} days`);
      suggested_actions.push('Reach out directly — team appears stalled.');
    } else {
      concerns.push('No completions in the last 7 days');
    }
  }

  // Discipline signals
  if (s.overdue_count > 0) {
    concerns.push(`${s.overdue_count} overdue task${s.overdue_count === 1 ? '' : 's'}`);
    suggested_actions.push('Review overdue items in the kanban board and reprioritize.');
  }
  if (s.due_next_7_days >= 3) {
    concerns.push(`${s.due_next_7_days} tasks due in the next 7 days`);
  }

  // Engagement signals
  if (s.participation_ratio >= 0.8) {
    strengths.push(`${Math.round(s.participation_ratio * 100)}% of members active this week`);
  } else if (s.participation_ratio < 0.5 && s.member_count > 1) {
    concerns.push(`Only ${s.active_members_7d}/${s.member_count} members active in the last 7 days`);
    suggested_actions.push('Identify inactive members and check in with them individually.');
  }

  // Distribution signals
  if (s.work_concentration > 0.6 && s.member_count > 1 && s.total_count > 3) {
    concerns.push(`Work is concentrated on one member (${Math.round(s.work_concentration * 100)}% of assigned tasks)`);
    suggested_actions.push('Redistribute tasks across the team to avoid burnout.');
  }

  // Collaboration signals
  if (s.total_discussions === 0 && s.total_count >= 5) {
    concerns.push('No discussions yet — team may not be communicating decisions');
    suggested_actions.push('Encourage posting progress updates or blockers in the team discussion.');
  } else if (s.total_discussions >= Math.max(medians.discussions * 2, 5)) {
    strengths.push(`Active discussion (${s.total_discussions} messages across team + task threads)`);
  }

  // Blocked items
  if (s.blocked_count > 0) {
    concerns.push(`${s.blocked_count} task${s.blocked_count === 1 ? '' : 's'} appear${s.blocked_count === 1 ? 's' : ''} blocked (in-progress for >7 days with no activity)`);
    suggested_actions.push('Review stuck in-progress tasks with the team.');
  }

  return { strengths, concerns, suggested_actions };
}
