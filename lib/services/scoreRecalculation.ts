/**
 * Score Recalculation Service
 *
 * Recalculates scores for UrlResult and TestRun when ResultItems are toggled.
 * Uses the same scoring logic as the worker (shared via calculateScoreFromItems).
 */

import { prisma } from '@/lib/prisma'
import { calculateScoreFromItems } from '@/lib/scoring'

/**
 * Recalculate and update the score for a UrlResult.
 * Fetches all ResultItems, calculates score excluding ignored items,
 * and updates the score field.
 *
 * @param urlResultId - The UrlResult to recalculate
 * @returns The new score
 */
export async function recalculateUrlResultScore(urlResultId: string): Promise<number> {
  // Fetch all result items for this URL
  const resultItems = await prisma.resultItem.findMany({
    where: { urlResultId },
    select: {
      status: true,
      severity: true,
      ignored: true,
    },
  })

  // Calculate new score
  const newScore = calculateScoreFromItems(
    resultItems.map(item => ({
      status: item.status,
      severity: item.severity ?? undefined,
      ignored: item.ignored,
    }))
  )

  // Update UrlResult
  await prisma.urlResult.update({
    where: { id: urlResultId },
    data: { score: newScore },
  })

  return newScore
}

/**
 * Recalculate and update the score for a TestRun.
 * Averages the score of all UrlResults.
 *
 * @param testRunId - The TestRun to recalculate
 * @returns The new average score
 */
export async function recalculateTestRunScore(testRunId: string): Promise<number> {
  // Fetch all URL results with their scores
  const urlResults = await prisma.urlResult.findMany({
    where: { testRunId },
    select: { score: true },
  })

  // Calculate average score
  const scores = urlResults
    .map(ur => ur.score)
    .filter((s): s is number => s !== null)

  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : 100

  // Update TestRun
  await prisma.testRun.update({
    where: { id: testRunId },
    data: { score: averageScore },
  })

  return averageScore
}

/**
 * Get the project ID and URL for a ResultItem.
 * Used to create/delete IgnoredRule records.
 *
 * @param resultItemId - The ResultItem ID
 * @returns Object with projectId, url, code, urlResultId, testRunId
 */
export async function getResultItemContext(resultItemId: string) {
  const resultItem = await prisma.resultItem.findUnique({
    where: { id: resultItemId },
    select: {
      code: true,
      urlResult: {
        select: {
          id: true,
          url: true,
          testRun: {
            select: {
              id: true,
              projectId: true,
            },
          },
        },
      },
    },
  })

  if (!resultItem) {
    throw new Error(`ResultItem not found: ${resultItemId}`)
  }

  return {
    code: resultItem.code,
    urlResultId: resultItem.urlResult.id,
    url: resultItem.urlResult.url,
    testRunId: resultItem.urlResult.testRun.id,
    projectId: resultItem.urlResult.testRun.projectId,
  }
}
