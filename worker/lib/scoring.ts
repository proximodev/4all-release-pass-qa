/**
 * Scoring Configuration for Worker
 *
 * Controls how test scores are calculated and how pass/fail is determined.
 * This should stay in sync with lib/config/scoring.ts in the main app.
 * Post-MVP: These values could move to a database table or project-level settings.
 */

export const SCORING_CONFIG = {
  /**
   * Score threshold for pass/fail determination.
   * score >= passThreshold → PASS
   * score < passThreshold → FAIL
   */
  passThreshold: 50,

  /**
   * Point deductions by severity level.
   * Score starts at 100 and deducts based on failed items.
   */
  severityPenalties: {
    BLOCKER: 40,
    CRITICAL: 20,
    HIGH: 10,
    MEDIUM: 5,
    LOW: 2,
  },
} as const

/**
 * Determine if a score passes the threshold
 */
export function isPassingScore(score: number): boolean {
  return score >= SCORING_CONFIG.passThreshold
}

/**
 * Get the status label based on score
 */
export function getScoreStatus(score: number): 'PASS' | 'FAIL' {
  return isPassingScore(score) ? 'PASS' : 'FAIL'
}
