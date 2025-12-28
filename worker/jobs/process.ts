import { TestRun, TestType, TestStatus } from '@prisma/client';
import { startHeartbeat } from '../lib/heartbeat';
import { completeTestRun, failTestRun } from './claim';
import { processPerformance } from '../providers/pagespeed';
import { processPagePreflight } from '../providers/preflight';
import { processSiteAudit } from '../providers/seranking';

// Type for TestRun with relations (from claimNextQueuedRun)
type TestRunWithRelations = TestRun & {
  project: { id: string; name: string; siteUrl: string };
  config: { scope: string; urls: string[] } | null;
  releaseRun: { id: string; urls: unknown; selectedTests: unknown } | null;
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
    let score: number | null = null;

    switch (testRun.type) {
      case TestType.PAGE_PREFLIGHT:
        score = await processPagePreflight(testRun);
        break;

      case TestType.PERFORMANCE:
        score = await processPerformance(testRun);
        break;

      case TestType.SCREENSHOTS:
        await processScreenshots(testRun);
        // Screenshots don't have a numeric score
        break;

      case TestType.SPELLING:
        await processSpelling(testRun);
        // Spelling doesn't have a numeric score
        break;

      case TestType.SITE_AUDIT:
        score = await processSiteAudit(testRun);
        break;

      default:
        throw new Error(`Unknown test type: ${testRun.type}`);
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

// Note: processPerformance is imported from '../providers/pagespeed'
// Note: processPagePreflight is imported from '../providers/preflight'
// Note: processSiteAudit is imported from '../providers/seranking'

async function processScreenshots(testRun: TestRunWithRelations): Promise<void> {
  console.log(`[SCREENSHOTS] Processing ${testRun.id}`);
  // TODO: Implement
  // - Capture screenshots via Playwright
  // - Upload to Supabase Storage
  // - Store metadata in ScreenshotSet table
  throw new Error('SCREENSHOTS provider not yet implemented');
}

async function processSpelling(testRun: TestRunWithRelations): Promise<void> {
  console.log(`[SPELLING] Processing ${testRun.id}`);
  // TODO: Implement
  // - Extract text via Playwright
  // - Check via LanguageTool API
  // - Store results in Issue table
  throw new Error('SPELLING provider not yet implemented');
}
