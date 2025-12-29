/**
 * Site Audit Provider (SE Ranking)
 *
 * Runs a full site crawl using SE Ranking Website Audit API.
 * This is a site-level test (NOT part of Release Runs).
 *
 * Features:
 * - 105 checks across multiple categories
 * - Max 500 pages per audit
 * - Returns SE Ranking health score (0-100)
 */

import { prisma } from '../../lib/prisma';
import { IssueProvider, IssueSeverity, ResultStatus } from '@prisma/client';
import { runFullAudit, SeRankingIssue } from './client';

interface TestRunWithRelations {
  id: string;
  projectId: string;
  project: { id: string; name: string; siteUrl: string };
  config: { scope: string; urls: string[] } | null;
  releaseRun: { id: string; urls: unknown; selectedTests: unknown } | null;
}

/**
 * Process a Site Audit test run
 *
 * @returns SE Ranking health score (0-100)
 */
export async function processSiteAudit(testRun: TestRunWithRelations): Promise<number> {
  console.log(`[SITE_AUDIT] Starting for test run ${testRun.id}`);

  const siteUrl = testRun.project.siteUrl;

  if (!siteUrl) {
    throw new Error('Project has no site URL configured');
  }

  console.log(`[SITE_AUDIT] Running SE Ranking audit for ${siteUrl}`);

  // Run the full audit (this may take several minutes)
  const result = await runFullAudit(siteUrl, {
    maxPages: 500,
    pollIntervalMs: 30000,  // Poll every 30 seconds
    maxWaitMs: 3600000,     // Max 1 hour wait
  });

  if (result.status === 'failed') {
    throw new Error('SE Ranking audit failed');
  }

  console.log(`[SITE_AUDIT] Audit completed. Score: ${result.score}, Pages: ${result.pagesScanned}`);
  console.log(`[SITE_AUDIT] Issues: ${result.summary.criticalCount} critical, ${result.summary.warningsCount} warnings, ${result.summary.noticesCount} notices`);

  // Create UrlResult first
  const urlResult = await prisma.urlResult.create({
    data: {
      testRunId: testRun.id,
      url: siteUrl,
      issueCount: result.issues.filter(i => i.severity !== 'passed').length,
      criticalIssues: result.summary.criticalCount,
      additionalMetrics: {
        pagesScanned: result.pagesScanned,
        passedChecks: result.summary.passedCount,
        seRankingProjectId: result.projectId,
        seRankingAuditId: result.auditId,
        summary: result.summary,
      },
    },
  });

  // Store all results (pass + fail) as ResultItems
  if (result.issues.length > 0) {
    await storeResultItems(urlResult.id, result.issues);
    console.log(`[SITE_AUDIT] Stored ${result.issues.length} result items`);
  }

  // Update TestRun with rawPayload
  await prisma.testRun.update({
    where: { id: testRun.id },
    data: {
      rawPayload: {
        seRanking: {
          projectId: result.projectId,
          auditId: result.auditId,
          score: result.score,
          pagesScanned: result.pagesScanned,
          summary: result.summary,
        },
      },
    },
  });

  return result.score ?? 0;
}

/**
 * Store SE Ranking results as ResultItems in the database
 */
async function storeResultItems(
  urlResultId: string,
  issues: SeRankingIssue[]
): Promise<void> {
  const resultItems = issues.map(issue => ({
    urlResultId,
    provider: IssueProvider.SE_RANKING,
    code: issue.id,
    name: issue.name,
    status: issue.severity === 'passed' ? ResultStatus.PASS : ResultStatus.FAIL,
    severity: issue.severity === 'passed' ? null : mapSeverity(issue.severity),
    meta: {
      category: issue.category,
      affectedCount: issue.affectedCount,
      description: issue.description,
      affectedUrls: issue.urls?.slice(0, 10),  // Store first 10 affected URLs
    },
  }));

  await prisma.resultItem.createMany({
    data: resultItems,
  });
}

/**
 * Map SE Ranking severity to our severity enum
 */
function mapSeverity(severity: 'critical' | 'warning' | 'notice' | 'passed'): IssueSeverity {
  switch (severity) {
    case 'critical':
      return IssueSeverity.BLOCKER;
    case 'warning':
      return IssueSeverity.HIGH;
    case 'notice':
      return IssueSeverity.MEDIUM;
    case 'passed':
      return IssueSeverity.LOW;
  }
}

// Re-export types
export type { SeRankingAuditResult, SeRankingIssue, SeRankingProject } from './client';
