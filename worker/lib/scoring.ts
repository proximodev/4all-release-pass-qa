/**
 * Scoring & Validation Configuration (Worker)
 *
 * Controls how test scores are calculated and how pass/fail is determined.
 *
 * Configuration is imported from worker/shared/scoring-config.json.
 * This file is copied from /shared/scoring-config.json at build time.
 * See prebuild script in package.json.
 *
 * This file contains:
 * - Config imports (thresholds, penalties, validation rules)
 * - Validation helpers (CDN whitelist, excluded endpoints)
 * - Score calculation
 *
 * Post-MVP: Move to database table for GUI configuration.
 */

import sharedConfig from '../shared/scoring-config.json'

export const SCORING_CONFIG = {
  passThreshold: sharedConfig.scoring.passThreshold,
  severityPenalties: sharedConfig.scoring.severityPenalties,
  cdnWhitelist: sharedConfig.validation.cdnWhitelist,
  excludedEndpoints: sharedConfig.validation.excludedEndpoints,
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
 * Check if a URL is from a whitelisted CDN
 */
export function isWhitelistedCdn(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return SCORING_CONFIG.cdnWhitelist.some(
      cdn => hostname === cdn || hostname.endsWith('.' + cdn)
    )
  } catch {
    return false
  }
}

/**
 * Check if a URL matches an excluded endpoint pattern.
 * These are API endpoints (e.g., WordPress) that return errors for GET/HEAD
 * but are not user-facing broken links.
 */
export function isExcludedEndpoint(url: string): boolean {
  try {
    const pathname = new URL(url).pathname
    return SCORING_CONFIG.excludedEndpoints.some(
      pattern => pathname.includes(pattern)
    )
  } catch {
    return false
  }
}

/**
 * Calculate score from an array of result items.
 * Score starts at 100 and deducts based on failed item severity.
 * Ignored items are excluded from score calculation.
 */
export function calculateScoreFromItems(
  items: Array<{ status: string; severity?: string | null; ignored?: boolean }>
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
