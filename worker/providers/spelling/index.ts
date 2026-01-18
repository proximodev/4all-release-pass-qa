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
import { retryWithBackoff } from '../../lib/retry';
import { checkSpelling, isConfigured, getConfigInfo, SpellingMatch } from './languagetool-client';
import { calculateScoreFromItems } from '../../lib/scoring';
import { createLimiter, CONCURRENCY } from '../../lib/concurrency';

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

interface FilteredProperNoun {
  word: string;
  reason: string;
}

/**
 * Entity suffixes that indicate the preceding word is likely a proper noun.
 * Case-sensitive matching - suffixes must appear exactly as listed.
 */
const ENTITY_SUFFIXES = [
  // Geographic
  'County', 'City', 'State', 'Township', 'Village', 'District',
  // Business
  'Inc', 'Inc.', 'LLC', 'LLC.', 'Co', 'Co.', 'Corp', 'Corp.',
  'Ltd', 'Ltd.', 'LLP', 'Corporation', 'Limited',
  // Academic
  'University', 'College', 'School', 'Institute', 'Academy',
  // Streets
  'Street', 'St', 'St.', 'Avenue', 'Ave', 'Ave.', 'Road', 'Rd', 'Rd.',
  'Boulevard', 'Blvd', 'Blvd.', 'Drive', 'Dr', 'Dr.', 'Lane', 'Ln',
  'Way', 'Highway', 'Hwy',
  // Other
  'Foundation', 'Association', 'Center', 'Hospital', 'Church', 'Park', 'Building',
];

interface UrlSpellingResult {
  url: string;
  success: true;
  resultItems: ResultItemToCreate[];
  issueCount: number;
  wordCount: number;
  language: string;
  score: number;  // Calculated score (0-100)
  filteredProperNouns: FilteredProperNoun[];
}

interface UrlSpellingError {
  url: string;
  success: false;
  error: string;  // Operational error message
}

type UrlSpellingOutcome = UrlSpellingResult | UrlSpellingError;

/**
 * Result returned by processSpelling to indicate success/failure
 */
export interface SpellingProviderResult {
  score: number | null;  // null if any URL failed operationally
  failedUrls: number;
  totalUrls: number;
  error?: string;  // Summary error message if failedUrls > 0
}

/**
 * Process a Spelling test run
 *
 * Returns a result object indicating success/failure.
 * If any URL fails operationally, score is null and test should be marked FAILED.
 * Pass/fail for successful tests is determined by score threshold (see lib/scoring.ts).
 */
