/**
 * Performance Provider
 *
 * Runs PageSpeed Insights API for Core Web Vitals and performance scoring.
 * Stores results in UrlResult table.
 *
 * Features:
 * - Tests both mobile and desktop viewports
 * - Stores Core Web Vitals (LCP, CLS, FCP, TBT, TTI)
 * - Calculates average score across all URLs
 * - Includes field data (CrUX) when available
 */

import { prisma } from '../../lib/prisma';
import { runPageSpeed, PageSpeedResult } from './client';

interface TestRunWithRelations {
  id: string;
  projectId: string;
  project: { id: string; name: string; siteUrl: string };
  config: { scope: string; urls: string[] } | null;
  releaseRun: { id: string; urls: unknown; selectedTests: unknown } | null;
}

interface PerformanceUrlSuccess {
  url: string;
  success: true;
  mobile: PageSpeedResult | null;
  desktop: PageSpeedResult | null;
}

interface PerformanceUrlError {
  url: string;
  success: false;
  error: string;
}

type PerformanceUrlOutcome = PerformanceUrlSuccess | PerformanceUrlError;

/**
 * Result returned by processPerformance to indicate success/failure
 */
export interface PerformanceProviderResult {
  score: number | null;  // null if any URL failed operationally
  failedUrls: number;
  totalUrls: number;
  error?: string;  // Summary error message if failedUrls > 0
}

/**
 * Process a Performance test run
 *
 * Returns a result object indicating success/failure.
 * If any URL fails operationally (both mobile + desktop fail), score is null and test should be marked FAILED.
 */
export async function processPerformance(testRun: TestRunWithRelations): Promise<PerformanceProviderResult> {
  console.log(`[PERFORMANCE] Starting for test run ${testRun.id}`);

  // Get URLs to test
  const urls = getUrlsToTest(testRun);

  if (urls.length === 0) {
    throw new Error('No URLs to test. Configure URLs in TestRunConfig or ReleaseRun.');
  }

  console.log(`[PERFORMANCE] Testing ${urls.length} URL(s)`);

  // Limit to 20 URLs to avoid excessive API usage
  const limitedUrls = urls.slice(0, 20);
  if (urls.length > 20) {
    console.log(`[PERFORMANCE] Limited to 20 URLs (was ${urls.length})`);
  }

  // Run PageSpeed for each URL
  const allOutcomes: PerformanceUrlOutcome[] = [];
  let totalScore = 0;
  let scoredCount = 0;

  for (const url of limitedUrls) {
    console.log(`[PERFORMANCE] Testing: ${url}`);

    try {
      // Run for both mobile and desktop (in parallel)
      const [mobileResult, desktopResult] = await Promise.all([
        runPageSpeed(url, 'mobile', ['performance', 'accessibility']).catch(err => {
          console.error(`[PERFORMANCE] Mobile test failed for ${url}:`, err.message);
          return null;
        }),
        runPageSpeed(url, 'desktop', ['performance', 'accessibility']).catch(err => {
          console.error(`[PERFORMANCE] Desktop test failed for ${url}:`, err.message);
          return null;
        }),
      ]);

      // If both failed, treat as operational error
      if (!mobileResult && !desktopResult) {
        allOutcomes.push({
          url,
          success: false,
          error: 'Both mobile and desktop tests failed',
        });

        // Create UrlResult with error (no metrics)
        await prisma.urlResult.create({
          data: {
            testRunId: testRun.id,
            url,
            error: 'Both mobile and desktop tests failed',
          },
        });
        continue;
      }

      // At least one viewport succeeded
      allOutcomes.push({
        url,
        success: true,
        mobile: mobileResult,
        desktop: desktopResult,
      });

      // Store mobile result
      if (mobileResult) {
        await storeUrlResult(testRun.id, url, 'mobile', mobileResult);
        if (mobileResult.performanceScore !== null) {
          totalScore += mobileResult.performanceScore;
          scoredCount++;
        }
      }

      // Store desktop result
      if (desktopResult) {
        await storeUrlResult(testRun.id, url, 'desktop', desktopResult);
        if (desktopResult.performanceScore !== null) {
          totalScore += desktopResult.performanceScore;
          scoredCount++;
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[PERFORMANCE] Failed for ${url}:`, errorMessage);

      allOutcomes.push({
        url,
        success: false,
        error: errorMessage,
      });

      // Create UrlResult with error
      await prisma.urlResult.create({
        data: {
          testRunId: testRun.id,
          url,
          error: errorMessage,
        },
      });
    }
  }

  // Separate successful results from errors
  const successResults = allOutcomes.filter((o): o is PerformanceUrlSuccess => o.success);
  const errorResults = allOutcomes.filter((o): o is PerformanceUrlError => !o.success);

  const failedUrls = errorResults.length;
  const totalUrls = allOutcomes.length;

  if (failedUrls > 0) {
    // Any operational failure = no score
    const errorSummary = failedUrls === totalUrls
      ? errorResults[0].error
      : `${failedUrls} of ${totalUrls} URLs failed operationally`;

    console.log(`[PERFORMANCE] Failed. ${failedUrls} of ${totalUrls} URLs had operational errors`);

    return {
      score: null,
      failedUrls,
      totalUrls,
      error: errorSummary,
    };
  }

  // Calculate average score
  const averageScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

  console.log(`[PERFORMANCE] Completed. Average score: ${averageScore} (from ${scoredCount} measurements)`);

  // Log any pages with poor scores
  for (const result of successResults) {
    const mobileScore = result.mobile?.performanceScore ?? null;
    const desktopScore = result.desktop?.performanceScore ?? null;

    if ((mobileScore !== null && mobileScore < 50) || (desktopScore !== null && desktopScore < 50)) {
      console.log(`[PERFORMANCE] Warning: Low score for ${result.url} (mobile: ${mobileScore}, desktop: ${desktopScore})`);
    }
  }

  return {
    score: averageScore,
    failedUrls: 0,
    totalUrls,
  };
}

/**
 * Get URLs to test from TestRunConfig or ReleaseRun
 */
function getUrlsToTest(testRun: TestRunWithRelations): string[] {
  // First check TestRunConfig
  if (testRun.config?.urls && testRun.config.urls.length > 0) {
    return testRun.config.urls;
  }

  // Fall back to ReleaseRun URLs
  if (testRun.releaseRun?.urls) {
    const urls = testRun.releaseRun.urls;
    if (Array.isArray(urls)) {
      return urls as string[];
    }
  }

  // Fall back to project site URL
  if (testRun.project.siteUrl) {
    return [testRun.project.siteUrl];
  }

  return [];
}

/**
 * Store a PageSpeed result in the UrlResult table
 */
async function storeUrlResult(
  testRunId: string,
  url: string,
  viewport: 'mobile' | 'desktop',
  result: PageSpeedResult
): Promise<void> {
  await prisma.urlResult.create({
    data: {
      testRunId,
      url,
      viewport,

      // Core Web Vitals
      lcp: result.lcp,
      cls: result.cls,
      inp: result.fieldInp,  // INP from field data since lab doesn't have it
      fcp: result.fcp,
      tbt: result.tbt,
      tti: result.tti,

      // Scores
      performanceScore: result.performanceScore,
      accessibilityScore: result.accessibilityScore,

      // Additional metrics
      additionalMetrics: {
        hasFieldData: result.hasFieldData,
        fieldLcp: result.fieldLcp,
        fieldCls: result.fieldCls,
        fieldInp: result.fieldInp,
        seoScore: result.seoScore,
      },
    },
  });

  console.log(`[PERFORMANCE] Stored ${viewport} result for ${url} (score: ${result.performanceScore})`);
}
