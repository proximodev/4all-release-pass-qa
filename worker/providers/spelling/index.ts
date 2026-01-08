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
import { checkSpelling, isConfigured, getConfigInfo, SpellingMatch } from './languagetool-client';
import { calculateScoreFromItems } from '../../lib/scoring';

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
  ignored?: boolean;
}

interface UrlSpellingResult {
  url: string;
  resultItems: ResultItemToCreate[];
  issueCount: number;
  wordCount: number;
  language: string;
  score: number;  // Calculated score (0-100)
}

/**
 * Process a Spelling test run
 *
 * Returns a score (0-100) based on failed item severity.
 * Pass/fail is determined by score threshold (see lib/scoring.ts).
 */
export async function processSpelling(testRun: TestRunWithRelations): Promise<number> {
  console.log(`[SPELLING] Starting for test run ${testRun.id}`);

  // Check LanguageTool configuration
  if (!isConfigured()) {
    throw new Error(
      'LanguageTool not configured. Set LANGUAGETOOL_URL for self-hosted or LANGUAGETOOL_API_KEY for cloud API.'
    );
  }

  // Get URLs to test (deduplicated)
  const urls = [...new Set(getUrlsToTest(testRun))];

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

    // Fetch ignored rules for this URL
    const ignoredCodes = await getIgnoredRuleCodes(testRun.projectId, url);
    if (ignoredCodes.size > 0) {
      console.log(`[SPELLING] Found ${ignoredCodes.size} ignored rule(s) for ${url}`);
    }

    try {
      const result = await checkUrlSpelling(url);

      // Apply ignored rules to result items
      result.resultItems = applyIgnoredRules(result.resultItems, ignoredCodes);

      // Calculate score from non-ignored failed items
      result.score = calculateScoreFromItems(
        result.resultItems.filter(i => !i.ignored)
      );

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

      // Create an error result with score penalty
      const errorItems = [
        {
          provider: IssueProvider.LANGUAGETOOL,
          code: 'SPELLING_CHECK_FAILED',
          name: 'Spelling check failed',
          status: ResultStatus.FAIL,
          severity: IssueSeverity.HIGH,
          meta: { error: errorMsg },
        },
      ];
      allResults.push({
        url,
        resultItems: errorItems,
        issueCount: 0,
        wordCount: 0,
        language: 'unknown',
        score: calculateScoreFromItems(errorItems),
      });
    }
  }

  // Store results in database
  let totalIssueCount = 0;

  for (const result of allResults) {
    // Create UrlResult with score
    const urlResult = await prisma.urlResult.create({
      data: {
        testRunId: testRun.id,
        url: result.url,
        preflightScore: result.score,  // Store calculated score
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
          ignored: item.ignored ?? false,
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

  // Calculate average score across all URLs
  const urlScores = allResults.map(r => r.score);
  const averageScore = urlScores.length > 0
    ? Math.round(urlScores.reduce((sum, s) => sum + s, 0) / urlScores.length)
    : 100;

  console.log(`[SPELLING] Completed. ${allResults.length} URLs checked, ${totalIssueCount} total issues`);
  console.log(`[SPELLING] Average score: ${averageScore}, per-URL scores: ${urlScores.join(', ')}`);

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
      score: 100,  // No issues = perfect score
    };
  }

  // Check spelling with LanguageTool
  // Disabled categories/rules can be configured via LANGUAGETOOL_DISABLED_CATEGORIES env var
  const spellingResult = await checkSpelling(text, {
    language: 'auto',
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
    score: calculateScoreFromItems(resultItems),  // Calculate initial score
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

  // Get the main content area - prioritize selectors to avoid nested duplicates
  // Check each selector in order and use the first match
  const contentSelectors = ['main', 'article', '[role="main"]', '.content', '#content'];
  let text = '';

  for (const selector of contentSelectors) {
    const $match = $(selector);
    if ($match.length > 0) {
      // Take only the first match to avoid nested element duplication
      text = $match.first().text();
      break;
    }
  }

  // Fall back to body if no main content area found
  if (!text) {
    text = $('body').text();
  }

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

  return {
    provider: IssueProvider.LANGUAGETOOL,
    code,
    name: match.shortMessage || match.message,
    status: ResultStatus.FAIL,
    severity,
    meta: {
      message: match.message,
      sentence: match.sentence,
      context: match.context.text,
      contextOffset: match.context.offset,
      contextLength: match.context.length,
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
 * Clamp severity to a maximum value
 */
function clampSeverity(max: IssueSeverity, value: IssueSeverity): IssueSeverity {
  const order = [
    IssueSeverity.INFO,
    IssueSeverity.LOW,
    IssueSeverity.MEDIUM,
    IssueSeverity.HIGH,
    IssueSeverity.CRITICAL,
    IssueSeverity.BLOCKER,
  ];
  const maxIndex = order.indexOf(max);
  const valueIndex = order.indexOf(value);
  return valueIndex > maxIndex ? max : value;
}

/**
 * Bump severity up or down by delta, clamping to valid range
 */
function bumpSeverity(value: IssueSeverity, delta: number): IssueSeverity {
  const order = [
    IssueSeverity.INFO,
    IssueSeverity.LOW,
    IssueSeverity.MEDIUM,
    IssueSeverity.HIGH,
    IssueSeverity.CRITICAL,
    IssueSeverity.BLOCKER,
  ];
  const currentIndex = order.indexOf(value);
  const newIndex = Math.max(0, Math.min(order.length - 1, currentIndex + delta));
  return order[newIndex];
}

/**
 * Map LanguageTool issue type + category to our severity levels
 *
 * Two-stage approach:
 * Stage 1: Baseline severity by issueType
 * Stage 2: Caps and nudges by categoryId
 */
function mapIssueSeverity(issueType: string, categoryId: string): IssueSeverity {
  const it = (issueType || 'uncategorized').toLowerCase();
  const cat = (categoryId || '').toUpperCase();

  // --- Stage 1: baseline severity by issueType ---
  const baseByIssueType: Record<string, IssueSeverity> = {
    misspelling: IssueSeverity.HIGH,
    typographical: IssueSeverity.HIGH,

    grammar: IssueSeverity.MEDIUM,
    terminology: IssueSeverity.MEDIUM,
    markup: IssueSeverity.MEDIUM,

    numbers: IssueSeverity.LOW,
    formatting: IssueSeverity.LOW,
    characters: IssueSeverity.LOW,

    inconsistency: IssueSeverity.INFO,
    duplication: IssueSeverity.INFO,
    'locale-specific-content': IssueSeverity.INFO,
    'locale-violation': IssueSeverity.INFO,
    internationalization: IssueSeverity.INFO,
    addition: IssueSeverity.INFO,
    'non-conformance': IssueSeverity.INFO,
    length: IssueSeverity.INFO,
    'pattern-problem': IssueSeverity.INFO,
    other: IssueSeverity.INFO,
    uncategorized: IssueSeverity.INFO,
    legal: IssueSeverity.INFO,
    whitespace: IssueSeverity.INFO,
    style: IssueSeverity.INFO,
    register: IssueSeverity.INFO,

    // Translation-centric (won't usually appear unless doing i18n QA)
    mistranslation: IssueSeverity.HIGH,
    untranslated: IssueSeverity.HIGH,
    omission: IssueSeverity.HIGH,
  };

  let severity = baseByIssueType[it] ?? IssueSeverity.LOW;

  // --- Stage 2A: hard caps by category (marketing-friendly) ---
  const capsByCategory: Record<string, IssueSeverity> = {
    TYPOGRAPHY: IssueSeverity.LOW,
    PUNCTUATION: IssueSeverity.LOW,

    STYLE: IssueSeverity.INFO,
    COLLOQUIALISMS: IssueSeverity.INFO,
    GENDER_NEUTRALITY: IssueSeverity.INFO,
    REGIONALISMS: IssueSeverity.INFO,
    CREATIVE_WRITING: IssueSeverity.INFO,
    WIKIPEDIA: IssueSeverity.INFO,

    CASING: IssueSeverity.MEDIUM,
  };

  const cap = capsByCategory[cat];
  if (cap !== undefined) {
    severity = clampSeverity(cap, severity);
  }

  // --- Stage 2B: soft adjustments (nudges) ---
  const bumpByCategory: Record<string, number> = {
    TYPOS: +1,
    CONFUSED_WORDS: +1,
    SEMANTICS: +1,
    PROPER_NOUNS: +1,
  };

  const delta = bumpByCategory[cat] ?? 0;
  if (delta !== 0) {
    severity = bumpSeverity(severity, delta);
    // Re-apply cap if there is one
    if (cap !== undefined) {
      severity = clampSeverity(cap, severity);
    }
  }

  return severity;
}
