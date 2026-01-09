/**
 * Scoring Configuration (App)
 *
 * Controls how test scores are calculated and how pass/fail is determined.
 *
 * Configuration is imported from shared/scoring-config.json.
 * Color values are defined in globals.css via CSS variables.
 *
 * This file contains:
 * - Config imports (thresholds, penalties)
 * - UI helpers (badge class functions)
 *
 * Post-MVP: Thresholds could move to database for per-project settings.
 */

import sharedConfig from '@/shared/scoring-config.json'

/**
 * Tailwind safelist - ensures these dynamic classes are included in build.
 * @see https://tailwindcss.com/docs/content-configuration#safelisting-classes
 *
 * bg-score-green bg-score-yellow bg-score-red
 * text-white text-black
 */

export const SCORING_CONFIG = {
  passThreshold: sharedConfig.scoring.passThreshold,
  colorThresholds: sharedConfig.scoring.colorThresholds,
  severityPenalties: sharedConfig.scoring.severityPenalties,
} as const

/**
 * Severity sort order derived from penalties.
 * Higher penalty = more severe = lower sort index (sorts first).
 */
export const SEVERITY_SORT_ORDER: Record<string, number> = Object.fromEntries(
  Object.entries(sharedConfig.scoring.severityPenalties)
    .sort(([, a], [, b]) => b - a)
    .map(([severity], index) => [severity, index])
)

/**
 * Get sort order for a severity level.
 * Lower number = more severe = sorts first.
 * Unknown severities sort to the end.
 */
export function getSeveritySortOrder(severity: string | undefined | null): number {
  if (!severity) return 999
  return SEVERITY_SORT_ORDER[severity.toUpperCase()] ?? 999
}

/**
 * Badge styling configuration.
 * Uses CSS variable-based Tailwind classes defined in globals.css.
 */
export const SCORE_BADGE_STYLES = {
  green: { bg: 'bg-score-green', text: 'text-white' },
  yellow: { bg: 'bg-score-yellow', text: 'text-black' },
  red: { bg: 'bg-score-red', text: 'text-white' },
} as const

export const STATUS_BADGE_STYLES = {
  pass: { bg: 'bg-score-green', text: 'text-white' },
  fail: { bg: 'bg-score-red', text: 'text-white' },
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
 * Thresholds are defined in shared/scoring-config.json
 */
export function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= SCORING_CONFIG.colorThresholds.green) return 'green'
  if (score >= SCORING_CONFIG.colorThresholds.yellow) return 'yellow'
  return 'red'
}

/**
 * Get Tailwind classes for a score badge based on score value.
 * Returns combined bg and text classes.
 */
export function getScoreBadgeClasses(score: number): string {
  const color = getScoreColor(score)
  const style = SCORE_BADGE_STYLES[color]
  return `${style.bg} ${style.text}`
}

/**
 * Get Tailwind classes for a status badge (pass/fail).
 * Returns combined bg and text classes.
 */
export function getStatusBadgeClasses(status: 'pass' | 'fail'): string {
  const style = STATUS_BADGE_STYLES[status]
  return `${style.bg} ${style.text}`
}

/**
 * Calculate score from an array of result items.
 * Score starts at 100 and deducts based on failed item severity.
 * Ignored items are excluded from score calculation.
 * Used by UI to calculate per-URL scores from ResultItems.
 */
export function calculateScoreFromItems(
  items: Array<{ status: string; severity?: string; ignored?: boolean }>
): number {
  let score = 100

  for (const item of items) {
    // Skip non-failing, ignored, or severity-less items
    if (item.status !== 'FAIL' || item.ignored || !item.severity) continue

    const penalty = SCORING_CONFIG.severityPenalties[
      item.severity as keyof typeof SCORING_CONFIG.severityPenalties
    ] || 0
    score -= penalty
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Test types that have numeric scores for release-level calculation.
 * SCREENSHOTS is excluded as it requires manual review.
 */
export const SCORED_TEST_TYPES = ['PAGE_PREFLIGHT', 'PERFORMANCE', 'SPELLING'] as const

/**
 * Result of release-level score calculation.
 */
export interface ReleaseScoreResult {
  /** Average score across completed scored tests, null if none completed or incomplete */
  score: number | null
  /** Pass/Fail/Incomplete status - Incomplete if any test has operational failure */
  status: 'Pass' | 'Fail' | 'Incomplete' | null
  /** Number of scored tests that have completed */
  completedTests: number
  /** Total number of scored tests selected for this release */
  totalScoredTests: number
  /** Number of tests that failed operationally */
  failedTests?: number
}

/**
 * Calculate release-level score from TestRun scores.
 * Averages scores from completed scored test types (PAGE_PREFLIGHT, PERFORMANCE, SPELLING).
 *
 * @param testRuns - Array of test runs from the release
 * @param selectedTests - Array of test types selected for this release
 * @returns Release score result with average score and pass/fail status
 */
export function calculateReleaseScore(
  testRuns: Array<{ type: string; status: string; score: number | null }>,
  selectedTests: string[]
): ReleaseScoreResult {
  // Filter to only scored test types that were selected
  const scoredSelectedTests = selectedTests.filter(
    type => SCORED_TEST_TYPES.includes(type as typeof SCORED_TEST_TYPES[number])
  )

  // Check for any FAILED tests (operational errors)
  const failedScoredRuns = testRuns.filter(
    run =>
      SCORED_TEST_TYPES.includes(run.type as typeof SCORED_TEST_TYPES[number]) &&
      run.status === 'FAILED'
  )

  // If any test failed operationally, return Incomplete
  if (failedScoredRuns.length > 0) {
    return {
      score: null,
      status: 'Incomplete',
      completedTests: 0,
      totalScoredTests: scoredSelectedTests.length,
      failedTests: failedScoredRuns.length,
    }
  }

  // Get completed scored test runs with valid scores
  const completedScoredRuns = testRuns.filter(
    run =>
      SCORED_TEST_TYPES.includes(run.type as typeof SCORED_TEST_TYPES[number]) &&
      run.status === 'SUCCESS' &&
      run.score !== null
  )

  // If no completed scored tests, return null
  if (completedScoredRuns.length === 0) {
    return {
      score: null,
      status: null,
      completedTests: 0,
      totalScoredTests: scoredSelectedTests.length,
    }
  }

  // Calculate average score
  const totalScore = completedScoredRuns.reduce((sum, run) => sum + (run.score ?? 0), 0)
  const averageScore = Math.round(totalScore / completedScoredRuns.length)

  return {
    score: averageScore,
    status: isPassingScore(averageScore) ? 'Pass' : 'Fail',
    completedTests: completedScoredRuns.length,
    totalScoredTests: scoredSelectedTests.length,
  }
}
