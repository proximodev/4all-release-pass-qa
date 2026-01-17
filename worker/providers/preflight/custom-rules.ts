/**
 * Custom Preflight Rules
 *
 * HTML-based validation rules for launch-critical page elements.
 * Uses Cheerio for DOM parsing of raw HTML responses.
 *
 * Batch 1: H1 + Viewport rules (4 rules)
 * - PREFLIGHT_H1_MISSING
 * - PREFLIGHT_H1_MULTIPLE
 * - PREFLIGHT_H1_EMPTY
 * - PREFLIGHT_VIEWPORT_MISSING
 *
 * Batch 2: Indexing rules (3 rules)
 * - PREFLIGHT_INDEX_NOINDEX_HEADER
 * - PREFLIGHT_INDEX_NOFOLLOW
 * - PREFLIGHT_INDEX_CONFLICT
 *
 * Batch 3: Canonical rules (6 rules)
 * - PREFLIGHT_CANONICAL_MISSING
 * - PREFLIGHT_CANONICAL_MULTIPLE
 * - PREFLIGHT_CANONICAL_MISMATCH
 * - PREFLIGHT_CANONICAL_PROTOCOL
 * - PREFLIGHT_CANONICAL_HOSTNAME
 * - PREFLIGHT_CANONICAL_PARAMS
 *
 * Batch 4: Security rules (4 rules)
 * - PREFLIGHT_SECURITY_HTTP
 * - PREFLIGHT_SECURITY_HTTP_URLS
 * - PREFLIGHT_SECURITY_MIXED_CONTENT
 * - PREFLIGHT_SECURITY_IFRAME
 *
 * Batch 5: Link rules (1 rule)
 * - PREFLIGHT_EMPTY_LINK
 *
 * Batch 6: Alt tag rules (1 rule)
 * - EMPTY_ALT_TAG
 *
 * Batch 7: Favicon rules (1 rule)
 * - PREFLIGHT_FAVICON_MISSING
 *
 * Batch 8: Meta & Title rules (4 rules)
 * - PREFLIGHT_TITLE_TOO_LONG
 * - PREFLIGHT_TITLE_TOO_SHORT
 * - PREFLIGHT_META_DESC_TOO_LONG
 * - PREFLIGHT_META_DESC_TOO_SHORT
 *
 * Batch 9: External Link rules (1 rule) - OPTIONAL
 * - PREFLIGHT_EXTERNAL_LINK_TARGET
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { IssueProvider, IssueSeverity, ResultStatus } from '@prisma/client';
import { fetchWithTimeout } from '../../lib/fetch';
import { retryWithBackoff } from '../../lib/retry';

/**
 * Cached ReleaseRule data for severity lookup
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

interface ResultItemToCreate {
  provider: IssueProvider;
  code: string;
  name: string;
  status: ResultStatus;
  severity?: IssueSeverity;
  meta?: Record<string, unknown>;
}

interface FetchedPage {
  html: string;
  headers: Headers;
  finalUrl: string;
  protocol: string;
}

/**
 * Get severity from ReleaseRule cache, falling back to hardcoded value
 */
function getSeverityFromRule(
  code: string,
  rulesMap: ReleaseRulesMap,
  fallback: IssueSeverity
): IssueSeverity {
  const rule = rulesMap.get(code);
  return rule?.severity ?? fallback;
}

/**
 * Run all custom rules against a URL
 */
export async function runCustomRules(
  url: string,
  rulesMap: ReleaseRulesMap
): Promise<ResultItemToCreate[]> {
  const results: ResultItemToCreate[] = [];

  const page = await fetchPage(url);
  const $ = cheerio.load(page.html);

  // Batch 1: H1 + Viewport rules
  results.push(...checkH1Rules($, rulesMap));
  results.push(...checkViewportRules($, rulesMap));

  // Batch 2: Indexing rules
  results.push(...checkIndexingRules($, page, rulesMap));

  // Batch 3: Canonical rules
  results.push(...checkCanonicalRules($, page, rulesMap));

  // Batch 4: Security rules
  results.push(...checkSecurityRules($, page, rulesMap));

  // Batch 5: Link rules
  results.push(...checkLinkRules($, rulesMap));

  // Batch 6: Alt tag rules
  results.push(...checkAltTagRules($, rulesMap));

  // Batch 7: Favicon rules
  results.push(...await checkFaviconRules($, page, rulesMap));

  // Batch 8: Meta & Title rules
  results.push(...checkMetaTitleRules($, rulesMap));
  results.push(...checkMetaDescriptionRules($, rulesMap));

  // Batch 9: External Link rules (optional)
  results.push(...checkExternalLinkTargetRules($, page, rulesMap));

  return results;
}

/**
 * Fetch page HTML and headers with retry for transient failures
 */
