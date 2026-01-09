import { TestRun, TestType, TestStatus } from '@prisma/client';
import { startHeartbeat } from '../lib/heartbeat';
import { completeTestRun, failTestRun } from './claim';
import { processPerformance, type PerformanceProviderResult } from '../providers/pagespeed';
import { processPagePreflight, type PreflightProviderResult } from '../providers/preflight';
import { processSiteAudit } from '../providers/seranking';
import { processSpelling, type SpellingProviderResult } from '../providers/spelling';

// Type for TestRun with relations (from claimNextQueuedRun)
type TestRunWithRelations = TestRun & {
  project: { id: string; name: string; siteUrl: string };
  config: { scope: string; urls: string[] } | null;
  releaseRun: { id: string; urls: unknown; selectedTests: unknown } | null;
};

// Common result type for providers that support operational error tracking
type ProviderResult = {
  score: number | null;
  failedUrls: number;
  totalUrls: number;
  error?: string;
};

/**
 * Process a claimed test run
 * Routes to the appropriate provider based on test type
 */
export async function processTestRun(testRun: TestRunWithRelations): Promise<void> {
  console.log(`Processing test run ${testRun.id} (${testRun.type}) for project ${testRun.project.name}`);

  // Start heartbeat to keep the run alive
  const stopHeartbeat = startHeartbeat(testRun.id);

  try {
    let result: ProviderResult | null = null;
    let score: number | null = null;

    switch (testRun.type) {
      case TestType.PAGE_PREFLIGHT:
        result = await processPagePreflight(testRun);
        break;

      case TestType.PERFORMANCE:
        result = await processPerformance(testRun);
        break;

      case TestType.SCREENSHOTS:
        await processScreenshots(testRun);
        // Screenshots don't have a numeric score or operational error tracking yet
        break;

      case TestType.SPELLING:
        result = await processSpelling(testRun);
        break;

      case TestType.SITE_AUDIT:
        // Site Audit still returns just a number (not updated yet)
        score = await processSiteAudit(testRun);
        break;

      default:
        throw new Error(`Unknown test type: ${testRun.type}`);
    }

    // Handle provider result with operational error tracking
    if (result !== null) {
      if (result.failedUrls > 0) {
        // Any operational failure = test FAILED with no score
        console.error(`Test run ${testRun.id} failed: ${result.error}`);
        await failTestRun(testRun.id, result.error || 'One or more URLs failed operationally');
        return;
      }
      score = result.score;
    }

    // Mark as successful with score
    await completeTestRun(testRun.id, TestStatus.SUCCESS, score !== null ? { score } : undefined);
    console.log(`Test run ${testRun.id} completed successfully${score !== null ? ` (score: ${score})` : ''}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Test run ${testRun.id} failed:`, errorMessage);
    await failTestRun(testRun.id, errorMessage);

  } finally {
    // Always stop the heartbeat
    stopHeartbeat();
  }
}

// ============================================================================
// Provider Stubs (to be implemented)
// ============================================================================

// Implemented providers are imported at the top:
// - processPerformance from '../providers/pagespeed'
// - processPagePreflight from '../providers/preflight'
// - processSiteAudit from '../providers/seranking'
// - processSpelling from '../providers/spelling'

async function processScreenshots(testRun: TestRunWithRelations): Promise<void> {
  console.log(`[SCREENSHOTS] Processing ${testRun.id}`);
  // TODO: Implement
  // - Capture screenshots via Playwright
  // - Upload to Supabase Storage
  // - Store metadata in ScreenshotSet table
  throw new Error('SCREENSHOTS provider not yet implemented');
}

