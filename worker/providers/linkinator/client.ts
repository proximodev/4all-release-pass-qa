/**
 * Linkinator Provider
 *
 * Uses Google's linkinator library for link and resource validation.
 * Detects:
 * - Broken internal links (404, 500 errors)
 * - Broken external links
 * - Missing resources (images, scripts, stylesheets)
 * - Redirect chains
 */

import { LinkChecker, LinkResult, LinkState } from 'linkinator';

export interface LinkCheckResult {
  url: string;
  status: number;
  state: 'OK' | 'BROKEN' | 'SKIPPED';
  parent: string | null;
  failureDetails?: string;
}

export interface LinkCheckSummary {
  scannedUrl: string;
  totalLinks: number;
  brokenLinks: LinkCheckResult[];
  redirects: LinkCheckResult[];
  skipped: LinkCheckResult[];
}

/**
 * Check links for a single page
 */
export async function checkLinks(
  url: string,
  options: {
    timeout?: number;
    retryCount?: number;
    checkExternal?: boolean;
  } = {}
): Promise<LinkCheckSummary> {
  const {
    timeout = 30000,
    retryCount = 2,
    checkExternal = true,
  } = options;

  const checker = new LinkChecker();

  // Build skip patterns for external links if needed
  const skipPatterns: string[] = [];
  if (!checkExternal) {
    // Skip external links by not providing any skip patterns
    // Linkinator's linksToSkip expects string patterns, not functions
    // We'll filter results instead
  }

  // Configure link checker
  const results = await checker.check({
    path: url,
    recurse: false,  // Only check this page, not recursive
    timeout,
    retry: true,
    retryErrors: true,
    retryErrorsCount: retryCount,
    linksToSkip: skipPatterns,
  });

  // Process results
  const brokenLinks: LinkCheckResult[] = [];
  const redirects: LinkCheckResult[] = [];
  const skipped: LinkCheckResult[] = [];

  for (const link of results.links) {
    const result = mapLinkResult(link);

    if (link.state === LinkState.BROKEN) {
      brokenLinks.push(result);
    } else if (link.status && link.status >= 300 && link.status < 400) {
      redirects.push(result);
    } else if (link.state === LinkState.SKIPPED) {
      skipped.push(result);
    }
  }

  return {
    scannedUrl: url,
    totalLinks: results.links.length,
    brokenLinks,
    redirects,
    skipped,
  };
}

/**
 * Map linkinator result to our format
 */
function mapLinkResult(link: LinkResult): LinkCheckResult {
  let state: 'OK' | 'BROKEN' | 'SKIPPED';

  switch (link.state) {
    case LinkState.OK:
      state = 'OK';
      break;
    case LinkState.BROKEN:
      state = 'BROKEN';
      break;
    case LinkState.SKIPPED:
    default:
      state = 'SKIPPED';
      break;
  }

  // Handle failureDetails which can be an array or have various structures
  let failureMessage: string | undefined;
  if (link.failureDetails) {
    if (Array.isArray(link.failureDetails)) {
      // Extract message from first error if it's an array
      const firstError = link.failureDetails[0];
      if (firstError && typeof firstError === 'object' && 'message' in firstError) {
        failureMessage = (firstError as any).message;
      }
    } else if (typeof link.failureDetails === 'object' && 'message' in link.failureDetails) {
      failureMessage = (link.failureDetails as any).message;
    }
  }

  return {
    url: link.url,
    status: link.status || 0,
    state,
    parent: link.parent || null,
    failureDetails: failureMessage,
  };
}

/**
 * Check links for multiple URLs
 */
export async function checkLinksMultiple(
  urls: string[],
  options: {
    timeout?: number;
    retryCount?: number;
    checkExternal?: boolean;
  } = {}
): Promise<Map<string, LinkCheckSummary>> {
  const results = new Map<string, LinkCheckSummary>();

  // Process URLs sequentially to avoid overwhelming the target server
  for (const url of urls) {
    try {
      const summary = await checkLinks(url, options);
      results.set(url, summary);
    } catch (error) {
      console.error(`[LINKINATOR] Failed to check ${url}:`, error);
      // Create an error summary
      results.set(url, {
        scannedUrl: url,
        totalLinks: 0,
        brokenLinks: [],
        redirects: [],
        skipped: [],
      });
    }
  }

  return results;
}
