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
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { IssueProvider, IssueSeverity, ResultStatus } from '@prisma/client';
import { fetchWithTimeout } from '../../lib/fetch';

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
 * Run all custom rules against a URL
 */
export async function runCustomRules(url: string): Promise<ResultItemToCreate[]> {
  const results: ResultItemToCreate[] = [];

  const page = await fetchPage(url);
  const $ = cheerio.load(page.html);

  // Batch 1: H1 + Viewport rules
  results.push(...checkH1Rules($));
  results.push(...checkViewportRules($));

  return results;
}

/**
 * Fetch page HTML and headers
 */
async function fetchPage(url: string): Promise<FetchedPage> {
  const response = await fetchWithTimeout(url, {
    timeoutMs: 30000,
    headers: {
      'User-Agent': 'ReleasePass-Bot/1.0 (https://releasepass.app)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

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
 */
function createFail(
  code: string,
  name: string,
  severity: IssueSeverity,
  meta?: Record<string, unknown>
): ResultItemToCreate {
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
// H1 Rules
// =============================================================================

/**
 * Check H1 heading structure rules:
 * - PREFLIGHT_H1_MISSING: No H1 present
 * - PREFLIGHT_H1_MULTIPLE: More than one H1
 * - PREFLIGHT_H1_EMPTY: H1 exists but is empty/whitespace
 */
function checkH1Rules($: CheerioAPI): ResultItemToCreate[] {
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
function checkViewportRules($: CheerioAPI): ResultItemToCreate[] {
  const results: ResultItemToCreate[] = [];

  // Look for <meta name="viewport" ...>
  const viewportMeta = $('meta[name="viewport"]');

  if (viewportMeta.length === 0) {
    results.push(
      createFail(
        'PREFLIGHT_VIEWPORT_MISSING',
        'Viewport meta tag missing',
        IssueSeverity.CRITICAL,
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