async function fetchPage(url: string): Promise<FetchedPage> {
  console.log(`[CUSTOM_RULES] Fetching page: ${url}`);
  const response = await retryWithBackoff(
    async () => {
      try {
        return await fetchWithTimeout(url, {
          timeoutMs: 30000,
          headers: {
            'User-Agent': 'ReleasePass-Bot/1.0 (https://releasepass.app)',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });
      } catch (err) {
        const error = err as Error & { cause?: Error; code?: string };
        console.error(`[CUSTOM_RULES] Fetch error for ${url}:`, error.message);
        console.error(`[CUSTOM_RULES] Error name:`, error.name);
        console.error(`[CUSTOM_RULES] Error code:`, error.code || '(none)');
        if (error.cause) {
          const cause = error.cause as Error & { code?: string };
          console.error(`[CUSTOM_RULES] Cause:`, cause.message || cause);
          console.error(`[CUSTOM_RULES] Cause code:`, cause.code || '(none)');
        }
        console.error(`[CUSTOM_RULES] Stack:`, error.stack?.split('\n').slice(0, 5).join('\n'));
        throw err;
      }
    },
    { maxRetries: 2, initialDelayMs: 1000 }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const finalUrl = response.url;
  const protocol = new URL(finalUrl).protocol;

  return {
    html,
    headers: response.headers,
    finalUrl,
    protocol,
  };
}

/**
 * Create a PASS result item
 */
function createPass(code: string, name: string, meta?: Record<string, unknown>): ResultItemToCreate {
  return {
    provider: IssueProvider.ReleasePass,
    code,
    name,
    status: ResultStatus.PASS,
    meta,
  };
}

/**
 * Create a FAIL result item
 * Uses ReleaseRule severity if available, otherwise falls back to provided severity
 */
function createFail(
  code: string,
  name: string,
  fallbackSeverity: IssueSeverity,
  rulesMap: ReleaseRulesMap,
  meta?: Record<string, unknown>
): ResultItemToCreate {
  const severity = getSeverityFromRule(code, rulesMap, fallbackSeverity);
  return {
    provider: IssueProvider.ReleasePass,
    code,
    name,
    status: ResultStatus.FAIL,
    severity,
    meta,
  };
}

// =============================================================================
// Shared Helpers
// =============================================================================

/**
 * Configuration for length bounds checking
 */
interface LengthBoundsConfig {
  tooLongCode: string;
  tooShortCode: string;
  min: number;
  max: number;
  minSeverity: IssueSeverity;
  maxSeverity: IssueSeverity;
  fieldName: string; // e.g., "Title" or "Meta description"
}

/**
 * Check if content length is within min/max bounds
 * Returns PASS/FAIL results for both too-long and too-short rules
 */
function checkLengthBounds(
  content: string,
  config: LengthBoundsConfig,
  rulesMap: ReleaseRulesMap
): ResultItemToCreate[] {
  const results: ResultItemToCreate[] = [];
  const length = content.length;
  const preview = content.substring(0, 80);

  // Check too long
  if (length > config.max) {
    results.push(
      createFail(
        config.tooLongCode,
        `${config.fieldName} exceeds ${config.max} characters (${length} chars)`,
        config.maxSeverity,
        rulesMap,
        { length, maxLength: config.max, [config.fieldName.toLowerCase()]: preview }
      )
    );
  } else {
    results.push(
      createPass(config.tooLongCode, `${config.fieldName} length within limit`, {
        length,
        maxLength: config.max,
      })
    );
  }

  // Check too short
  if (length < config.min) {
    results.push(
      createFail(
        config.tooShortCode,
        `${config.fieldName} below ${config.min} characters (${length} chars)`,
        config.minSeverity,
        rulesMap,
        { length, minLength: config.min, [config.fieldName.toLowerCase()]: preview }
      )
    );
  } else {
    results.push(
      createPass(config.tooShortCode, `${config.fieldName} length sufficient`, {
        length,
        minLength: config.min,
      })
    );
  }

  return results;
}

/**
 * Configuration for HTTP URL scanning
 */
interface HttpUrlScanConfig {
  selector: string;
  attr: string;
}

/**
 * Scan document for HTTP URLs in specified elements
 * Returns array of found HTTP URLs with element context
 */
function findHttpUrls(
  $: CheerioAPI,
  checks: HttpUrlScanConfig[]
): Array<{ tag: string; attr: string; url: string }> {
  const found: Array<{ tag: string; attr: string; url: string }> = [];

  for (const check of checks) {
    $(check.selector).each((_, el) => {
      const $el = $(el);
      const url = $el.attr(check.attr) || '';
      if (url && isHttpUrl(url)) {
        const tagName = $el.prop('tagName');
        found.push({
          tag: typeof tagName === 'string' ? tagName.toLowerCase() : 'unknown',
          attr: check.attr,
          url,
        });
      }
    });
  }

  return found;
}

/**
 * Parsed URL details for canonical/security checks
 */
interface ParsedUrlDetails {
  original: string;
  hostname: string;
  protocol: string;
  normalized: string;
  trackingParams: string[];
}

/** Common tracking/session parameters that should not appear in canonical URLs */
const TRACKING_PARAMS = new Set([
  // Analytics
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'msclkid', 'dclid',
  // Session
  'sessionid', 'session_id', 'sid', 'phpsessid', 'jsessionid',
  // Misc tracking
  'ref', 'affiliate', 'source', 'mc_cid', 'mc_eid',
]);

/**
 * Parse URL and extract all commonly needed details in one pass
 * Returns null if URL is invalid
 */
function parseUrlDetails(urlString: string): ParsedUrlDetails | null {
  try {
    const url = new URL(urlString);

    // Find tracking params
    const trackingParams: string[] = [];
    for (const [key] of url.searchParams) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        trackingParams.push(key);
      }
    }

    // Normalize for comparison
    const normalizedUrl = new URL(urlString);
    normalizedUrl.hostname = normalizedUrl.hostname.toLowerCase();
    if (normalizedUrl.pathname.length > 1 && normalizedUrl.pathname.endsWith('/')) {
      normalizedUrl.pathname = normalizedUrl.pathname.slice(0, -1);
    }
    normalizedUrl.searchParams.sort();

    return {
      original: urlString,
      hostname: url.hostname.toLowerCase(),
      protocol: url.protocol,
      normalized: normalizedUrl.toString(),
      trackingParams,
    };
  } catch {
    return null;
  }
}

/**
 * Check if a URL uses HTTP (insecure)
 */
function isHttpUrl(urlString: string): boolean {
  try {
    return new URL(urlString).protocol === 'http:';
  } catch {
    return urlString.toLowerCase().startsWith('http:');
  }
}

// =============================================================================
// H1 Rules
// =============================================================================

/**
 * Check H1 heading structure rules:
 * - PREFLIGHT_H1_MISSING: No H1 present
 * - PREFLIGHT_H1_MULTIPLE: More than one H1
 * - PREFLIGHT_H1_EMPTY: H1 exists but is empty/whitespace
 */
