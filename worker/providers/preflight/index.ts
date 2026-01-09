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

/**
 * Cached ReleaseRule data for severity and display
 */
interface ReleaseRuleCache {
  severity: IssueSeverity;
  name: string;
  description: string;
  impact: string | null;
  fix: string | null;
  docUrl: string | null;
}

type ReleaseRulesMap = Map<string, ReleaseRuleCache>;

/**
 * Load all active ReleaseRules into a Map for fast lookup
 * Called once at start of test run to avoid repeated DB queries
 */
async function loadReleaseRules(): Promise<ReleaseRulesMap> {
  const rules = await prisma.releaseRule.findMany({
    where: { isActive: true },
    select: {
      code: true,
      severity: true,
      name: true,
      description: true,
      impact: true,
      fix: true,
      docUrl: true,
    },
  });

  const rulesMap = new Map<string, ReleaseRuleCache>();
  for (const rule of rules) {
    rulesMap.set(rule.code, {
      severity: rule.severity,
      name: rule.name,
      description: rule.description,
      impact: rule.impact,
      fix: rule.fix,
      docUrl: rule.docUrl,
    });
  }

  console.log(`[PAGE_PREFLIGHT] Loaded ${rulesMap.size} ReleaseRules for severity lookup`);
  return rulesMap;
}

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

interface UrlCheckSuccess {
  url: string;
  success: true;
  seoScore: number | null;
  resultItems: ResultItemToCreate[];
  linkCount: number;
  brokenLinkCount: number;
  score: number;  // Per-URL score calculated from failed items
  lighthouseRaw?: any;
  linkinatorRaw?: any;
}

interface UrlCheckError {
  url: string;
  success: false;
  error: string;  // Operational error message
}

type UrlCheckOutcome = UrlCheckSuccess | UrlCheckError;

/**
 * Result returned by processPagePreflight to indicate success/failure
 */
export interface PreflightProviderResult {
  score: number | null;  // null if any URL failed operationally
  failedUrls: number;
  totalUrls: number;
  error?: string;  // Summary error message if failedUrls > 0
}

/**
 * Process a Page Preflight test run
 *
 * Returns a result object indicating success/failure.
 * If any URL fails operationally, score is null and test should be marked FAILED.
 */