export async function processSpelling(testRun: TestRunWithRelations): Promise<SpellingProviderResult> {
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

  const rawPayload: { languagetool: any[] } = { languagetool: [] };

  // Process URLs concurrently with limited parallelism
  const limit = createLimiter(CONCURRENCY.SPELLING);

  const allOutcomes = await Promise.all(
    limitedUrls.map((url, index) => limit(async (): Promise<UrlSpellingOutcome> => {
      console.log(`[SPELLING] [${index + 1}/${limitedUrls.length}] Checking: ${url}`);

      // Fetch ignored rules for this URL
      const ignoredCodes = await getIgnoredRuleCodes(testRun.projectId, url);
      if (ignoredCodes.size > 0) {
        console.log(`[SPELLING] Found ${ignoredCodes.size} ignored rule(s) for ${url}`);
      }

      try {
        const checkResult = await checkUrlSpelling(url);

        // Apply ignored rules to result items
        const resultItems = applyIgnoredRules(checkResult.resultItems, ignoredCodes);

        // Calculate score from non-ignored failed items
        const score = calculateScoreFromItems(
          resultItems.filter(i => !i.ignored)
        );

        // Store raw response for debugging (includes filtered proper nouns for tuning)
        rawPayload.languagetool.push({
          url,
          issueCount: checkResult.issueCount,
          wordCount: checkResult.wordCount,
          language: checkResult.language,
          filteredProperNouns: checkResult.filteredProperNouns,
        });

        console.log(
          `[SPELLING] ${url}: ${checkResult.issueCount} issues, ${checkResult.wordCount} words, language: ${checkResult.language}`
        );

        return {
          ...checkResult,
          success: true as const,
          resultItems,
          score,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[SPELLING] Failed to check ${url}:`, errorMsg);

        // Track operational error - no ResultItems created
        return {
          url,
          success: false as const,
          error: errorMsg,
        };
      }
    }))
  );

  // Separate successful results from errors
  const successResults = allOutcomes.filter((o): o is UrlSpellingResult => o.success);
  const errorResults = allOutcomes.filter((o): o is UrlSpellingError => !o.success);

  // Store results in database
  let totalIssueCount = 0;

  for (const outcome of allOutcomes) {
    if (outcome.success) {
      // Success: Create UrlResult and ResultItems atomically
      await prisma.$transaction(async (tx) => {
        const urlResult = await tx.urlResult.create({
          data: {
            testRunId: testRun.id,
            url: outcome.url,
            score: outcome.score,
            issueCount: outcome.issueCount,
            additionalMetrics: {
              wordCount: outcome.wordCount,
              language: outcome.language,
            },
          },
        });

        // Create ResultItems
        if (outcome.resultItems.length > 0) {
          await tx.resultItem.createMany({
            data: outcome.resultItems.map((item) => ({
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
      });

      totalIssueCount += outcome.issueCount;
    } else {
      // Error: Create UrlResult with error field, no ResultItems (single operation)
      await prisma.urlResult.create({
        data: {
          testRunId: testRun.id,
          url: outcome.url,
          error: outcome.error,
        },
      });
    }
  }

  // Update TestRun with raw payload
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
      ? errorResults[0].error  // All failed: use first error message
      : `${failedUrls} of ${totalUrls} URLs failed operationally`;

    console.log(`[SPELLING] Failed. ${failedUrls} of ${totalUrls} URLs had operational errors`);

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

  console.log(`[SPELLING] Completed. ${totalUrls} URLs checked, ${totalIssueCount} total issues`);
  console.log(`[SPELLING] Average score: ${averageScore}, per-URL scores: ${urlScores.join(', ')}`);

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
 * Check spelling for a single URL
 * Throws on operational errors (fetch failed, API error)
 */
async function checkUrlSpelling(url: string): Promise<Omit<UrlSpellingResult, 'success'>> {
  // Fetch the page with retry for transient failures
  const response = await retryWithBackoff(
    () => fetchWithTimeout(url, {
      timeoutMs: 30000,
      headers: {
        'User-Agent': 'ReleasePass-Bot/1.0 (https://releasepass.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    }),
    { maxRetries: 2, initialDelayMs: 1000 }
  );

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
      filteredProperNouns: [],
    };
  }

  // Check spelling with LanguageTool
  // Disabled categories/rules can be configured via LANGUAGETOOL_DISABLED_CATEGORIES env var
  // Force en-US to prevent false positives from auto-detection (e.g., lorem ipsum triggering Italian rules)
  const spellingResult = await checkSpelling(text, {
    language: 'en-US',
  });

  // Filter out likely proper nouns before creating ResultItems
  const filteredMatches: SpellingMatch[] = [];
  const ignoredMatches: { match: SpellingMatch; reason: string }[] = [];

  for (const match of spellingResult.matches) {
    const result = shouldIgnoreAsProperNoun(match);
    if (result.ignore) {
      ignoredMatches.push({ match, reason: result.reason! });
    } else {
      filteredMatches.push(match);
    }
  }

  // Log filtered matches for debugging
  if (ignoredMatches.length > 0) {
    console.log(`[SPELLING] Filtered ${ignoredMatches.length} likely proper noun(s):`);
    for (const { match, reason } of ignoredMatches) {
      const word = match.context.text.substring(
        match.context.offset,
        match.context.offset + match.context.length
      );
      console.log(`  - "${word}" (${reason})`);
    }
  }

  const resultItems: ResultItemToCreate[] = [];

  // If no issues found after filtering, create a PASS item
  if (filteredMatches.length === 0) {
    resultItems.push({
      provider: IssueProvider.LANGUAGETOOL,
      code: 'SPELLING_CHECK_PASSED',
      name: `No spelling or grammar issues found (${wordCount} words)`,
      status: ResultStatus.PASS,
      meta: {
        wordCount,
        language: spellingResult.language.code,
        filteredCount: ignoredMatches.length,
      },
    });
  } else {
    // Create a ResultItem for each remaining issue
    for (const match of filteredMatches) {
      resultItems.push(mapMatchToResultItem(match));
    }
  }

  // Build filtered proper nouns list for rawPayload
  const filteredProperNouns: FilteredProperNoun[] = ignoredMatches.map(({ match, reason }) => ({
    word: match.context.text.substring(
      match.context.offset,
      match.context.offset + match.context.length
    ),
    reason,
  }));

  return {
    url,
    resultItems,
    issueCount: filteredMatches.length,
    wordCount,
    language: spellingResult.language.code,
    score: calculateScoreFromItems(resultItems),  // Calculate initial score
    filteredProperNouns,
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
 * Check if a spelling match should be ignored as a likely proper noun
 *
 * Heuristics:
 * 1. Internal caps (camelCase): iPhone, OpenAI, McGraw
 * 2. Short all-caps (2-6 chars): NASA, FBI, LLC
 * 3. Title Case followed by entity suffix: "Coconino County", "Acme Inc"
 * 4. Title Case (2+ chars) preceded by lowercase (mid-sentence proper noun): "in Coconino"
 *
 * Returns { ignore: true, reason: string } if should be filtered out
 */
function shouldIgnoreAsProperNoun(match: SpellingMatch): { ignore: boolean; reason?: string } {
  const context = match.context.text;
  const offset = match.context.offset;
  const length = match.context.length;
  const word = context.substring(offset, offset + length);

  // Heuristic: Internal caps (camelCase/PascalCase with internal lowercase then uppercase)
  if (/[a-z][A-Z]/.test(word)) {
    return { ignore: true, reason: 'internal-caps' };
  }

  // Heuristic: Short all-caps (2-6 chars) - likely acronym
  if (/^[A-Z]{2,6}$/.test(word)) {
    return { ignore: true, reason: 'all-caps-acronym' };
  }

  // Heuristic: Title Case word followed by entity suffix (e.g., "Coconino County")
  if (/^[A-Z][a-z]+$/.test(word)) {
    const afterWord = context.substring(offset + length);
    // Extract next token (skip whitespace, grab word characters and periods for abbreviations)
    const nextTokenMatch = afterWord.match(/^\s+([\w.]+)/);
    if (nextTokenMatch) {
      const nextToken = nextTokenMatch[1];
      if (ENTITY_SUFFIXES.includes(nextToken)) {
        return { ignore: true, reason: 'followed-by-entity-suffix' };
      }
    }
  }

  // Heuristic: Title Case (2+ chars), preceded by lowercase letter (mid-sentence proper noun)
  if (/^[A-Z][a-z]+$/.test(word) && word.length >= 2) {
    const charBefore = offset > 0 ? context[offset - 1] : '';
    if (/[a-z]/.test(charBefore)) {
      return { ignore: true, reason: 'title-case-mid-sentence' };
    }
  }

  return { ignore: false };
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
    typographical: IssueSeverity.HIGH,

    misspelling: IssueSeverity.MEDIUM,
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
