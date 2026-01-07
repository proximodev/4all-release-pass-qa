/**
 * Page Preflight Provider
 *
 * Combines three checks for comprehensive page-level validation:
 * 1. Lighthouse SEO audits (via PageSpeed API)
 * 2. Link validation (via Linkinator)
 * 3. Custom rules (extensible)
 *
 * Stores all check results (pass + fail) in ResultItem table via UrlResult.
 * Returns a calculated score (0-100) based on failed item severity.
 * Pass/fail is determined by score threshold (see lib/scoring.ts).
 */

import { prisma } from '../../lib/prisma';
import { IssueProvider, IssueSeverity, ResultStatus } from '@prisma/client';
import { runPageSpeed, SeoAudit, PageSpeedResult } from '../pagespeed/client';
import { checkLinks, LinkCheckResult, LinkCheckSummary } from '../linkinator/client';
import { runCustomRules } from './custom-rules';
import { SCORING_CONFIG, getScoreStatus, isWhitelistedCdn, isExcludedEndpoint } from '../../lib/scoring';

interface TestRunWithRelations {
  id: string;
  projectId: string;
  project: { id: string; name: string; siteUrl: string };
  config: { scope: string; urls: string[] } | null;
  releaseRun: { id: string; urls: unknown; selectedTests: unknown } | null;
}

interface ResultItemToCreate {
  provider: IssueProvider;
  code: string;
  name: string;
  status: ResultStatus;
  severity?: IssueSeverity;
  meta?: any;
  ignored?: boolean;
}

interface UrlCheckResults {
  url: string;
  seoScore: number | null;
  resultItems: ResultItemToCreate[];
  linkCount: number;
  brokenLinkCount: number;
  score: number;  // Per-URL score calculated from failed items
  lighthouseRaw?: any;
  linkinatorRaw?: any;
}