function checkH1Rules($: CheerioAPI, rulesMap: ReleaseRulesMap): ResultItemToCreate[] {
  const results: ResultItemToCreate[] = [];
  const h1Elements = $('h1');
  const h1Count = h1Elements.length;

  // Check for missing H1
  if (h1Count === 0) {
    results.push(
      createFail(
        'PREFLIGHT_H1_MISSING',
        'No H1 heading found on page',
        IssueSeverity.BLOCKER,
        rulesMap,
        { h1Count: 0 }
      )
    );
    // No point checking other H1 rules if none exist
    return results;
  }

  // H1 exists - pass the missing check
  results.push(
    createPass('PREFLIGHT_H1_MISSING', 'H1 heading present', { h1Count })
  );

  // Check for multiple H1s
  if (h1Count > 1) {
    const h1Texts = h1Elements.map((_, el) => $(el).text().trim().substring(0, 50)).get();
    results.push(
      createFail(
        'PREFLIGHT_H1_MULTIPLE',
        `Multiple H1 headings found (${h1Count})`,
        IssueSeverity.CRITICAL,
        rulesMap,
        { h1Count, h1Texts }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_H1_MULTIPLE', 'Single H1 heading', { h1Count })
    );
  }

  // Check for empty H1
  let hasEmptyH1 = false;
  const emptyH1Indices: number[] = [];

  h1Elements.each((index, el) => {
    const text = $(el).text().trim();
    if (text.length === 0) {
      hasEmptyH1 = true;
      emptyH1Indices.push(index);
    }
  });

  if (hasEmptyH1) {
    results.push(
      createFail(
        'PREFLIGHT_H1_EMPTY',
        'H1 heading is empty or whitespace-only',
        IssueSeverity.BLOCKER,
        rulesMap,
        { emptyH1Indices }
      )
    );
  } else {
    const h1Text = h1Elements.first().text().trim().substring(0, 100);
    results.push(
      createPass('PREFLIGHT_H1_EMPTY', 'H1 heading has content', { h1Text })
    );
  }

  return results;
}

// =============================================================================
// Viewport Rules
// =============================================================================

/**
 * Check viewport meta tag:
 * - PREFLIGHT_VIEWPORT_MISSING: No viewport meta tag
 */
function checkViewportRules($: CheerioAPI, rulesMap: ReleaseRulesMap): ResultItemToCreate[] {
  const results: ResultItemToCreate[] = [];

  // Look for <meta name="viewport" ...>
  const viewportMeta = $('meta[name="viewport"]');

  if (viewportMeta.length === 0) {
    results.push(
      createFail(
        'PREFLIGHT_VIEWPORT_MISSING',
        'Viewport meta tag missing',
        IssueSeverity.CRITICAL,
        rulesMap,
        { reason: 'Page not optimized for mobile devices' }
      )
    );
  } else {
    const content = viewportMeta.attr('content') || '';
    results.push(
      createPass('PREFLIGHT_VIEWPORT_MISSING', 'Viewport meta tag present', { content })
    );
  }

  return results;
}

// =============================================================================
// Indexing Rules
// =============================================================================

/**
 * Parse robots directives from a string (meta content or X-Robots-Tag header)
 * Returns normalized lowercase directives
 */
function parseRobotsDirectives(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0)
  );
}

/**
 * Check indexing and crawl control rules:
 * - PREFLIGHT_INDEX_NOINDEX_HEADER: Page marked noindex via HTTP headers
 * - PREFLIGHT_INDEX_NOFOLLOW: Page marked nofollow via meta or headers
 * - PREFLIGHT_INDEX_CONFLICT: Conflicting index directives (meta vs headers)
 */
function checkIndexingRules($: CheerioAPI, page: FetchedPage, rulesMap: ReleaseRulesMap): ResultItemToCreate[] {
  const results: ResultItemToCreate[] = [];

  // Get X-Robots-Tag header (can have multiple values)
  const xRobotsTag = page.headers.get('x-robots-tag') || '';
  const headerDirectives = parseRobotsDirectives(xRobotsTag);

  // Get meta robots content
  const metaRobots = $('meta[name="robots"]').attr('content') || '';
  const metaDirectives = parseRobotsDirectives(metaRobots);

  // Combined directives for some checks
  const allDirectives = new Set([...headerDirectives, ...metaDirectives]);

  // --- PREFLIGHT_INDEX_NOINDEX_HEADER ---
  // Check if noindex is set via HTTP header (this overrides everything)
  const hasHeaderNoindex = headerDirectives.has('noindex');

  if (hasHeaderNoindex) {
    results.push(
      createFail(
        'PREFLIGHT_INDEX_NOINDEX_HEADER',
        'Page blocked from indexing via X-Robots-Tag header',
        IssueSeverity.BLOCKER,
        rulesMap,
        { xRobotsTag, directive: 'noindex' }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_INDEX_NOINDEX_HEADER', 'No noindex in HTTP headers', {
        xRobotsTag: xRobotsTag || '(not set)',
      })
    );
  }

  // --- PREFLIGHT_INDEX_NOFOLLOW ---
  // Check if nofollow is set via either meta or headers
  const hasNofollow = allDirectives.has('nofollow');
  const nofollowSource = headerDirectives.has('nofollow')
    ? 'header'
    : metaDirectives.has('nofollow')
      ? 'meta'
      : null;

  if (hasNofollow) {
    results.push(
      createFail(
        'PREFLIGHT_INDEX_NOFOLLOW',
        `Page marked nofollow via ${nofollowSource === 'header' ? 'X-Robots-Tag header' : 'meta robots'}`,
        IssueSeverity.CRITICAL,
        rulesMap,
        {
          source: nofollowSource,
          xRobotsTag: xRobotsTag || '(not set)',
          metaRobots: metaRobots || '(not set)',
        }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_INDEX_NOFOLLOW', 'Page allows link following', {
        xRobotsTag: xRobotsTag || '(not set)',
        metaRobots: metaRobots || '(not set)',
      })
    );
  }

  // --- PREFLIGHT_INDEX_CONFLICT ---
  // Check for conflicting directives between meta and headers
  // Conflict examples:
  // - Header says "noindex" but meta says "index"
  // - Meta says "noindex" but header says "index"
  const hasConflict = detectIndexingConflict(headerDirectives, metaDirectives);

  if (hasConflict) {
    results.push(
      createFail(
        'PREFLIGHT_INDEX_CONFLICT',
        'Conflicting indexing directives between meta and headers',
        IssueSeverity.BLOCKER,
        rulesMap,
        {
          xRobotsTag: xRobotsTag || '(not set)',
          metaRobots: metaRobots || '(not set)',
          reason: 'Meta and header directives contradict each other',
        }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_INDEX_CONFLICT', 'No conflicting indexing directives', {
        xRobotsTag: xRobotsTag || '(not set)',
        metaRobots: metaRobots || '(not set)',
      })
    );
  }

  return results;
}

