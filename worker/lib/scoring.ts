/**
 * Scoring & Validation Configuration (Worker)
 *
 * Controls how test scores are calculated and how pass/fail is determined.
 *
 * IMPORTANT: Core scoring values (passThreshold, severityPenalties) are imported
 * from worker/shared/scoring-config.json. Keep this in sync with /shared/scoring-config.json.
 * See #34 for future monorepo conversion that will eliminate this duplication.
 *
 * This file contains:
 * - Shared config import (passThreshold, severityPenalties)
 * - Worker-specific validation helpers (CDN whitelist, excluded endpoints)
 *
 * Post-MVP: Move to database table for GUI configuration:
 * - Pass/fail thresholds (global or per-project)
 * - Severity penalties
 * - CDN whitelist
 */

import sharedConfig from '../shared/scoring-config.json'

export const SCORING_CONFIG = {
  /**
   * Score threshold for pass/fail determination.
   * Imported from shared/scoring-config.json
   */
  passThreshold: sharedConfig.passThreshold,

  /**
   * Point deductions by severity level.
   * Imported from shared/scoring-config.json
   */
  severityPenalties: sharedConfig.severityPenalties,

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

  /**
   * URL patterns to exclude from link validation.
   * These are API endpoints that return errors for GET/HEAD requests
   * but are not user-facing broken links (e.g., WordPress endpoints).
   */
  excludedEndpoints: [
    // WordPress XML-RPC - requires POST with XML payload, returns 405 for GET/HEAD
    'xmlrpc.php',
    // WordPress REST API - may require authentication or specific methods
    'wp-json',
    // WordPress admin AJAX - requires POST with specific parameters
    'wp-admin/admin-ajax.php',
    // WordPress admin post handler
    'wp-admin/admin-post.php',
    // WordPress comments handler
    'wp-comments-post.php',
    // Cloudflare services (email protection, challenge pages, scripts, etc.)
    '/cdn-cgi/',
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