/**
 * Process a Page Preflight test run
 *
 * @returns Score (0-100) based on failed item severity
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

  const allUrlResults: UrlCheckResults[] = [];
  const rawPayload: { lighthouse: any[]; linkinator: any[] } = {
    lighthouse: [],
    linkinator: [],
  };

  // Process each URL
  for (const url of limitedUrls) {
    console.log(`[PAGE_PREFLIGHT] Checking: ${url}`);

    // Fetch ignored rules for this URL
    const ignoredCodes = await getIgnoredRuleCodes(testRun.projectId, url);
    if (ignoredCodes.size > 0) {
      console.log(`[PAGE_PREFLIGHT] Found ${ignoredCodes.size} ignored rule(s) for ${url}`);
    }

    const urlCheckResult: UrlCheckResults = {
      url,
      seoScore: null,
      resultItems: [],
      linkCount: 0,
      brokenLinkCount: 0,
      score: 100,  // Will be calculated after processing
    };

    try {
      // Run Lighthouse SEO checks
      const { resultItems: seoItems, result: lighthouseResult } = await runLighthouseSeo(url);
      urlCheckResult.resultItems.push(...seoItems);

      if (lighthouseResult) {
        urlCheckResult.seoScore = lighthouseResult.seoScore;
        urlCheckResult.lighthouseRaw = lighthouseResult;
        rawPayload.lighthouse.push({ url, result: lighthouseResult });
      }

      // Run Linkinator checks
      const { resultItems: linkItems, result: linkinatorResult } = await runLinkinator(url);
      urlCheckResult.resultItems.push(...linkItems);

      if (linkinatorResult) {
        urlCheckResult.linkCount = linkinatorResult.totalLinks;
        // Count actual broken links from ResultItems (excludes whitelisted CDNs)
        urlCheckResult.brokenLinkCount = linkItems.filter(
          item => item.code === 'BROKEN_INTERNAL_LINK' || item.code === 'BROKEN_EXTERNAL_LINK'
        ).length;
        urlCheckResult.linkinatorRaw = linkinatorResult;
        rawPayload.linkinator.push({ url, result: linkinatorResult });
      }

      // Run custom rules (H1, viewport, etc.)
      const customItems = await runCustomRulesWithErrorHandling(url);
      urlCheckResult.resultItems.push(...customItems);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[PAGE_PREFLIGHT] Error checking ${url}:`, errorMessage);

      // Add a failed result item for the error
      urlCheckResult.resultItems.push({
        provider: IssueProvider.INTERNAL,
        code: 'CHECK_FAILED',
        name: 'URL Check Failed',
        status: ResultStatus.FAIL,
        severity: IssueSeverity.HIGH,
        meta: { error: errorMessage },
      });
    }

    // Apply ignored rules to result items
    urlCheckResult.resultItems = applyIgnoredRules(urlCheckResult.resultItems, ignoredCodes);

    // Calculate per-URL score from non-ignored failed items
    urlCheckResult.score = calculateScore(
      urlCheckResult.resultItems.filter(i => i.status === ResultStatus.FAIL && !i.ignored)
    );
    console.log(`[PAGE_PREFLIGHT] URL score for ${url}: ${urlCheckResult.score}`);

    allUrlResults.push(urlCheckResult);
  }

  // Store results in database
  let totalPassCount = 0;
  let totalFailCount = 0;

  for (const urlResult of allUrlResults) {
    // Create UrlResult first
    const createdUrlResult = await prisma.urlResult.create({
      data: {
        testRunId: testRun.id,
        url: urlResult.url,
        preflightScore: urlResult.score,  // Store calculated score for summary display
        issueCount: urlResult.resultItems.filter(r => r.status === ResultStatus.FAIL).length,
        additionalMetrics: {
          seoScore: urlResult.seoScore,
          linkCount: urlResult.linkCount,
          brokenLinkCount: urlResult.brokenLinkCount,
          lighthouse: urlResult.lighthouseRaw ? {
            seoScore: urlResult.lighthouseRaw.seoScore,
            performanceScore: urlResult.lighthouseRaw.performanceScore,
            accessibilityScore: urlResult.lighthouseRaw.accessibilityScore,
          } : null,
          linkinator: urlResult.linkinatorRaw ? {
            totalLinks: urlResult.linkinatorRaw.totalLinks,
            redirects: urlResult.linkinatorRaw.redirects?.length || 0,
          } : null,
        },
      },
    });

    // Create ResultItems linked to this UrlResult
    if (urlResult.resultItems.length > 0) {
      await prisma.resultItem.createMany({
        data: urlResult.resultItems.map(item => ({
          urlResultId: createdUrlResult.id,
          provider: item.provider,
          code: item.code,
          releaseRuleCode: item.code, // Preflight codes match ReleaseRule codes
          name: item.name,
          status: item.status,
          severity: item.severity,
          meta: item.meta,
          ignored: item.ignored ?? false,
        })),
      });
    }

    // Count pass/fail
    totalPassCount += urlResult.resultItems.filter(r => r.status === ResultStatus.PASS).length;
    totalFailCount += urlResult.resultItems.filter(r => r.status === ResultStatus.FAIL).length;
  }

  console.log(`[PAGE_PREFLIGHT] Stored ${allUrlResults.length} URL results`);
  console.log(`[PAGE_PREFLIGHT] Total checks: ${totalPassCount} passed, ${totalFailCount} failed`);

  // Update TestRun with rawPayload
  await prisma.testRun.update({
    where: { id: testRun.id },
    data: { rawPayload },
  });

  // Calculate average score across all URLs
  const urlScores = allUrlResults.map(r => r.score);
  const averageScore = urlScores.length > 0
    ? Math.round(urlScores.reduce((sum, s) => sum + s, 0) / urlScores.length)
    : 100;

  // Log summary
  const failedItems = allUrlResults.flatMap(r => r.resultItems.filter(i => i.status === ResultStatus.FAIL));
  const blockerCount = failedItems.filter(i => i.severity === IssueSeverity.BLOCKER).length;
  const criticalCount = failedItems.filter(i => i.severity === IssueSeverity.CRITICAL).length;
  const highCount = failedItems.filter(i => i.severity === IssueSeverity.HIGH).length;
  const mediumCount = failedItems.filter(i => i.severity === IssueSeverity.MEDIUM).length;
  const lowCount = failedItems.filter(i => i.severity === IssueSeverity.LOW).length;

  console.log(`[PAGE_PREFLIGHT] Completed. Average score: ${averageScore} (${getScoreStatus(averageScore)})`);
  console.log(`[PAGE_PREFLIGHT] Per-URL scores: ${urlScores.join(', ')}`);
  console.log(`[PAGE_PREFLIGHT] Failed by severity: ${blockerCount} blocker, ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low`);

  return averageScore;
}

/**
 * Get ignored rule codes for a project and URL
 * Used to auto-apply ignores to new ResultItems
 */
async function getIgnoredRuleCodes(projectId: string, url: string): Promise<Set<string>> {
  const ignoredRules = await prisma.ignoredRule.findMany({
    where: { projectId, url },
    select: { code: true },
  });
  return new Set(ignoredRules.map(r => r.code));
}

/**
 * Apply ignored status to result items based on project's ignored rules
 */