/**
 * Detect if there's a conflict between header and meta robots directives
 * A conflict occurs when one explicitly allows and the other explicitly blocks
 */
function detectIndexingConflict(
  headerDirectives: Set<string>,
  metaDirectives: Set<string>
): boolean {
  // Only check for conflicts if both sources have directives
  if (headerDirectives.size === 0 || metaDirectives.size === 0) {
    return false;
  }

  // Check index/noindex conflict
  const headerHasIndex = headerDirectives.has('index');
  const headerHasNoindex = headerDirectives.has('noindex');
  const metaHasIndex = metaDirectives.has('index');
  const metaHasNoindex = metaDirectives.has('noindex');

  // Conflict: one says index, other says noindex
  if ((headerHasIndex && metaHasNoindex) || (headerHasNoindex && metaHasIndex)) {
    return true;
  }

  // Check follow/nofollow conflict
  const headerHasFollow = headerDirectives.has('follow');
  const headerHasNofollow = headerDirectives.has('nofollow');
  const metaHasFollow = metaDirectives.has('follow');
  const metaHasNofollow = metaDirectives.has('nofollow');

  // Conflict: one says follow, other says nofollow
  if ((headerHasFollow && metaHasNofollow) || (headerHasNofollow && metaHasFollow)) {
    return true;
  }

  return false;
}

// =============================================================================
// Canonical Rules
// =============================================================================

/**
 * Check canonical tag rules:
 * - PREFLIGHT_CANONICAL_MISSING: No canonical tag
 * - PREFLIGHT_CANONICAL_MULTIPLE: More than one canonical tag
 * - PREFLIGHT_CANONICAL_MISMATCH: Canonical points to different URL
 * - PREFLIGHT_CANONICAL_PROTOCOL: Canonical uses wrong protocol
 * - PREFLIGHT_CANONICAL_HOSTNAME: Canonical points to different hostname
 * - PREFLIGHT_CANONICAL_PARAMS: Canonical contains tracking parameters
 */
function checkCanonicalRules($: CheerioAPI, page: FetchedPage, rulesMap: ReleaseRulesMap): ResultItemToCreate[] {
  const results: ResultItemToCreate[] = [];

  // Find all canonical link tags
  const canonicalTags = $('link[rel="canonical"]');
  const canonicalCount = canonicalTags.length;

  // --- PREFLIGHT_CANONICAL_MISSING ---
  if (canonicalCount === 0) {
    results.push(
      createFail(
        'PREFLIGHT_CANONICAL_MISSING',
        'Canonical tag missing',
        IssueSeverity.BLOCKER,
        rulesMap,
        { reason: 'Page may be treated as duplicate or ignored by search engines' }
      )
    );
    // Can't check other canonical rules if none exists
    return results;
  }

  results.push(
    createPass('PREFLIGHT_CANONICAL_MISSING', 'Canonical tag present', { count: canonicalCount })
  );

  // --- PREFLIGHT_CANONICAL_MULTIPLE ---
  if (canonicalCount > 1) {
    const hrefs = canonicalTags.map((_, el) => $(el).attr('href') || '').get();
    results.push(
      createFail(
        'PREFLIGHT_CANONICAL_MULTIPLE',
        `Multiple canonical tags found (${canonicalCount})`,
        IssueSeverity.BLOCKER,
        rulesMap,
        { count: canonicalCount, hrefs }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_CANONICAL_MULTIPLE', 'Single canonical tag', { count: 1 })
    );
  }

  // Get the first (or only) canonical URL for remaining checks
  const canonicalHref = canonicalTags.first().attr('href') || '';

  if (!canonicalHref) {
    // Empty canonical tag - treat as missing for remaining checks
    results.push(
      createFail(
        'PREFLIGHT_CANONICAL_MISMATCH',
        'Canonical tag has empty href',
        IssueSeverity.BLOCKER,
        rulesMap,
        { canonical: '', pageUrl: page.finalUrl }
      )
    );
    return results;
  }

  // Resolve relative canonical URLs against the page URL
  let canonicalUrl: string;
  try {
    canonicalUrl = new URL(canonicalHref, page.finalUrl).toString();
  } catch {
    results.push(
      createFail(
        'PREFLIGHT_CANONICAL_MISMATCH',
        'Canonical tag has invalid URL',
        IssueSeverity.BLOCKER,
        rulesMap,
        { canonical: canonicalHref, pageUrl: page.finalUrl }
      )
    );
    return results;
  }

  // Parse both URLs once for all checks
  const pageDetails = parseUrlDetails(page.finalUrl);
  const canonicalDetails = parseUrlDetails(canonicalUrl);

  if (!pageDetails || !canonicalDetails) {
    // Should not happen since we already validated canonicalUrl above
    results.push(
      createFail(
        'PREFLIGHT_CANONICAL_MISMATCH',
        'Failed to parse URLs for comparison',
        IssueSeverity.BLOCKER,
        rulesMap,
        { canonical: canonicalUrl, pageUrl: page.finalUrl }
      )
    );
    return results;
  }

  // --- PREFLIGHT_CANONICAL_PROTOCOL ---
  if (pageDetails.protocol !== canonicalDetails.protocol) {
    results.push(
      createFail(
        'PREFLIGHT_CANONICAL_PROTOCOL',
        `Canonical uses ${canonicalDetails.protocol} but page is ${pageDetails.protocol}`,
        IssueSeverity.BLOCKER,
        rulesMap,
        {
          canonicalProtocol: canonicalDetails.protocol,
          pageProtocol: pageDetails.protocol,
          canonical: canonicalUrl,
        }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_CANONICAL_PROTOCOL', 'Canonical protocol matches page', {
        protocol: canonicalDetails.protocol,
      })
    );
  }

  // --- PREFLIGHT_CANONICAL_HOSTNAME ---
  if (pageDetails.hostname !== canonicalDetails.hostname) {
    results.push(
      createFail(
        'PREFLIGHT_CANONICAL_HOSTNAME',
        `Canonical points to different hostname: ${canonicalDetails.hostname}`,
        IssueSeverity.BLOCKER,
        rulesMap,
        {
          canonicalHostname: canonicalDetails.hostname,
          pageHostname: pageDetails.hostname,
          canonical: canonicalUrl,
        }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_CANONICAL_HOSTNAME', 'Canonical hostname matches page', {
        hostname: canonicalDetails.hostname,
      })
    );
  }

  // --- PREFLIGHT_CANONICAL_MISMATCH ---
  // Compare normalized URLs (ignoring trailing slashes, case differences)
  if (pageDetails.normalized !== canonicalDetails.normalized) {
    results.push(
      createFail(
        'PREFLIGHT_CANONICAL_MISMATCH',
        'Canonical points to a different URL',
        IssueSeverity.BLOCKER,
        rulesMap,
        {
          canonical: canonicalUrl,
          pageUrl: page.finalUrl,
          normalizedCanonical: canonicalDetails.normalized,
          normalizedPage: pageDetails.normalized,
        }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_CANONICAL_MISMATCH', 'Canonical matches current page', {
        canonical: canonicalUrl,
      })
    );
  }

  // --- PREFLIGHT_CANONICAL_PARAMS ---
  if (canonicalDetails.trackingParams.length > 0) {
    results.push(
      createFail(
        'PREFLIGHT_CANONICAL_PARAMS',
        `Canonical contains tracking parameters: ${canonicalDetails.trackingParams.join(', ')}`,
        IssueSeverity.CRITICAL,
        rulesMap,
        {
          canonical: canonicalUrl,
          trackingParams: canonicalDetails.trackingParams,
        }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_CANONICAL_PARAMS', 'Canonical has no tracking parameters', {
        canonical: canonicalUrl,
      })
    );
  }

  return results;
}

