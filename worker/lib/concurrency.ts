/**
 * Concurrency Configuration
 *
 * Defines concurrency limits for parallel URL processing.
 * Conservative defaults to avoid overwhelming external APIs and target sites.
 */

import pLimit from 'p-limit'

/**
 * Concurrency limits by provider type
 */
export const CONCURRENCY = {
  // LanguageTool (self-hosted) - no external rate limits
  SPELLING: 5,

  // PageSpeed API - 400 req/min capacity, but be conservative
  // Linkinator runs alongside, hitting user's site
  PREFLIGHT: 3,
} as const

/**
 * Create a concurrency limiter
 */
export const createLimiter = (concurrency: number) => pLimit(concurrency)
