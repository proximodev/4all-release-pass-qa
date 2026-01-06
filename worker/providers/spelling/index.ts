/**
 * Spelling Provider
 *
 * Checks pages for spelling and grammar issues using LanguageTool.
 *
 * Process:
 * 1. Fetch page HTML
 * 2. Extract visible text content
 * 3. Send to LanguageTool API for checking
 * 4. Store issues as ResultItems
 *
 * Supports both self-hosted and cloud LanguageTool instances.
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { prisma } from '../../lib/prisma';
import { IssueProvider, IssueSeverity, ResultStatus } from '@prisma/client';
import { fetchWithTimeout } from '../../lib/fetch';
import { checkSpelling, isConfigured, getConfigInfo, SpellingMatch } from '../languagetool/client';

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
  meta?: any;  // Prisma JSON field
}

interface UrlSpellingResult {
  url: string;
  resultItems: ResultItemToCreate[];
  issueCount: number;
  wordCount: number;
  language: string;
}

/**
 * Process a Spelling test run
 *
 * Unlike Preflight/Performance, Spelling doesn't produce a numeric score.
 * Results are stored for manual review.
 */
export async function processSpelling(testRun: TestRunWithRelations): Promise<void> {
  console.log(`[SPELLING] Starting for test run ${testRun.id}`);

  // Check LanguageTool configuration
  if (!isConfigured()) {
    throw new Error(
      'LanguageTool not configured. Set LANGUAGETOOL_URL for self-hosted or LANGUAGETOOL_API_KEY for cloud API.'
    );
  }

  console.log(`[SPELLING] Using ${getConfigInfo()}`);

  // Get URLs to test
  const urls = getUrlsToTest(testRun);

  if (urls.length === 0) {
    throw new Error('No URLs to test. Configure URLs in TestRunConfig or ReleaseRun.');
  }

  console.log(`[SPELLING] Checking ${urls.length} URL(s)`);

  // Limit to 20 URLs per run (spelling checks can be slow)
  const limitedUrls = urls.slice(0, 20);
  if (urls.length > 20) {
    console.log(`[SPELLING] Limited to 20 URLs (was ${urls.length})`);
  }

  const allResults: UrlSpellingResult[] = [];
  const rawPayload: { languagetool: any[] } = { languagetool: [] };

  // Process each URL
  for (const url of limitedUrls) {
    console.log(`[SPELLING] Checking: ${url}`);

    try {
      const result = await checkUrlSpelling(url);
      allResults.push(result);

      // Store raw response for debugging
      rawPayload.languagetool.push({
        url,
        issueCount: result.issueCount,
        wordCount: result.wordCount,
        language: result.language,
      });

      console.log(
        `[SPELLING] ${url}: ${result.issueCount} issues, ${result.wordCount} words, language: ${result.language}`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SPELLING] Failed to check ${url}:`, errorMsg);

      // Create an error result
      allResults.push({
        url,
        resultItems: [
          {
            provider: IssueProvider.LANGUAGETOOL,
            code: 'SPELLING_CHECK_FAILED',
            name: 'Spelling check failed',
            status: ResultStatus.FAIL,
            severity: IssueSeverity.HIGH,
            meta: { error: errorMsg },
          },
        ],
        issueCount: 0,
        wordCount: 0,
        language: 'unknown',
      });
    }
  }

  // Store results in database
  let totalIssueCount = 0;

  for (const result of allResults) {
    // Create UrlResult
    const urlResult = await prisma.urlResult.create({
      data: {
        testRunId: testRun.id,
        url: result.url,
        issueCount: result.issueCount,
        additionalMetrics: {
          wordCount: result.wordCount,
          language: result.language,
        },
      },
    });

    // Create ResultItems
    if (result.resultItems.length > 0) {
      await prisma.resultItem.createMany({
        data: result.resultItems.map((item) => ({
          urlResultId: urlResult.id,
          provider: item.provider,
          code: item.code,
          name: item.name,
          status: item.status,
          severity: item.severity,
          meta: item.meta,
        })),
      });
    }

    totalIssueCount += result.issueCount;
  }

  // Update TestRun with raw payload
  await prisma.testRun.update({
    where: { id: testRun.id },
    data: { rawPayload },
  });

  console.log(`[SPELLING] Completed. ${allResults.length} URLs checked, ${totalIssueCount} total issues`);
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
 * Check spelling for a single URL
 */
async function checkUrlSpelling(url: string): Promise<UrlSpellingResult> {
  // Fetch the page
  const response = await fetchWithTimeout(url, {
    timeoutMs: 30000,
    headers: {
      'User-Agent': 'ReleasePass-Bot/1.0 (https://releasepass.app)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract visible text
  const text = extractVisibleText($);
  const wordCount = countWords(text);

  // Skip if no meaningful text content
  if (wordCount < 10) {
    return {
      url,
      resultItems: [
        {
          provider: IssueProvider.LANGUAGETOOL,
          code: 'SPELLING_INSUFFICIENT_TEXT',
          name: 'Insufficient text content for spelling check',
          status: ResultStatus.SKIP,
          meta: { wordCount, reason: 'Less than 10 words of visible text' },
        },
      ],
      issueCount: 0,
      wordCount,
      language: 'unknown',
    };
  }

  // Check spelling with LanguageTool
  const spellingResult = await checkSpelling(text, {
    language: 'auto',
    // Disable some noisy categories for web content
    disabledCategories: ['TYPOGRAPHY', 'CASING'],
  });

  const resultItems: ResultItemToCreate[] = [];

  // If no issues found, create a PASS item
  if (spellingResult.matches.length === 0) {
    resultItems.push({
      provider: IssueProvider.LANGUAGETOOL,
      code: 'SPELLING_CHECK_PASSED',
      name: `No spelling or grammar issues found (${wordCount} words)`,
      status: ResultStatus.PASS,
      meta: { wordCount, language: spellingResult.language.code },
    });
  } else {
    // Create a ResultItem for each issue
    for (const match of spellingResult.matches) {
      resultItems.push(mapMatchToResultItem(match));
    }
  }

  return {
    url,
    resultItems,
    issueCount: spellingResult.matches.length,
    wordCount,
    language: spellingResult.language.code,
  };
}

/**
 * Extract visible text from HTML, excluding scripts, styles, nav, footer, etc.
 */
function extractVisibleText($: CheerioAPI): string {
  // Remove elements that don't contain user-facing content
  $('script, style, noscript, iframe, svg, canvas').remove();
  $('nav, header, footer, aside').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  $('[aria-hidden="true"]').remove();

  // Remove common UI elements that might have boilerplate text
  $('.cookie-notice, .cookie-banner, #cookie-consent').remove();
  $('.newsletter-signup, .popup, .modal').remove();

  // Get the main content area if it exists
  let $content = $('main, article, [role="main"], .content, #content');

  // Fall back to body if no main content area found
  if ($content.length === 0) {
    $content = $('body');
  }

  // Get text content
  let text = $content.text();

  // Clean up the text
  text = text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove common artifacts
    .replace(/\u00A0/g, ' ') // Non-breaking spaces
    .replace(/\u200B/g, '') // Zero-width spaces
    .trim();

  return text;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Map a LanguageTool match to a ResultItem
 */
function mapMatchToResultItem(match: SpellingMatch): ResultItemToCreate {
  // Determine severity based on issue type
  const severity = mapIssueSeverity(match.rule.issueType, match.rule.category.id);

  // Create a unique code from rule ID
  const code = `SPELLING_${match.rule.id}`;

  // Format the issue name
  const contextText = match.context.text.substring(
    Math.max(0, match.context.offset - 10),
    Math.min(match.context.text.length, match.context.offset + match.context.length + 10)
  );

  return {
    provider: IssueProvider.LANGUAGETOOL,
    code,
    name: match.shortMessage || match.message,
    status: ResultStatus.FAIL,
    severity,
    meta: {
      message: match.message,
      context: contextText,
      offset: match.offset,
      length: match.length,
      replacements: match.replacements,
      ruleId: match.rule.id,
      ruleDescription: match.rule.description,
      category: match.rule.category.name,
      issueType: match.rule.issueType,
    },
  };
}

/**
 * Map LanguageTool issue type to our severity levels
 */
function mapIssueSeverity(issueType: string, categoryId: string): IssueSeverity {
  // Misspellings are high severity (looks unprofessional)
  if (issueType === 'misspelling') {
    return IssueSeverity.HIGH;
  }

  // Grammar errors are critical (can change meaning)
  if (issueType === 'grammar' || categoryId === 'GRAMMAR') {
    return IssueSeverity.CRITICAL;
  }

  // Style suggestions are medium
  if (issueType === 'style' || categoryId === 'STYLE') {
    return IssueSeverity.MEDIUM;
  }

  // Typographical issues are low
  if (issueType === 'typographical' || categoryId === 'TYPOGRAPHY') {
    return IssueSeverity.LOW;
  }

  // Default to medium
  return IssueSeverity.MEDIUM;
}