// =============================================================================
// Security Rules
// =============================================================================

/**
 * Check security and protocol hygiene rules:
 * - PREFLIGHT_SECURITY_HTTP: Page served over HTTP
 * - PREFLIGHT_SECURITY_HTTP_URLS: Canonical or OG URLs use HTTP
 * - PREFLIGHT_SECURITY_MIXED_CONTENT: Mixed content assets detected
 * - PREFLIGHT_SECURITY_IFRAME: Insecure iframe embeds detected
 */
function checkSecurityRules($: CheerioAPI, page: FetchedPage, rulesMap: ReleaseRulesMap): ResultItemToCreate[] {
  const results: ResultItemToCreate[] = [];

  // --- PREFLIGHT_SECURITY_HTTP ---
  // Check if the page itself is served over HTTP
  const pageIsHttp = page.protocol === 'http:';

  if (pageIsHttp) {
    results.push(
      createFail(
        'PREFLIGHT_SECURITY_HTTP',
        'Page served over insecure HTTP',
        IssueSeverity.BLOCKER,
        rulesMap,
        { url: page.finalUrl, protocol: 'http:' }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_SECURITY_HTTP', 'Page served over HTTPS', {
        protocol: page.protocol,
      })
    );
  }

  // --- PREFLIGHT_SECURITY_HTTP_URLS ---
  // Check if canonical or Open Graph URLs use HTTP
  const httpUrls: { type: string; url: string }[] = [];

  // Check canonical
  const canonicalHref = $('link[rel="canonical"]').attr('href');
  if (canonicalHref) {
    try {
      const canonicalUrl = new URL(canonicalHref, page.finalUrl).toString();
      if (isHttpUrl(canonicalUrl)) {
        httpUrls.push({ type: 'canonical', url: canonicalUrl });
      }
    } catch {
      // Invalid URL - already caught by canonical rules
    }
  }

  // Check OG URLs
  const ogUrl = $('meta[property="og:url"]').attr('content');
  if (ogUrl && isHttpUrl(ogUrl)) {
    httpUrls.push({ type: 'og:url', url: ogUrl });
  }

  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage && isHttpUrl(ogImage)) {
    httpUrls.push({ type: 'og:image', url: ogImage });
  }

  if (httpUrls.length > 0) {
    results.push(
      createFail(
        'PREFLIGHT_SECURITY_HTTP_URLS',
        `Found ${httpUrls.length} HTTP URL(s) in meta tags`,
        IssueSeverity.BLOCKER,
        rulesMap,
        { httpUrls }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_SECURITY_HTTP_URLS', 'All meta tag URLs use HTTPS', {})
    );
  }

  // --- PREFLIGHT_SECURITY_MIXED_CONTENT ---
  // Check for HTTP resources on HTTPS pages (mixed content)
  let mixedContent: { tag: string; attr: string; url: string }[] = [];

  // Only check for mixed content if page is HTTPS
  if (!pageIsHttp) {
    // Use findHttpUrls for simple src attribute checks
    mixedContent = findHttpUrls($, [
      { selector: 'script[src]', attr: 'src' },
      { selector: 'img[src]', attr: 'src' },
      { selector: 'video[src]', attr: 'src' },
      { selector: 'audio[src]', attr: 'src' },
      { selector: 'source[src]', attr: 'src' },
    ]);

    // Check link href (stylesheets, etc.) - special case: exclude canonical
    $('link[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const rel = $(el).attr('rel') || '';
      if (href && isHttpUrl(href) && rel !== 'canonical') {
        mixedContent.push({ tag: 'link', attr: 'href', url: href });
      }
    });

    // Check object/embed - special case: dual attribute check
    $('object[data], embed[src]').each((_, el) => {
      const url = $(el).attr('data') || $(el).attr('src') || '';
      if (url && isHttpUrl(url)) {
        mixedContent.push({ tag: el.tagName.toLowerCase(), attr: 'data/src', url });
      }
    });
  }

  if (mixedContent.length > 0) {
    // Limit to first 10 for meta
    const limitedMixed = mixedContent.slice(0, 10);
    results.push(
      createFail(
        'PREFLIGHT_SECURITY_MIXED_CONTENT',
        `Found ${mixedContent.length} mixed content resource(s)`,
        IssueSeverity.CRITICAL,
        rulesMap,
        {
          count: mixedContent.length,
          examples: limitedMixed,
        }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_SECURITY_MIXED_CONTENT', 'No mixed content detected', {})
    );
  }

  // --- PREFLIGHT_SECURITY_IFRAME ---
  // Check for iframes with HTTP src
  const insecureIframes = findHttpUrls($, [{ selector: 'iframe[src]', attr: 'src' }]);

  if (insecureIframes.length > 0) {
    results.push(
      createFail(
        'PREFLIGHT_SECURITY_IFRAME',
        `Found ${insecureIframes.length} insecure iframe(s)`,
        IssueSeverity.CRITICAL,
        rulesMap,
        {
          count: insecureIframes.length,
          iframes: insecureIframes.slice(0, 5).map(i => i.url),
        }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_SECURITY_IFRAME', 'No insecure iframes detected', {})
    );
  }

  return results;
}

// =============================================================================
// Link Rules
// =============================================================================

/**
 * Build ancestor path for an element (for context in error reporting)
 * Returns a string like "body > header > nav > ul > li"
 */
function getAncestorPath($: CheerioAPI, $el: Cheerio<Element>, maxDepth = 5): string {
  const ancestors: string[] = [];
  let current = $el.parent();

  while (current.length > 0 && ancestors.length < maxDepth) {
    const tagName = current.prop('tagName')?.toLowerCase();
    if (!tagName || tagName === 'html' || tagName === 'body') break;
    ancestors.unshift(tagName);
    current = current.parent();
  }

  return ancestors.join(' > ') || 'root';
}

/**
 * Detect if an empty link is a navigation dropdown trigger.
 * These are intentional patterns where href="#" is used to trigger a submenu.
 *
 * Detection criteria:
 * 1. Must be inside a navigation context (nav, header nav, [role="navigation"])
 * 2. AND one of:
 *    - Has aria-haspopup="true" or aria-expanded attribute (ARIA dropdown)
 *    - Parent <li> contains a nested <ul> or <ol> (classic dropdown)
 *    - Has sibling <ul> or [role="menu"] element (adjacent submenu)
 */
function isNavDropdownTrigger($: CheerioAPI, $el: Cheerio<Element>): {
  isDropdown: boolean;
  detectionMethod?: string;
} {
  // Must be inside navigation context
  const inNav = $el.closest('nav, header nav, [role="navigation"]').length > 0;
  if (!inNav) {
    return { isDropdown: false };
  }

  // Check for ARIA dropdown attributes (most reliable)
  const hasAriaHaspopup = $el.attr('aria-haspopup') === 'true';
  const hasAriaExpanded = $el.attr('aria-expanded') !== undefined;
  if (hasAriaHaspopup || hasAriaExpanded) {
    return { isDropdown: true, detectionMethod: 'aria-attributes' };
  }

  // Check if parent <li> contains nested <ul> or <ol> (classic dropdown pattern)
  const $parentLi = $el.parent('li');
  if ($parentLi.length > 0 && $parentLi.children('ul, ol').length > 0) {
    return { isDropdown: true, detectionMethod: 'nested-list' };
  }

  // Check for sibling submenu element
  if ($el.siblings('ul, [role="menu"]').length > 0) {
    return { isDropdown: true, detectionMethod: 'sibling-menu' };
  }

  return { isDropdown: false };
}

/**
 * Check link rules:
 * - PREFLIGHT_EMPTY_LINK: Links with href="#" only (placeholder links)
 *
 * Excludes navigation dropdown triggers (intentional patterns) and reports
 * the count of excluded items in the PASS meta.
 */
function checkLinkRules($: CheerioAPI, rulesMap: ReleaseRulesMap): ResultItemToCreate[] {
  const results: ResultItemToCreate[] = [];

  // Track empty links and excluded nav dropdowns separately
  const emptyLinks: {
    text: string;
    ancestorPath: string;
    inNav: boolean;
  }[] = [];

  const excludedNavDropdowns: {
    text: string;
    detectionMethod: string;
  }[] = [];

  $('a[href="#"]').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim().substring(0, 50) || '(no text)';

    // Check if this is a nav dropdown trigger
    const dropdownCheck = isNavDropdownTrigger($, $el);

    if (dropdownCheck.isDropdown) {
      // Exclude from error reporting, track for meta
      excludedNavDropdowns.push({
        text,
        detectionMethod: dropdownCheck.detectionMethod!,
      });
    } else {
      // This is a potentially problematic empty link
      const ancestorPath = getAncestorPath($, $el);
      const inNav = $el.closest('nav, [role="navigation"]').length > 0;

      emptyLinks.push({ text, ancestorPath, inNav });
    }
  });

  if (emptyLinks.length > 0) {
    results.push(
      createFail(
        'PREFLIGHT_EMPTY_LINK',
        `Found ${emptyLinks.length} placeholder link(s) with href="#"`,
        IssueSeverity.BLOCKER,
        rulesMap,
        {
          count: emptyLinks.length,
          examples: emptyLinks.slice(0, 10), // Limit to 10
          excludedNavDropdowns: excludedNavDropdowns.length,
        }
      )
    );
  } else {
    results.push(
      createPass('PREFLIGHT_EMPTY_LINK', 'No placeholder links detected', {
        excludedNavDropdowns: excludedNavDropdowns.length,
      })
    );
  }

  return results;
}

