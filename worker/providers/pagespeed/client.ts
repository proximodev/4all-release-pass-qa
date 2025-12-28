/**
 * PageSpeed Insights API Client
 *
 * Uses Google PageSpeed Insights API v5 for:
 * - Performance: Core Web Vitals (LCP, CLS, INP) and performance score
 * - SEO: Lighthouse SEO audits (for Page Preflight)
 *
 * Rate limits (free tier):
 * - 25,000 requests per day
 * - 400 requests per minute
 */

import { retryWithBackoff } from '../../lib/retry';

const API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export interface PageSpeedResult {
  // Performance metrics
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;

  // Core Web Vitals
  lcp: number | null;  // Largest Contentful Paint (seconds)
  cls: number | null;  // Cumulative Layout Shift
  inp: number | null;  // Interaction to Next Paint (ms) - may be null if not available
  fcp: number | null;  // First Contentful Paint (seconds)
  tbt: number | null;  // Total Blocking Time (ms)
  tti: number | null;  // Time to Interactive (seconds)

  // Field data (CrUX)
  hasFieldData: boolean;
  fieldLcp: number | null;
  fieldCls: number | null;
  fieldInp: number | null;

  // SEO audits (for Page Preflight)
  seoAudits: SeoAudit[];

  // Raw response for debugging
  rawResponse?: any;
}

export interface SeoAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;  // 0-1, null if not applicable
  displayValue?: string;
  details?: any;
}

export type Strategy = 'mobile' | 'desktop';

/**
 * Run PageSpeed analysis for a URL
 */
export async function runPageSpeed(
  url: string,
  strategy: Strategy = 'mobile',
  categories: string[] = ['performance', 'accessibility', 'seo']
): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGE_SPEED_API_KEY;

  if (!apiKey) {
    throw new Error('PAGE_SPEED_API_KEY environment variable is not set');
  }

  const params = new URLSearchParams({
    url,
    key: apiKey,
    strategy,
  });

  // Add categories
  categories.forEach(cat => params.append('category', cat.toUpperCase()));

  const apiUrl = `${API_BASE}?${params.toString()}`;

  const response = await retryWithBackoff(
    async () => {
      const res = await fetch(apiUrl, {
        headers: {
          // Required for API keys with HTTP referrer restrictions
          'Referer': 'https://releasepass.app/',
        },
      });

      if (!res.ok) {
        const errorBody = await res.text();

        // Don't retry on 4xx errors (except 429 rate limit)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          const error = new Error(`PageSpeed API error: ${res.status} - ${errorBody}`) as any;
          error.status = res.status;
          error.noRetry = true;
          throw error;
        }

        throw new Error(`PageSpeed API error: ${res.status} - ${errorBody}`);
      }

      return res.json();
    },
    { maxRetries: 5, initialDelayMs: 2000 }  // PageSpeed can be flaky
  );

  return parsePageSpeedResponse(response);
}

/**
 * Parse PageSpeed API response into our standardized format
 */
function parsePageSpeedResponse(response: any): PageSpeedResult {
  const lighthouse = response.lighthouseResult;
  const loadingExperience = response.loadingExperience;

  if (!lighthouse) {
    throw new Error('Invalid PageSpeed response: missing lighthouseResult');
  }

  const categories = lighthouse.categories || {};
  const audits = lighthouse.audits || {};

  // Extract category scores (0-100)
  const performanceScore = categories.performance?.score != null
    ? Math.round(categories.performance.score * 100)
    : null;
  const accessibilityScore = categories.accessibility?.score != null
    ? Math.round(categories.accessibility.score * 100)
    : null;
  const seoScore = categories.seo?.score != null
    ? Math.round(categories.seo.score * 100)
    : null;

  // Extract Core Web Vitals from lab data
  const lcp = audits['largest-contentful-paint']?.numericValue
    ? audits['largest-contentful-paint'].numericValue / 1000  // Convert ms to seconds
    : null;
  const cls = audits['cumulative-layout-shift']?.numericValue ?? null;
  const fcp = audits['first-contentful-paint']?.numericValue
    ? audits['first-contentful-paint'].numericValue / 1000
    : null;
  const tbt = audits['total-blocking-time']?.numericValue ?? null;
  const tti = audits['interactive']?.numericValue
    ? audits['interactive'].numericValue / 1000
    : null;

  // INP is not always available in lab data
  const inp = null; // INP is field data only

  // Extract field data (CrUX) if available
  const hasFieldData = !!loadingExperience?.metrics;
  const fieldMetrics = loadingExperience?.metrics || {};

  const fieldLcp = fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile
    ? fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000
    : null;
  const fieldCls = fieldMetrics.CUMULATIVE_LAYOUT_SHIFT?.percentile ?? null;
  const fieldInp = fieldMetrics.INTERACTION_TO_NEXT_PAINT?.percentile ?? null;

  // Extract SEO audits
  const seoAudits = extractSeoAudits(audits);

  return {
    performanceScore,
    accessibilityScore,
    seoScore,
    lcp,
    cls,
    inp,
    fcp,
    tbt,
    tti,
    hasFieldData,
    fieldLcp,
    fieldCls,
    fieldInp,
    seoAudits,
  };
}

/**
 * Extract SEO-related audits from Lighthouse results
 */
function extractSeoAudits(audits: any): SeoAudit[] {
  // Key SEO audits to extract
  const seoAuditIds = [
    'document-title',
    'meta-description',
    'http-status-code',
    'link-text',
    'crawlable-anchors',
    'is-crawlable',
    'robots-txt',
    'image-alt',
    'hreflang',
    'canonical',
    'font-size',
    'tap-targets',
    'structured-data',
  ];

  const results: SeoAudit[] = [];

  for (const id of seoAuditIds) {
    const audit = audits[id];
    if (audit) {
      results.push({
        id,
        title: audit.title || id,
        description: audit.description || '',
        score: audit.score,
        displayValue: audit.displayValue,
        details: audit.details,
      });
    }
  }

  return results;
}

/**
 * Run PageSpeed for both mobile and desktop
 */
export async function runPageSpeedBothViewports(
  url: string,
  categories: string[] = ['performance', 'accessibility', 'seo']
): Promise<{ mobile: PageSpeedResult; desktop: PageSpeedResult }> {
  const [mobile, desktop] = await Promise.all([
    runPageSpeed(url, 'mobile', categories),
    runPageSpeed(url, 'desktop', categories),
  ]);

  return { mobile, desktop };
}