function applyIgnoredRules(
  items: ResultItemToCreate[],
  ignoredCodes: Set<string>
): ResultItemToCreate[] {
  return items.map(item => ({
    ...item,
    ignored: ignoredCodes.has(item.code),
  }));
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
 * Returns ALL audit results (pass + fail)
 */
async function runLighthouseSeo(url: string): Promise<{ resultItems: ResultItemToCreate[]; result: PageSpeedResult | null }> {
  const resultItems: ResultItemToCreate[] = [];
  let result: PageSpeedResult | null = null;

  try {
    console.log(`[PAGE_PREFLIGHT] Running Lighthouse SEO for ${url}...`);
    result = await runPageSpeed(url, 'mobile', ['seo']);

    console.log(`[PAGE_PREFLIGHT] Lighthouse SEO response: seoScore=${result.seoScore}, audits=${result.seoAudits.length}`);

    // Create ResultItems for ALL audits (pass + fail)
    for (const audit of result.seoAudits) {
      const isPassing = audit.score === null || audit.score >= 1;
      const severity = mapSeoAuditSeverity(audit);

      resultItems.push({
        provider: IssueProvider.LIGHTHOUSE,
        code: audit.id,
        name: audit.title,
        status: isPassing ? ResultStatus.PASS : ResultStatus.FAIL,
        severity: isPassing ? undefined : severity,
        meta: {
          description: audit.description,
          displayValue: audit.displayValue,
          score: audit.score,
        },
      });

      console.log(`[PAGE_PREFLIGHT]   Audit: ${audit.id} ${isPassing ? 'PASS' : 'FAIL'} score=${audit.score}`);
    }

    const passCount = resultItems.filter(r => r.status === ResultStatus.PASS).length;
    const failCount = resultItems.filter(r => r.status === ResultStatus.FAIL).length;
    console.log(`[PAGE_PREFLIGHT] Lighthouse SEO: ${passCount} passed, ${failCount} failed for ${url}`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[PAGE_PREFLIGHT] Lighthouse SEO failed for ${url}:`, errorMsg);

    // Create a failed result item to record the error
    resultItems.push({
      provider: IssueProvider.LIGHTHOUSE,
      code: 'LIGHTHOUSE_API_ERROR',
      name: 'Lighthouse SEO Check Failed',
      status: ResultStatus.FAIL,
      severity: IssueSeverity.HIGH,
      meta: { error: errorMsg },
    });
  }

  return { resultItems, result };
}

/**
 * Run Linkinator link validation
 * Returns results for broken links (no pass items for working links to avoid clutter)
 */
async function runLinkinator(url: string): Promise<{ resultItems: ResultItemToCreate[]; result: LinkCheckSummary | null }> {
  const resultItems: ResultItemToCreate[] = [];
  let result: LinkCheckSummary | null = null;

  try {
    console.log(`[PAGE_PREFLIGHT] Running Linkinator for ${url}...`);
    result = await checkLinks(url, {
      timeout: 30000,
      retryCount: 2,
      checkExternal: true,
    });

    console.log(`[PAGE_PREFLIGHT] Linkinator response: ${result.totalLinks} links, ${result.brokenLinks.length} broken`);

    // Add a summary pass item if no broken links
    if (result.brokenLinks.length === 0) {
      resultItems.push({
        provider: IssueProvider.LINKINATOR,
        code: 'LINK_CHECK_PASSED',
        name: `All ${result.totalLinks} links working`,
        status: ResultStatus.PASS,
        meta: { totalLinks: result.totalLinks },
      });
    }

    // Create ResultItems for broken links
    for (const link of result.brokenLinks) {
      // Skip whitelisted CDNs (often return false positives due to CORS)
      if (isWhitelistedCdn(link.url)) {
        console.log(`[PAGE_PREFLIGHT] Skipping whitelisted CDN: ${link.url}`);
        continue;
      }

      // Skip excluded endpoints (e.g., WordPress API endpoints that require POST)
      if (isExcludedEndpoint(link.url)) {
        console.log(`[PAGE_PREFLIGHT] Skipping excluded endpoint: ${link.url}`);
        continue;
      }

      const isInternal = isInternalLink(url, link.url);
      const severity = mapLinkSeverity(link, isInternal);

      resultItems.push({
        provider: IssueProvider.LINKINATOR,
        code: isInternal ? 'BROKEN_INTERNAL_LINK' : 'BROKEN_EXTERNAL_LINK',
        name: `Broken ${isInternal ? 'internal' : 'external'} link: ${link.url}`,
        status: ResultStatus.FAIL,
        severity,
        meta: {
          brokenUrl: link.url,
          status: link.status,
          failureDetails: link.failureDetails,
          parent: link.parent,
        },
      });
    }

    // Add info items for internal redirect chains
    for (const redirect of result.redirects) {
      if (isInternalLink(url, redirect.url)) {
        resultItems.push({
          provider: IssueProvider.LINKINATOR,
          code: 'REDIRECT_CHAIN',
          name: `Internal redirect: ${redirect.url}`,
          status: ResultStatus.FAIL,
          severity: IssueSeverity.LOW,
          meta: {
            redirectUrl: redirect.url,
            status: redirect.status,
          },
        });
      }
    }

    console.log(`[PAGE_PREFLIGHT] Linkinator: ${resultItems.length} result items for ${url}`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[PAGE_PREFLIGHT] Linkinator failed for ${url}:`, errorMsg);

    // Create a failed result item to record the error
    resultItems.push({
      provider: IssueProvider.LINKINATOR,
      code: 'LINKINATOR_ERROR',
      name: 'Link Check Failed',
      status: ResultStatus.FAIL,
      severity: IssueSeverity.MEDIUM,
      meta: { error: errorMsg },
    });
  }

  return { resultItems, result };
}

/**
 * Check if a link is internal to the same domain
 */
function isInternalLink(pageUrl: string, linkUrl: string): boolean {
  try {
    const pageOrigin = new URL(pageUrl).origin;

    // Handle relative URLs by resolving against page URL
    // This makes "htc.php", "/path/file", etc. resolve correctly
    const resolvedUrl = new URL(linkUrl, pageUrl);
    const linkOrigin = resolvedUrl.origin;

    return pageOrigin === linkOrigin;
  } catch {
    // If we can't parse at all, assume internal (safer - will be flagged as BLOCKER)
    return true;
  }
}

/**
 * Map SEO audit to severity level
 */
function mapSeoAuditSeverity(audit: SeoAudit): IssueSeverity {
  // Blocker SEO issues - page not crawlable or server error
  const blockerAudits = ['is-crawlable', 'http-status-code'];
  // Critical SEO issues - missing essential elements
  const criticalAudits = ['document-title', 'meta-description'];
  // High-impact SEO issues
  const highAudits = ['canonical', 'robots-txt'];
  // Medium-impact SEO issues
  const mediumAudits = ['image-alt', 'link-text'];

  if (blockerAudits.includes(audit.id)) {
    return IssueSeverity.BLOCKER;
  }
  if (criticalAudits.includes(audit.id)) {
    return IssueSeverity.CRITICAL;
  }
  if (highAudits.includes(audit.id)) {
    return IssueSeverity.HIGH;
  }
  if (mediumAudits.includes(audit.id)) {
    return IssueSeverity.MEDIUM;
  }

  return IssueSeverity.LOW;
}

/**
 * Map link check result to severity level
 */
function mapLinkSeverity(link: LinkCheckResult, isInternal: boolean): IssueSeverity {
  // ALL internal broken links are blockers (any status - 404, 403, 0, etc.)
  // These indicate broken functionality that must be fixed before release
  if (isInternal) {
    return IssueSeverity.BLOCKER;
  }

  // External broken links are medium severity (not our fault, but should fix)
  return IssueSeverity.MEDIUM;
}

/**
 * Calculate score based on failed items
 *
 * Uses severity penalties from SCORING_CONFIG.
 * Score starts at 100 and deducts based on severity.
 */
function calculateScore(failedItems: ResultItemToCreate[]): number {
  let score = 100;

  for (const item of failedItems) {
    if (!item.severity) continue;

    const penalty = SCORING_CONFIG.severityPenalties[item.severity] || 0;
    score -= penalty;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Run custom rules with error handling
 * Returns result items even on partial failure
 */
async function runCustomRulesWithErrorHandling(url: string): Promise<ResultItemToCreate[]> {
  try {
    console.log(`[PAGE_PREFLIGHT] Running custom rules for ${url}...`);
    const items = await runCustomRules(url);

    const passCount = items.filter(i => i.status === ResultStatus.PASS).length;
    const failCount = items.filter(i => i.status === ResultStatus.FAIL).length;
    console.log(`[PAGE_PREFLIGHT] Custom rules: ${passCount} passed, ${failCount} failed for ${url}`);

    return items;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[PAGE_PREFLIGHT] Custom rules failed for ${url}:`, errorMsg);

    // Return a single error item so we know custom rules failed
    return [{
      provider: IssueProvider.ReleasePass,
      code: 'CUSTOM_RULES_ERROR',
      name: 'Custom Rules Check Failed',
      status: ResultStatus.FAIL,
      severity: IssueSeverity.HIGH,
      meta: { error: errorMsg },
    }];
  }
}