// =============================================================================
// Alt Tag Rules
// =============================================================================

/**
 * Check alt tag rules:
 * - EMPTY_ALT_TAG: Images with empty alt attribute (alt="", alt, or whitespace-only)
 *
 * Note: Lighthouse checks for missing alt tags but not empty ones.
 * Empty alt tags may indicate incomplete content or accessibility issues.
 */
function checkAltTagRules($: CheerioAPI, rulesMap: ReleaseRulesMap): ResultItemToCreate[] {
  const results: ResultItemToCreate[] = [];

  const emptyAltImages: { src: string }[] = [];

  $('img').each((_, el) => {
    const $el = $(el);
    const alt = $el.attr('alt');

    // Check if alt attribute exists and is empty/whitespace
    // attr() returns undefined if attribute doesn't exist
    // alt="" or alt (no value) returns ''
    if (alt !== undefined && alt.trim() === '') {
      const src = $el.attr('src') || '(no src)';
      emptyAltImages.push({ src });
    }
  });

  if (emptyAltImages.length > 0) {
    results.push(
      createFail(
        'EMPTY_ALT_TAG',
        `Found ${emptyAltImages.length} image(s) with empty alt attribute`,
        IssueSeverity.HIGH,
        rulesMap,
        {
          count: emptyAltImages.length,
          images: emptyAltImages.slice(0, 10), // Limit to first 10
        }
      )
    );
  } else {
    results.push(
      createPass('EMPTY_ALT_TAG', 'No images with empty alt attributes', {})
    );
  }

  return results;
}

