/**
 * Test Results Processing Service
 *
 * Pure functions for processing and summarizing test results.
 * Extracted from TestResultDetail.tsx for reusability and testability.
 */

import { isPassingScore } from '@/lib/scoring'
import type { ResultItem, UrlResultData } from '@/lib/types/releasepass'

/**
 * Result item counts
 */
export interface ResultCounts {
  passCount: number
  failCount: number
  totalCount: number
}

/**
 * Performance viewport scores
 */
export interface PerformanceScores {
  mobileScore: number | null
  desktopScore: number | null
}

/**
 * Count result items by status
 */
export function countResultItems(items: ResultItem[]): ResultCounts {
  const passCount = items.filter(i => i.status === 'PASS').length
  const failCount = items.filter(i => i.status === 'FAIL').length
  const totalCount = items.length
  return { passCount, failCount, totalCount }
}

/**
 * Find mobile and desktop performance scores for a URL
 */
export function getPerformanceScores(
  urlResults: UrlResultData[],
  url: string
): PerformanceScores {
  const mobileResult = urlResults.find(ur => ur.url === url && ur.viewport === 'mobile')
  const desktopResult = urlResults.find(ur => ur.url === url && ur.viewport === 'desktop')
  return {
    mobileScore: mobileResult?.score ?? null,
    desktopScore: desktopResult?.score ?? null,
  }
}

/**
 * Calculate the display score for a URL based on test type
 */
export function calculateUrlScore(
  testType: string,
  urlResult: UrlResultData,
  performanceScores: PerformanceScores | null,
  fallbackScore: number
): number {
  if ((testType === 'PAGE_PREFLIGHT' || testType === 'SPELLING') && urlResult.score != null) {
    return urlResult.score
  }

  if (testType === 'PERFORMANCE' && performanceScores) {
    const scores = [performanceScores.mobileScore, performanceScores.desktopScore]
      .filter((s): s is number => s !== null)
    return scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0
  }

  return fallbackScore
}

/**
 * Determine pass/fail status based on test type and scores
 */
export function getTestStatus(
  testType: string,
  score: number,
  performanceScores: PerformanceScores | null
): 'Passed' | 'Failed' {
  if (testType === 'PERFORMANCE' && performanceScores) {
    const mobilePasses = performanceScores.mobileScore !== null && isPassingScore(performanceScores.mobileScore)
    const desktopPasses = performanceScores.desktopScore !== null && isPassingScore(performanceScores.desktopScore)
    return (mobilePasses && desktopPasses) ? 'Passed' : 'Failed'
  }

  return isPassingScore(score) ? 'Passed' : 'Failed'
}

/**
 * Get additional info strings for preflight tests (link counts)
 */
export function getPreflightAdditionalInfo(urlResult: UrlResultData): string[] {
  const additionalInfo: string[] = []
  const linkCount = urlResult.additionalMetrics?.linkCount || 0
  const brokenLinkCount = urlResult.additionalMetrics?.brokenLinkCount || 0

  if (linkCount > 0) {
    additionalInfo.push(
      brokenLinkCount === 0
        ? `No broken links (${linkCount} links tested)`
        : `${brokenLinkCount} broken links (${linkCount} links tested)`
    )
  }

  return additionalInfo
}

/**
 * Complete summary calculation for a URL result
 */
export interface UrlResultSummary {
  score: number
  mobileScore: number | null
  desktopScore: number | null
  passCount: number
  failCount: number
  totalCount: number
  status: 'Passed' | 'Failed'
  additionalInfo: string[]
}

export function calculateUrlResultSummary(
  testType: string,
  urlResult: UrlResultData,
  urlResults: UrlResultData[],
  resultItems: ResultItem[],
  fallbackScore: number
): UrlResultSummary {
  const counts = countResultItems(resultItems)

  const performanceScores = testType === 'PERFORMANCE'
    ? getPerformanceScores(urlResults, urlResult.url)
    : null

  const score = calculateUrlScore(testType, urlResult, performanceScores, fallbackScore)
  const status = getTestStatus(testType, score, performanceScores)

  const additionalInfo = testType === 'PAGE_PREFLIGHT'
    ? getPreflightAdditionalInfo(urlResult)
    : []

  return {
    score,
    mobileScore: performanceScores?.mobileScore ?? null,
    desktopScore: performanceScores?.desktopScore ?? null,
    ...counts,
    status,
    additionalInfo,
  }
}
