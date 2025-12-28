/**
 * Page Preflight Provider
 *
 * Combines three checks for comprehensive page-level validation:
 * 1. Lighthouse SEO audits (via PageSpeed API)
 * 2. Link validation (via Linkinator)
 * 3. Custom rules (extensible)
 *
 * Stores issues in the Issue table with appropriate impact levels.
 * Returns a calculated score (0-100) based on issue severity.
 */

import { prisma } from '../../lib/prisma';
import { IssueProvider, IssueSeverity, IssueImpact } from '@prisma/client';
import { runPageSpeed, SeoAudit } from '../pagespeed/client';
import { checkLinks, LinkCheckResult } from '../linkinator/client';

interface TestRunWithRelations {
  id: string;
  projectId: string;
  project: { id: string; name: string; siteUrl: string };
  config: { scope: string; urls: string[] } | null;
  releaseRun: { id: string; urls: unknown; selectedTests: unknown } | null;
}

interface IssueToCreate {
  url: string;
  provider: IssueProvider;
  code: string;
  summary: string;
  severity: IssueSeverity;
  impact: IssueImpact;
  meta?: any;
}

/**
 * Process a Page Preflight test run
 *
 * @returns Score (0-100) based on issue severity
 */
export async function processPagePreflight(testRun: TestRunWithRelations): Promise<number> {
  console.log(`[PAGE_PREFLIGHT] Starting for test run ${testRun.id}`);

  // Get URLs to test
  const urls = getUrlsToTest(testRun);

  if (urls.length === 0) {
    throw new Error('No URLs to test. Configure URLs in TestRunConfig or ReleaseRun.');
  }

  console.log(`[PAGE_PREFLIGHT] Testing ${urls.length} URL(s)`);

  // Limit to 50 URLs per run
  const limitedUrls = urls.slice(0, 50);
  if (urls.length > 50) {
    console.log(`[PAGE_PREFLIGHT] Limited to 50 URLs (was ${urls.length})`);
  }

  const allIssues: IssueToCreate[] = [];

  // Process each URL
  for (const url of limitedUrls) {
    console.log(`[PAGE_PREFLIGHT] Checking: ${url}`);

    try {
      // Run Lighthouse SEO checks
      const seoIssues = await runLighthouseSeo(url);
      allIssues.push(...seoIssues);

      // Run Linkinator checks
      const linkIssues = await runLinkinator(url);
      allIssues.push(...linkIssues);

      // TODO: Run custom rules
      // const customIssues = await runCustomRules(url);
      // allIssues.push(...customIssues);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[PAGE_PREFLIGHT] Error checking ${url}:`, errorMessage);

      // Add an issue for the failed check
      allIssues.push({
        url,
        provider: IssueProvider.INTERNAL,
        code: 'CHECK_FAILED',
        summary: `Failed to check URL: ${errorMessage}`,
        severity: IssueSeverity.HIGH,
        impact: IssueImpact.WARNING,
        meta: { error: errorMessage },
      });
    }
  }

  // Store all issues in database
  if (allIssues.length > 0) {
    await prisma.issue.createMany({
      data: allIssues.map(issue => ({
        testRunId: testRun.id,
        url: issue.url,
        provider: issue.provider,
        code: issue.code,
        summary: issue.summary,
        severity: issue.severity,
        impact: issue.impact,
        meta: issue.meta,
      })),
    });

    console.log(`[PAGE_PREFLIGHT] Stored ${allIssues.length} issues`);
  }

  // Calculate score
  const score = calculateScore(allIssues, limitedUrls.length);

  // Log summary
  const blockerCount = allIssues.filter(i => i.impact === IssueImpact.BLOCKER).length;
  const warningCount = allIssues.filter(i => i.impact === IssueImpact.WARNING).length;
  const infoCount = allIssues.filter(i => i.impact === IssueImpact.INFO).length;

  console.log(`[PAGE_PREFLIGHT] Completed. Score: ${score}`);
  console.log(`[PAGE_PREFLIGHT] Issues: ${blockerCount} blockers, ${warningCount} warnings, ${infoCount} info`);

  return score;
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
 * Run Lighthouse SEO audits via PageSpeed API
 */
async function runLighthouseSeo(url: string): Promise<IssueToCreate[]> {
  const issues: IssueToCreate[] = [];

  try {
    const result = await runPageSpeed(url, 'mobile', ['seo']);

    for (const audit of result.seoAudits) {
      // Only create issues for failed audits (score < 1)
      if (audit.score !== null && audit.score < 1) {
        const { severity, impact } = mapSeoAuditSeverity(audit);

        issues.push({
          url,
          provider: IssueProvider.LIGHTHOUSE,
          code: `SEO_${audit.id.toUpperCase().replace(/-/g, '_')}`,
          summary: audit.title,
          severity,
          impact,
          meta: {
            description: audit.description,
            displayValue: audit.displayValue,
            score: audit.score,
          },
        });
      }
    }

    console.log(`[PAGE_PREFLIGHT] Lighthouse SEO: ${issues.length} issues for ${url}`);

  } catch (error) {
    console.error(`[PAGE_PREFLIGHT] Lighthouse SEO failed for ${url}:`, error);
    // Don't throw - let other checks continue
  }

  return issues;
}

/**
 * Run Linkinator link validation
 */
async function runLinkinator(url: string): Promise<IssueToCreate[]> {
  const issues: IssueToCreate[] = [];

  try {
    const result = await checkLinks(url, {
      timeout: 30000,
      retryCount: 2,
      checkExternal: true,
    });

    // Create issues for broken links
    for (const link of result.brokenLinks) {
      const isInternal = isInternalLink(url, link.url);
      const { severity, impact } = mapLinkSeverity(link, isInternal);

      issues.push({
        url,
        provider: IssueProvider.LINKINATOR,
        code: isInternal ? 'BROKEN_INTERNAL_LINK' : 'BROKEN_EXTERNAL_LINK',
        summary: `Broken ${isInternal ? 'internal' : 'external'} link: ${link.url} (${link.status})`,
        severity,
        impact,
        meta: {
          brokenUrl: link.url,
          status: link.status,
          failureDetails: link.failureDetails,
          parent: link.parent,
        },
      });
    }

    // Optionally warn about redirect chains (as INFO)
    for (const redirect of result.redirects) {
      if (isInternalLink(url, redirect.url)) {
        issues.push({
          url,
          provider: IssueProvider.LINKINATOR,
          code: 'REDIRECT_CHAIN',
          summary: `Internal redirect: ${redirect.url} (${redirect.status})`,
          severity: IssueSeverity.LOW,
          impact: IssueImpact.INFO,
          meta: {
            redirectUrl: redirect.url,
            status: redirect.status,
          },
        });
      }
    }

    console.log(`[PAGE_PREFLIGHT] Linkinator: ${issues.length} issues for ${url} (checked ${result.totalLinks} links)`);

  } catch (error) {
    console.error(`[PAGE_PREFLIGHT] Linkinator failed for ${url}:`, error);
    // Don't throw - let other checks continue
  }

  return issues;
}

/**
 * Check if a link is internal to the same domain
 */
function isInternalLink(pageUrl: string, linkUrl: string): boolean {
  try {
    const pageOrigin = new URL(pageUrl).origin;
    const linkOrigin = new URL(linkUrl).origin;
    return pageOrigin === linkOrigin;
  } catch {
    return false;
  }
}

/**
 * Map SEO audit to severity and impact
 */
function mapSeoAuditSeverity(audit: SeoAudit): { severity: IssueSeverity; impact: IssueImpact } {
  // Critical SEO issues that block launch
  const blockerAudits = ['is-crawlable', 'http-status-code'];
  // High-impact SEO issues
  const highAudits = ['document-title', 'meta-description', 'canonical'];
  // Medium-impact SEO issues
  const mediumAudits = ['image-alt', 'link-text', 'robots-txt'];

  if (blockerAudits.includes(audit.id)) {
    return { severity: IssueSeverity.CRITICAL, impact: IssueImpact.BLOCKER };
  }
  if (highAudits.includes(audit.id)) {
    return { severity: IssueSeverity.HIGH, impact: IssueImpact.WARNING };
  }
  if (mediumAudits.includes(audit.id)) {
    return { severity: IssueSeverity.MEDIUM, impact: IssueImpact.WARNING };
  }

  return { severity: IssueSeverity.LOW, impact: IssueImpact.INFO };
}

/**
 * Map link check result to severity and impact
 */
function mapLinkSeverity(
  link: LinkCheckResult,
  isInternal: boolean
): { severity: IssueSeverity; impact: IssueImpact } {
  // Internal broken links are critical
  if (isInternal) {
    if (link.status === 404) {
      return { severity: IssueSeverity.CRITICAL, impact: IssueImpact.BLOCKER };
    }
    if (link.status >= 500) {
      return { severity: IssueSeverity.HIGH, impact: IssueImpact.BLOCKER };
    }
    return { severity: IssueSeverity.MEDIUM, impact: IssueImpact.WARNING };
  }

  // External broken links are warnings
  return { severity: IssueSeverity.MEDIUM, impact: IssueImpact.WARNING };
}

/**
 * Calculate score based on issues
 *
 * Scoring algorithm:
 * - Start with 100 points
 * - Deduct based on severity:
 *   - CRITICAL: -10 points each
 *   - HIGH: -5 points each
 *   - MEDIUM: -2 points each
 *   - LOW: -1 point each
 * - Normalize by URL count (more URLs = proportionally more tolerance)
 * - Clamp to 0-100
 */
function calculateScore(issues: IssueToCreate[], urlCount: number): number {
  let score = 100;

  for (const issue of issues) {
    switch (issue.severity) {
      case IssueSeverity.CRITICAL:
        score -= 10;
        break;
      case IssueSeverity.HIGH:
        score -= 5;
        break;
      case IssueSeverity.MEDIUM:
        score -= 2;
        break;
      case IssueSeverity.LOW:
        score -= 1;
        break;
    }
  }

  // Normalize by URL count (more URLs = more tolerance)
  // For every 5 URLs, reduce the penalty impact by ~50%
  const normalizationFactor = Math.max(1, urlCount / 5);
  score = score + (100 - score) * (1 - 1 / normalizationFactor) * 0.5;

  return Math.max(0, Math.min(100, Math.round(score)));
}