// =============================================================================
// Favicon Rules
// =============================================================================

/**
 * Check favicon rules:
 * - PREFLIGHT_FAVICON_MISSING: No valid favicon found
 *
 * Detection order:
 * 1. Check for <link rel="icon"> or <link rel="shortcut icon"> in HTML
 * 2. If tag found with data URI → PASS
 * 3. If tag found with URL → fetch and verify 200
 * 4. If no tag → try /favicon.ico at site root
 */
async function checkFaviconRules(
  $: CheerioAPI,
  page: FetchedPage,
  rulesMap: ReleaseRulesMap
): Promise<ResultItemToCreate[]> {
  const results: ResultItemToCreate[] = [];

  // Find favicon link tags (rel="icon" or rel="shortcut icon")
  const faviconTags = $('link[rel="icon"], link[rel="shortcut icon"]');

  if (faviconTags.length > 0) {
    // Found favicon tag(s) - check the first one
    const href = faviconTags.first().attr('href') || '';

    if (!href) {
      // Empty href - treat as missing
      results.push(
        createFail(
          'PREFLIGHT_FAVICON_MISSING',
          'Favicon link tag has empty href',
          IssueSeverity.CRITICAL,
          rulesMap,
          { reason: 'tag_empty_href', checkedUrls: [] }
        )
      );
      return results;
    }

    // Check for data URI (always valid - no fetch needed)
    if (href.startsWith('data:')) {
      results.push(
        createPass('PREFLIGHT_FAVICON_MISSING', 'Favicon found (data URI)', {
          source: 'data_uri',
        })
      );
      return results;
    }

    // Resolve relative URL against page URL
    let faviconUrl: string;
    try {
      faviconUrl = new URL(href, page.finalUrl).toString();
    } catch {
      results.push(
        createFail(
          'PREFLIGHT_FAVICON_MISSING',
          'Favicon link tag has invalid URL',
          IssueSeverity.CRITICAL,
          rulesMap,
          { reason: 'tag_invalid_url', href }
        )
      );
      return results;
    }

    // Fetch the favicon to verify it exists and has content
    const tagResult = await checkFaviconUrl(faviconUrl);
    if (tagResult.ok) {
      results.push(
        createPass('PREFLIGHT_FAVICON_MISSING', 'Favicon found', {
          source: 'link_tag',
          url: faviconUrl,
          contentLength: tagResult.contentLength,
        })
      );
    } else {
      const errorReason = tagResult.contentLength === 0 ? 'tag_empty_file' : 'tag_broken';
      results.push(
        createFail(
          'PREFLIGHT_FAVICON_MISSING',
          tagResult.contentLength === 0 ? 'Favicon file is empty' : 'Favicon URL returns error',
          IssueSeverity.CRITICAL,
          rulesMap,
          {
            reason: errorReason,
            url: faviconUrl,
            status: tagResult.status,
            contentLength: tagResult.contentLength,
            error: tagResult.error,
          }
        )
      );
    }
    return results;
  }

  // No favicon tag found - try /favicon.ico fallback
  let rootFaviconUrl: string;
  try {
    const pageUrl = new URL(page.finalUrl);
    rootFaviconUrl = `${pageUrl.origin}/favicon.ico`;
  } catch {
    results.push(
      createFail(
        'PREFLIGHT_FAVICON_MISSING',
        'No favicon found',
        IssueSeverity.CRITICAL,
        rulesMap,
        { reason: 'no_tag_invalid_origin' }
      )
    );
    return results;
  }

  const rootResult = await checkFaviconUrl(rootFaviconUrl);
  if (rootResult.ok) {
    results.push(
      createPass('PREFLIGHT_FAVICON_MISSING', 'Favicon found at /favicon.ico', {
        source: 'root_fallback',
        url: rootFaviconUrl,
        contentLength: rootResult.contentLength,
      })
    );
  } else {
    const errorReason = rootResult.contentLength === 0 ? 'no_tag_fallback_empty' : 'no_tag_no_fallback';
    const message = rootResult.contentLength === 0
      ? 'No favicon found (/favicon.ico is empty)'
      : 'No favicon found';
    results.push(
      createFail(
        'PREFLIGHT_FAVICON_MISSING',
        message,
        IssueSeverity.CRITICAL,
        rulesMap,
        {
          reason: errorReason,
          checkedUrls: [rootFaviconUrl],
          status: rootResult.status,
          contentLength: rootResult.contentLength,
          error: rootResult.error,
        }
      )
    );
  }

  return results;
}

/**
 * Check if a favicon URL returns 200 with actual content
 */
