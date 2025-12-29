/**
 * Scoring & Validation Configuration for Worker
 *
 * Controls how test scores are calculated and how pass/fail is determined.
 * This should stay in sync with lib/config/scoring.ts in the main app.
 *
 * Post-MVP: Move to database table for GUI configuration:
 * - Pass/fail thresholds (global or per-project)
 * - Severity penalties
 * - CDN whitelist
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

  /**
   * CDN domains to skip during link validation.
   * These often return false positives (403/CORS errors) when fetched directly
   * but work fine in browsers with proper headers.
   */
  cdnWhitelist: [
    'kit.fontawesome.com',
    'use.fontawesome.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
    'ajax.googleapis.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'code.jquery.com',
    'stackpath.bootstrapcdn.com',
    'maxcdn.bootstrapcdn.com',
    'use.typekit.net',
    'cdn.tailwindcss.com',
    'cdn.ampproject.org',
  ],
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
