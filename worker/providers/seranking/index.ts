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
import { IssueProvider, IssueSeverity, IssueImpact } from '@prisma/client';
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

  // Store issues in database
  if (result.issues.length > 0) {
    await storeIssues(testRun.id, result.issues, siteUrl);
    console.log(`[SITE_AUDIT] Stored ${result.issues.length} issues`);
  }

  // Store URL results for pages scanned
  await prisma.urlResult.create({
    data: {
      testRunId: testRun.id,
      url: siteUrl,
      issueCount: result.issues.length,
      criticalIssues: result.summary.criticalCount,
      additionalMetrics: {
        pagesScanned: result.pagesScanned,
        passedChecks: result.summary.passedCount,
        seRankingProjectId: result.projectId,
        seRankingAuditId: result.auditId,
      },
    },
  });

  return result.score ?? 0;
}

/**
 * Store SE Ranking issues in the database
 */
async function storeIssues(
  testRunId: string,
  issues: SeRankingIssue[],
  siteUrl: string
): Promise<void> {
  const issuesToCreate = issues.map(issue => ({
    testRunId,
    url: siteUrl,  // Site-level issues are associated with the main URL
    provider: IssueProvider.SE_RANKING,
    code: `SE_${issue.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
    summary: issue.name,
    severity: mapSeverity(issue.severity),
    impact: mapImpact(issue.severity),
    meta: {
      category: issue.category,
      affectedCount: issue.affectedCount,
      description: issue.description,
      affectedUrls: issue.urls?.slice(0, 10),  // Store first 10 affected URLs
    },
  }));

  await prisma.issue.createMany({
    data: issuesToCreate,
  });
}

/**
 * Map SE Ranking severity to our severity enum
 */
function mapSeverity(severity: 'critical' | 'warning' | 'notice' | 'passed'): IssueSeverity {
  switch (severity) {
    case 'critical':
      return IssueSeverity.CRITICAL;
    case 'warning':
      return IssueSeverity.HIGH;
    case 'notice':
      return IssueSeverity.MEDIUM;
    case 'passed':
      return IssueSeverity.LOW;
  }
}

/**
 * Map SE Ranking severity to impact level
 */
function mapImpact(severity: 'critical' | 'warning' | 'notice' | 'passed'): IssueImpact {
  switch (severity) {
    case 'critical':
      return IssueImpact.BLOCKER;
    case 'warning':
      return IssueImpact.WARNING;
    case 'notice':
    case 'passed':
      return IssueImpact.INFO;
  }
}

// Re-export types
export { SeRankingAuditResult, SeRankingIssue, SeRankingProject } from './client';