export async function processPagePreflight(testRun: TestRunWithRelations): Promise<PreflightProviderResult> {
  console.log(`[PAGE_PREFLIGHT] Starting for test run ${testRun.id}`);

  // Load ReleaseRules for severity lookup (batch load once)
  const rulesMap = await loadReleaseRules();

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

  const allOutcomes: UrlCheckOutcome[] = [];
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

    try {
      const urlCheckResult: Omit<UrlCheckSuccess, 'success' | 'score'> & { resultItems: ResultItemToCreate[] } = {
        url,
        seoScore: null,
        resultItems: [],
        linkCount: 0,
        brokenLinkCount: 0,
      };

      // Run Lighthouse SEO checks
      const { resultItems: seoItems, result: lighthouseResult } = await runLighthouseSeo(url, rulesMap);
      urlCheckResult.resultItems.push(...seoItems);

      if (lighthouseResult) {
        urlCheckResult.seoScore = lighthouseResult.seoScore;
        urlCheckResult.lighthouseRaw = lighthouseResult;
        rawPayload.lighthouse.push({ url, result: lighthouseResult });
      }

      // Run Linkinator checks
      const { resultItems: linkItems, result: linkinatorResult } = await runLinkinator(url, rulesMap);
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
      const customItems = await runCustomRulesWithErrorHandling(url, rulesMap);
      urlCheckResult.resultItems.push(...customItems);

      // Apply ignored rules to result items
      const resultItems = applyIgnoredRules(urlCheckResult.resultItems, ignoredCodes);

      // Calculate per-URL score from non-ignored failed items
      const score = calculateScore(
        resultItems.filter(i => i.status === ResultStatus.FAIL && !i.ignored)
      );
      console.log(`[PAGE_PREFLIGHT] URL score for ${url}: ${score}`);

      allOutcomes.push({
        ...urlCheckResult,
        success: true,
        resultItems,
        score,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[PAGE_PREFLIGHT] Error checking ${url}:`, errorMessage);

      // Track operational error - no ResultItems created
      allOutcomes.push({
        url,
        success: false,
        error: errorMessage,
      });
    }
  }

  // Separate successful results from errors
  const successResults = allOutcomes.filter((o): o is UrlCheckSuccess => o.success);
  const errorResults = allOutcomes.filter((o): o is UrlCheckError => !o.success);

  // Store results in database
  let totalPassCount = 0;
  let totalFailCount = 0;

  for (const outcome of allOutcomes) {
    if (outcome.success) {
      // Success: Create UrlResult with score and ResultItems
      const createdUrlResult = await prisma.urlResult.create({
        data: {
          testRunId: testRun.id,
          url: outcome.url,
          preflightScore: outcome.score,
          issueCount: outcome.resultItems.filter(r => r.status === ResultStatus.FAIL).length,
          additionalMetrics: {
            seoScore: outcome.seoScore,
            linkCount: outcome.linkCount,
            brokenLinkCount: outcome.brokenLinkCount,
            lighthouse: outcome.lighthouseRaw ? {
              seoScore: outcome.lighthouseRaw.seoScore,
              performanceScore: outcome.lighthouseRaw.performanceScore,
              accessibilityScore: outcome.lighthouseRaw.accessibilityScore,
            } : null,
            linkinator: outcome.linkinatorRaw ? {
              totalLinks: outcome.linkinatorRaw.totalLinks,
              redirects: outcome.linkinatorRaw.redirects?.length || 0,
            } : null,
          },
        },
      });

      // Create ResultItems linked to this UrlResult
      if (outcome.resultItems.length > 0) {
        await prisma.resultItem.createMany({
          data: outcome.resultItems.map(item => ({
            urlResultId: createdUrlResult.id,
            provider: item.provider,
            code: item.code,
            releaseRuleCode: item.code,
            name: item.name,
            status: item.status,
            severity: item.severity,
            meta: item.meta,
            ignored: item.ignored ?? false,
          })),
        });
      }

      // Count pass/fail
      totalPassCount += outcome.resultItems.filter(r => r.status === ResultStatus.PASS).length;
      totalFailCount += outcome.resultItems.filter(r => r.status === ResultStatus.FAIL).length;
    } else {
      // Error: Create UrlResult with error field, no ResultItems
      await prisma.urlResult.create({
        data: {
          testRunId: testRun.id,
          url: outcome.url,
          error: outcome.error,
        },
      });
    }
  }

  console.log(`[PAGE_PREFLIGHT] Stored ${allOutcomes.length} URL results`);
  console.log(`[PAGE_PREFLIGHT] Total checks: ${totalPassCount} passed, ${totalFailCount} failed`);

  // Update TestRun with rawPayload
  await prisma.testRun.update({
    where: { id: testRun.id },
    data: { rawPayload },
  });

  // Determine result based on whether any URLs failed
  const failedUrls = errorResults.length;
  const totalUrls = allOutcomes.length;

  if (failedUrls > 0) {
    // Any operational failure = no score
    const errorSummary = failedUrls === totalUrls
      ? errorResults[0].error
      : `${failedUrls} of ${totalUrls} URLs failed operationally`;

    console.log(`[PAGE_PREFLIGHT] Failed. ${failedUrls} of ${totalUrls} URLs had operational errors`);

    return {
      score: null,
      failedUrls,
      totalUrls,
      error: errorSummary,
    };
  }

  // All URLs succeeded - calculate average score
  const urlScores = successResults.map(r => r.score);
  const averageScore = urlScores.length > 0
    ? Math.round(urlScores.reduce((sum, s) => sum + s, 0) / urlScores.length)
    : 100;

  // Log summary
  const failedItems = successResults.flatMap(r => r.resultItems.filter(i => i.status === ResultStatus.FAIL));
  const blockerCount = failedItems.filter(i => i.severity === IssueSeverity.BLOCKER).length;
  const criticalCount = failedItems.filter(i => i.severity === IssueSeverity.CRITICAL).length;
  const highCount = failedItems.filter(i => i.severity === IssueSeverity.HIGH).length;
  const mediumCount = failedItems.filter(i => i.severity === IssueSeverity.MEDIUM).length;
  const lowCount = failedItems.filter(i => i.severity === IssueSeverity.LOW).length;

  console.log(`[PAGE_PREFLIGHT] Completed. Average score: ${averageScore} (${getScoreStatus(averageScore)})`);
  console.log(`[PAGE_PREFLIGHT] Per-URL scores: ${urlScores.join(', ')}`);
  console.log(`[PAGE_PREFLIGHT] Failed by severity: ${blockerCount} blocker, ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low`);

  return {
    score: averageScore,
    failedUrls: 0,
    totalUrls,
  };
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
 * Get severity from ReleaseRule cache, falling back to hardcoded value
 */
function getSeverityFromRule(
  code: string,
  rulesMap: ReleaseRulesMap,
  fallbackFn: () => IssueSeverity
): IssueSeverity {
  const rule = rulesMap.get(code);
  return rule?.severity ?? fallbackFn();
}

/**
 * Run Lighthouse SEO audits via PageSpeed API
 * Returns ALL audit results (pass + fail)
 */
async function runLighthouseSeo(
  url: string,
  rulesMap: ReleaseRulesMap
): Promise<{ resultItems: ResultItemToCreate[]; result: PageSpeedResult | null }> {
  const resultItems: ResultItemToCreate[] = [];
  let result: PageSpeedResult | null = null;

  try {
    console.log(`[PAGE_PREFLIGHT] Running Lighthouse SEO for ${url}...`);
    result = await runPageSpeed(url, 'mobile', ['seo']);

    console.log(`[PAGE_PREFLIGHT] Lighthouse SEO response: seoScore=${result.seoScore}, audits=${result.seoAudits.length}`);

    // Create ResultItems for ALL audits (pass + fail)
    for (const audit of result.seoAudits) {
      const isPassing = audit.score === null || audit.score >= 1;
      // Use ReleaseRule severity if available, otherwise fall back to hardcoded
      const severity = getSeverityFromRule(audit.id, rulesMap, () => mapSeoAuditSeverity(audit));

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
    // Re-throw to be handled as operational error at URL level
    throw new Error(`Lighthouse SEO failed: ${errorMsg}`);
  }

  return { resultItems, result };
}

/**
 * Run Linkinator link validation
 * Returns results for broken links (no pass items for working links to avoid clutter)
 */
async function runLinkinator(
  url: string,
  rulesMap: ReleaseRulesMap
): Promise<{ resultItems: ResultItemToCreate[]; result: LinkCheckSummary | null }> {
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
      const code = isInternal ? 'BROKEN_INTERNAL_LINK' : 'BROKEN_EXTERNAL_LINK';
      // Use ReleaseRule severity if available, otherwise fall back to hardcoded
      const severity = getSeverityFromRule(code, rulesMap, () => mapLinkSeverity(link, isInternal));

      resultItems.push({
        provider: IssueProvider.LINKINATOR,
        code,
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
        // Use ReleaseRule severity if available, otherwise fall back to hardcoded LOW
        const severity = getSeverityFromRule('REDIRECT_CHAIN', rulesMap, () => IssueSeverity.LOW);
        resultItems.push({
          provider: IssueProvider.LINKINATOR,
          code: 'REDIRECT_CHAIN',
          name: `Internal redirect: ${redirect.url}`,
          status: ResultStatus.FAIL,
          severity,
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
    // Re-throw to be handled as operational error at URL level
    throw new Error(`Link check failed: ${errorMsg}`);
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
 * Run custom rules
 * Throws on operational errors
 */
async function runCustomRulesWithErrorHandling(
  url: string,
  rulesMap: ReleaseRulesMap
): Promise<ResultItemToCreate[]> {
  try {
    console.log(`[PAGE_PREFLIGHT] Running custom rules for ${url}...`);
    const items = await runCustomRules(url, rulesMap);

    const passCount = items.filter(i => i.status === ResultStatus.PASS).length;
    const failCount = items.filter(i => i.status === ResultStatus.FAIL).length;
    console.log(`[PAGE_PREFLIGHT] Custom rules: ${passCount} passed, ${failCount} failed for ${url}`);

    return items;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[PAGE_PREFLIGHT] Custom rules failed for ${url}:`, errorMsg);
    // Re-throw to be handled as operational error at URL level
    throw new Error(`Custom rules failed: ${errorMsg}`);
  }
}