async function checkFaviconUrl(url: string): Promise<{
  ok: boolean;
  status?: number;
  contentLength?: number;
  error?: string;
}> {
  try {
    const response = await fetchWithTimeout(url, {
      timeoutMs: 10000,
      headers: {
        'User-Agent': 'ReleasePass-Bot/1.0 (https://releasepass.app)',
      },
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    // Check Content-Length header first (avoids downloading body)
    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader !== null) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (contentLength === 0) {
        return { ok: false, status: response.status, contentLength: 0, error: 'Empty file (Content-Length: 0)' };
      }
      return { ok: true, status: response.status, contentLength };
    }

    // No Content-Length header - read body to check size
    const body = await response.arrayBuffer();
    if (body.byteLength === 0) {
      return { ok: false, status: response.status, contentLength: 0, error: 'Empty file (0 bytes)' };
    }

    return { ok: true, status: response.status, contentLength: body.byteLength };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}

// =============================================================================
// Meta & Title Rules
// =============================================================================

/** Length bounds configuration for title */
const TITLE_LENGTH_CONFIG: LengthBoundsConfig = {
  tooLongCode: 'PREFLIGHT_TITLE_TOO_LONG',
  tooShortCode: 'PREFLIGHT_TITLE_TOO_SHORT',
  min: 30,
  max: 55,
  minSeverity: IssueSeverity.HIGH,
  maxSeverity: IssueSeverity.HIGH,
  fieldName: 'Title',
};

/** Length bounds configuration for meta description */
const META_DESC_LENGTH_CONFIG: LengthBoundsConfig = {
  tooLongCode: 'PREFLIGHT_META_DESC_TOO_LONG',
  tooShortCode: 'PREFLIGHT_META_DESC_TOO_SHORT',
  min: 70,
  max: 155,
  minSeverity: IssueSeverity.MEDIUM,
  maxSeverity: IssueSeverity.MEDIUM,
  fieldName: 'Meta description',
};

/**
 * Check title tag length rules:
 * - PREFLIGHT_TITLE_TOO_LONG: Title exceeds 55 characters
 * - PREFLIGHT_TITLE_TOO_SHORT: Title below 30 characters
 *
 * Skips if title is missing or whitespace-only (Lighthouse handles missing titles)
 */
function checkMetaTitleRules($: CheerioAPI, rulesMap: ReleaseRulesMap): ResultItemToCreate[] {
  const titleText = $('title').first().text().trim();

  // Skip if missing or whitespace-only - Lighthouse handles this
  if (!titleText) {
    return [];
  }

  return checkLengthBounds(titleText, TITLE_LENGTH_CONFIG, rulesMap);
}

/**
 * Check meta description length rules:
 * - PREFLIGHT_META_DESC_TOO_LONG: Meta description exceeds 155 characters
 * - PREFLIGHT_META_DESC_TOO_SHORT: Meta description below 70 characters
 *
 * Skips if description is missing or whitespace-only (Lighthouse handles missing descriptions)
 */
function checkMetaDescriptionRules($: CheerioAPI, rulesMap: ReleaseRulesMap): ResultItemToCreate[] {
  const descContent = $('meta[name="description"]').first().attr('content')?.trim() || '';

  // Skip if missing or whitespace-only - Lighthouse handles this
  if (!descContent) {
    return [];
  }

  return checkLengthBounds(descContent, META_DESC_LENGTH_CONFIG, rulesMap);
}

// =============================================================================
// External Link Target Rules (Optional)
// =============================================================================

/**
 * Extract root domain from hostname
 * Handles multi-part TLDs like .co.uk, .com.au
 *
 * Examples:
 * - "www.example.com" → "example.com"
 * - "sub.domain.example.co.uk" → "example.co.uk"
 * - "example.com" → "example.com"
 */
function getRootDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.');

  if (parts.length <= 2) {
    return hostname.toLowerCase();
  }

  // Check for multi-part TLDs (e.g., .co.uk, .com.au, .org.uk)
  const secondLast = parts[parts.length - 2];
  const multiPartTlds = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];

  if (multiPartTlds.includes(secondLast) && parts.length >= 3) {
    // Return last 3 parts (e.g., example.co.uk)
    return parts.slice(-3).join('.');
  }

  // Return last 2 parts (e.g., example.com)
  return parts.slice(-2).join('.');
}

/**
 * Check if a link should be excluded from external link checks
 */
function isExcludedLink(href: string | undefined): boolean {
  if (!href || href.trim() === '') return true;

  const lowerHref = href.toLowerCase().trim();

  // Exclude non-navigation protocols
  if (lowerHref.startsWith('javascript:')) return true;
  if (lowerHref.startsWith('mailto:')) return true;
  if (lowerHref.startsWith('tel:')) return true;
  if (lowerHref.startsWith('data:')) return true;
  if (lowerHref === '#') return true;

  return false;
}

/**
 * Check if target attribute opens in new window
 * Valid: _blank, _new, or any custom target name (not _self/_parent/_top)
 */
function opensInNewWindow(target: string | undefined): boolean {
  if (!target) return false;

  const lowerTarget = target.toLowerCase().trim();

  // These targets do NOT open in new window
  const sameWindowTargets = ['_self', '_parent', '_top'];

  return !sameWindowTargets.includes(lowerTarget);
}

interface ExternalLinkIssue {
  href: string;
  text: string;
  target: string | null;
}

/**
 * Check external link target rules:
 * - PREFLIGHT_EXTERNAL_LINK_TARGET: External links should open in new window
 *
 * External = different root domain than the page
 * Subdomains of the same root domain are NOT considered external
 *
 * This is an OPTIONAL rule (off by default per project)
 */
function checkExternalLinkTargetRules(
  $: CheerioAPI,
  page: FetchedPage,
  rulesMap: ReleaseRulesMap
): ResultItemToCreate[] {
  const results: ResultItemToCreate[] = [];

  // Get the page's root domain
  let pageRootDomain: string;
  try {
    const pageUrl = new URL(page.finalUrl);
    pageRootDomain = getRootDomain(pageUrl.hostname);
  } catch {
    // If we can't parse the page URL, skip this check
    return results;
  }

  const issues: ExternalLinkIssue[] = [];
  let externalLinkCount = 0;

  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    const target = $el.attr('target');
    const hasDownload = $el.attr('download') !== undefined;

    // Skip excluded links
    if (isExcludedLink(href)) return;
    if (hasDownload) return;

    // Resolve the href to absolute URL
    let linkUrl: URL;
    try {
      linkUrl = new URL(href!, page.finalUrl);
    } catch {
      // Invalid URL, skip
      return;
    }

    // Skip non-http(s) protocols
    if (!linkUrl.protocol.startsWith('http')) return;

    // Check if external (different root domain)
    const linkRootDomain = getRootDomain(linkUrl.hostname);
    if (linkRootDomain === pageRootDomain) {
      // Internal link (same root domain), skip
      return;
    }

    // This is an external link
    externalLinkCount++;

    // Check if it opens in new window
    if (!opensInNewWindow(target)) {
      const linkText = $el.text().trim().substring(0, 100) || '(no text)';
      issues.push({
        href: linkUrl.toString(),
        text: linkText,
        target: target || null,
      });
    }
  });

  // Generate result
  if (issues.length > 0) {
    results.push(
      createFail(
        'PREFLIGHT_EXTERNAL_LINK_TARGET',
        `Found ${issues.length} external link(s) not opening in new window`,
        IssueSeverity.HIGH,
        rulesMap,
        {
          count: issues.length,
          externalLinkCount,
          links: issues,
        }
      )
    );
  } else {
    results.push(
      createPass(
        'PREFLIGHT_EXTERNAL_LINK_TARGET',
        externalLinkCount > 0
          ? `All ${externalLinkCount} external link(s) open in new window`
          : 'No external links found',
        { externalLinkCount }
      )
    );
  }

  return results;
}
