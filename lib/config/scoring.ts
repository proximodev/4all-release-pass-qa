/**
 * Scoring Configuration
 *
 * Controls how test scores are calculated and how pass/fail is determined.
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

/**
 * Get the color category based on score
 * - green: 80-100 (good)
 * - yellow: 50-79 (passing but has issues)
 * - red: 0-49 (failing)
 */
export function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green'
  if (score >= SCORING_CONFIG.passThreshold) return 'yellow'
  return 'red'
}
