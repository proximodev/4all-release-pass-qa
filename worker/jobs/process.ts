import { TestRun, TestType, TestStatus } from '@prisma/client';
import { startHeartbeat } from '../lib/heartbeat';
import { completeTestRun, failTestRun } from './claim';

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
    switch (testRun.type) {
      case TestType.PAGE_PREFLIGHT:
        await processPagePreflight(testRun);
        break;

      case TestType.PERFORMANCE:
        await processPerformance(testRun);
        break;

      case TestType.SCREENSHOTS:
        await processScreenshots(testRun);
        break;

      case TestType.SPELLING:
        await processSpelling(testRun);
        break;

      case TestType.SITE_AUDIT:
        await processSiteAudit(testRun);
        break;

      default:
        throw new Error(`Unknown test type: ${testRun.type}`);
    }

    // Mark as successful
    await completeTestRun(testRun.id, TestStatus.SUCCESS);
    console.log(`Test run ${testRun.id} completed successfully`);

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
// Provider Stubs (to be implemented in Phase 6.2+)
// ============================================================================

async function processPagePreflight(testRun: TestRunWithRelations): Promise<void> {
  console.log(`[PAGE_PREFLIGHT] Processing ${testRun.id}`);
  // TODO: Implement in Phase 6.2
  // - Run Lighthouse SEO audits via PageSpeed API
  // - Run Linkinator for link checking
  // - Run Custom Rules
  // - Store results in Issue table
  throw new Error('PAGE_PREFLIGHT provider not yet implemented');
}

async function processPerformance(testRun: TestRunWithRelations): Promise<void> {
  console.log(`[PERFORMANCE] Processing ${testRun.id}`);
  // TODO: Implement in Phase 6.3
  // - Run PageSpeed API for Core Web Vitals
  // - Store results in UrlResult table
  throw new Error('PERFORMANCE provider not yet implemented');
}

async function processScreenshots(testRun: TestRunWithRelations): Promise<void> {
  console.log(`[SCREENSHOTS] Processing ${testRun.id}`);
  // TODO: Implement in Phase 6.4
  // - Capture screenshots via Playwright
  // - Upload to Supabase Storage
  // - Store metadata in ScreenshotSet table
  throw new Error('SCREENSHOTS provider not yet implemented');
}

async function processSpelling(testRun: TestRunWithRelations): Promise<void> {
  console.log(`[SPELLING] Processing ${testRun.id}`);
  // TODO: Implement in Phase 6.5
  // - Extract text via Playwright
  // - Check via LanguageTool API
  // - Store results in Issue table
  throw new Error('SPELLING provider not yet implemented');
}

async function processSiteAudit(testRun: TestRunWithRelations): Promise<void> {
  console.log(`[SITE_AUDIT] Processing ${testRun.id}`);
  // TODO: Implement in Phase 6.6 (v1.2)
  // - Run SE Ranking full site crawl
  // - Store results in UrlResult and Issue tables
  throw new Error('SITE_AUDIT provider not yet implemented (v1.2)');
}
