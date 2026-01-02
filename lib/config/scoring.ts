/**
 * Scoring Configuration (App)
 *
 * Controls how test scores are calculated and how pass/fail is determined.
 *
 * IMPORTANT: Core scoring values (passThreshold, severityPenalties) are imported
 * from shared/scoring-config.json to ensure consistency with the worker.
 * DO NOT duplicate these values here - update the JSON file instead.
 *
 * This file contains:
 * - Shared config import (passThreshold, severityPenalties)
 * - App-specific UI helpers (badge styles, color functions)
 *
 * Post-MVP: These values could move to a database table or project-level settings.
 */

import sharedConfig from '@/shared/scoring-config.json'

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
} as const

/**
 * Badge styling configuration.
 * Centralized Tailwind classes for score and status badges.
 */
export const SCORE_BADGE_STYLES = {
  green: { bg: 'bg-green-600', text: 'text-white' },
  yellow: { bg: 'bg-brand-yellow', text: 'text-black' },
  red: { bg: 'bg-red', text: 'text-white' },
} as const

export const STATUS_BADGE_STYLES = {
  pass: { bg: 'bg-green-600', text: 'text-white' },
  fail: { bg: 'bg-red', text: 'text-white' },
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
 * Used by UI to calculate per-URL scores from ResultItems.
 */
export function calculateScoreFromItems(
  items: Array<{ status: string; severity?: string }>
): number {
  let score = 100

  for (const item of items) {
    if (item.status !== 'FAIL' || !item.severity) continue

    const penalty = SCORING_CONFIG.severityPenalties[
      item.severity as keyof typeof SCORING_CONFIG.severityPenalties
    ] || 0
    score -= penalty
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}
