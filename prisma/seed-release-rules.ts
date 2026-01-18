/**
 * Seed script for ReleaseRuleCategory and ReleaseRule tables
 * Run with: npx tsx prisma/seed-release-rules.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define categories with sort order
const categories = [
  { name: 'Heading Structure', sortOrder: 10 },
  { name: 'Indexing & Crawl Control', sortOrder: 30 },
  { name: 'Canonical', sortOrder: 40 },
  { name: 'Security & Protocol', sortOrder: 50 },
  { name: 'Links', sortOrder: 60 },
  { name: 'Site Resources', sortOrder: 65 },
  { name: 'SEO Essentials', sortOrder: 70 },
  { name: 'Crawlability', sortOrder: 80 },
  { name: 'Internationalization', sortOrder: 100 },
  { name: 'Mobile Usability', sortOrder: 110 },
  { name: 'System', sortOrder: 900 },
];

const releaseRules = [
  // Batch 1: H1 + Viewport (4 rules)
  {
    code: 'PREFLIGHT_H1_MISSING',
    provider: 'ReleasePass',
    category: 'Heading Structure',
    name: 'Missing H1 Heading',
    description: 'No H1 heading element found on the page.',
    severity: 'BLOCKER',
    impact: 'Page lacks a primary content heading, harming SEO and accessibility.',
    fix: 'Add a single, descriptive H1 heading that summarizes the page content.',
    sortOrder: 1,
  },
  {
    code: 'PREFLIGHT_H1_MULTIPLE',
    provider: 'ReleasePass',
    category: 'Heading Structure',
    name: 'Multiple H1 Headings',
    description: 'More than one H1 heading element found on the page.',
    severity: 'HIGH',
    impact: 'Multiple H1s confuse content hierarchy for search engines and screen readers.',
    fix: 'Keep only one H1 per page. Convert others to H2 or lower.',
    sortOrder: 2,
  },
  {
    code: 'PREFLIGHT_H1_EMPTY',
    provider: 'ReleasePass',
    category: 'Heading Structure',
    name: 'Empty H1 Heading',
    description: 'H1 element exists but contains no text or only whitespace.',
    severity: 'BLOCKER',
    impact: 'Empty H1 provides no value for SEO or accessibility.',
    fix: 'Add meaningful text content to the H1 element.',
    sortOrder: 3,
  },
  {
    code: 'PREFLIGHT_VIEWPORT_MISSING',
    provider: 'ReleasePass',
    category: 'Mobile Usability',
    name: 'Missing Viewport Meta Tag',
    description: 'No viewport meta tag found in the page head.',
    severity: 'CRITICAL',
    impact: 'Page will not render correctly on mobile devices.',
    fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the head.',
    sortOrder: 10,
  },

  // Batch 2: Indexing (3 rules)
  {
    code: 'PREFLIGHT_INDEX_NOINDEX_HEADER',
    provider: 'ReleasePass',
    category: 'Indexing & Crawl Control',
    name: 'Noindex HTTP Header',
    description: 'Page is marked noindex via X-Robots-Tag HTTP header.',
    severity: 'BLOCKER',
    impact: 'Page will not be indexed by search engines.',
    fix: 'Remove the noindex directive from the X-Robots-Tag header if indexing is desired.',
    sortOrder: 20,
  },
  {
    code: 'PREFLIGHT_INDEX_NOFOLLOW',
    provider: 'ReleasePass',
    category: 'Indexing & Crawl Control',
    name: 'Nofollow Directive',
    description: 'Page is marked nofollow via meta robots tag or HTTP header.',
    severity: 'CRITICAL',
    impact: 'Search engines will not follow links on this page, blocking link equity flow.',
    fix: 'Remove the nofollow directive if you want links to be followed.',
    sortOrder: 21,
  },
  {
    code: 'PREFLIGHT_INDEX_CONFLICT',
    provider: 'ReleasePass',
    category: 'Indexing & Crawl Control',
    name: 'Conflicting Index Directives',
    description: 'Meta robots and X-Robots-Tag header have conflicting directives.',
    severity: 'BLOCKER',
    impact: 'Conflicting directives create undefined indexing behavior.',
    fix: 'Ensure meta robots and HTTP headers specify consistent directives.',
    sortOrder: 22,
  },

  // Batch 3: Canonical (6 rules)
  {
    code: 'PREFLIGHT_CANONICAL_MISSING',
    provider: 'ReleasePass',
    category: 'Canonical',
    name: 'Missing Canonical Tag',
    description: 'No canonical link element found in the page head.',
    severity: 'CRITICAL',
    impact: 'Page may be treated as duplicate content or ignored by search engines.',
    fix: 'Add <link rel="canonical" href="..."> pointing to the preferred URL.',
    sortOrder: 30,
  },
  {
    code: 'PREFLIGHT_CANONICAL_MULTIPLE',
    provider: 'ReleasePass',
    category: 'Canonical',
    name: 'Multiple Canonical Tags',
    description: 'More than one canonical link element found.',
    severity: 'BLOCKER',
    impact: 'Search engines may ignore all canonical tags when multiple exist.',
    fix: 'Remove duplicate canonical tags, keeping only one.',
    sortOrder: 31,
  },
  {
    code: 'PREFLIGHT_CANONICAL_MISMATCH',
    provider: 'ReleasePass',
    category: 'Canonical',
    name: 'Canonical URL Mismatch',
    description: 'Canonical tag points to a different URL than the current page.',
    severity: 'CRITICAL',
    impact: 'Page effectively tells search engines to index a different URL instead.',
    fix: 'Update canonical to match the current page URL, or redirect to the canonical URL.',
    sortOrder: 32,
  },
  {
    code: 'PREFLIGHT_CANONICAL_PROTOCOL',
    provider: 'ReleasePass',
    category: 'Canonical',
    name: 'Canonical Protocol Mismatch',
    description: 'Canonical URL uses a different protocol (HTTP vs HTTPS) than the page.',
    severity: 'BLOCKER',
    impact: 'Creates duplicate content issues and mixed security signals.',
    fix: 'Ensure canonical URL uses the same protocol as the page (preferably HTTPS).',
    sortOrder: 33,
  },
  {
    code: 'PREFLIGHT_CANONICAL_HOSTNAME',
    provider: 'ReleasePass',
    category: 'Canonical',
    name: 'Canonical Hostname Mismatch',
    description: 'Canonical tag points to a different hostname.',
    severity: 'CRITICAL',
    impact: 'Signals to search engines that a different domain is the authority.',
    fix: 'Update canonical to use the correct hostname for this site.',
    sortOrder: 34,
  },
  {
    code: 'PREFLIGHT_CANONICAL_PARAMS',
    provider: 'ReleasePass',
    category: 'Canonical',
    name: 'Canonical Has Tracking Parameters',
    description: 'Canonical URL contains tracking or session parameters.',
    severity: 'CRITICAL',
    impact: 'Creates unstable canonical signals as parameters change.',
    fix: 'Remove tracking parameters (utm_*, gclid, fbclid, etc.) from canonical URL.',
    sortOrder: 35,
  },

  // Batch 4: Security (4 rules)
  {
    code: 'PREFLIGHT_SECURITY_HTTP',
    provider: 'ReleasePass',
    category: 'Security & Protocol',
    name: 'Page Served Over HTTP',
    description: 'Page is served over insecure HTTP instead of HTTPS.',
    severity: 'BLOCKER',
    impact: 'Insecure pages are penalized by search engines and show browser warnings.',
    fix: 'Configure server to serve pages over HTTPS and redirect HTTP to HTTPS.',
    sortOrder: 40,
  },
  {
    code: 'PREFLIGHT_SECURITY_HTTP_URLS',
    provider: 'ReleasePass',
    category: 'Security & Protocol',
    name: 'HTTP URLs in Meta Tags',
    description: 'Canonical or Open Graph URLs use HTTP instead of HTTPS.',
    severity: 'BLOCKER',
    impact: 'Mixed protocol signals create SEO and security inconsistencies.',
    fix: 'Update all canonical and og: URLs to use HTTPS.',
    sortOrder: 41,
  },
  {
    code: 'PREFLIGHT_SECURITY_MIXED_CONTENT',
    provider: 'ReleasePass',
    category: 'Security & Protocol',
    name: 'Mixed Content Detected',
    description: 'HTTPS page loads resources (scripts, images, etc.) over HTTP.',
    severity: 'CRITICAL',
    impact: 'Browsers may block mixed content, breaking page functionality.',
    fix: 'Update all resource URLs to use HTTPS or protocol-relative URLs.',
    sortOrder: 42,
  },
  {
    code: 'PREFLIGHT_SECURITY_IFRAME',
    provider: 'ReleasePass',
    category: 'Security & Protocol',
    name: 'Insecure Iframe Embed',
    description: 'Page embeds iframes using HTTP sources.',
    severity: 'CRITICAL',
    impact: 'Insecure iframes pose security risks and may be blocked by browsers.',
    fix: 'Update iframe src attributes to use HTTPS URLs.',
    sortOrder: 43,
  },

  // Batch 5: Links (1 rule)
  {
    code: 'PREFLIGHT_EMPTY_LINK',
    provider: 'ReleasePass',
    category: 'Links',
    name: 'Placeholder Link',
    description: 'Link element has href="#" indicating an incomplete or placeholder link.',
    severity: 'BLOCKER',
    impact: 'Placeholder links frustrate users and indicate incomplete development.',
    fix: 'Replace href="#" with a valid URL or remove the link if not needed.',
    sortOrder: 50,
  },

  // Batch 6: Alt Tag (1 rule)
  {
    code: 'EMPTY_ALT_TAG',
    provider: 'ReleasePass',
    category: 'SEO Essentials',
    name: 'Empty Alt Attribute',
    description: 'Image has an alt attribute that is empty or contains only whitespace.',
    severity: 'HIGH',
    impact: 'Empty alt attributes may indicate incomplete content or accessibility issues. Screen readers will skip these images entirely.',
    fix: 'Add descriptive alt text, or if the image is decorative, consider using CSS background images instead.',
    sortOrder: 60,
  },

  // Batch 7: Favicon (1 rule)
  {
    code: 'PREFLIGHT_FAVICON_MISSING',
    provider: 'ReleasePass',
    category: 'Site Resources',
    name: 'Missing Favicon',
    description: 'No valid favicon found. Checked for link tags and /favicon.ico fallback.',
    severity: 'CRITICAL',
    impact: 'Browser tabs and bookmarks show a generic icon, making your site look unprofessional or incomplete.',
    fix: 'Add a favicon using <link rel="icon" href="/favicon.ico"> or place a favicon.ico file in your site root.',
    sortOrder: 70,
  },

  // Batch 8: Meta & Title (4 rules) - stored in Site Resources category
  {
    code: 'PREFLIGHT_TITLE_TOO_LONG',
    provider: 'ReleasePass',
    category: 'Site Resources',
    name: 'Title Too Long',
    description: 'Page title exceeds the recommended maximum length of 55 characters.',
    severity: 'HIGH',
    impact: 'Long titles may be truncated in search engine results pages (SERPs), hiding important information.',
    fix: 'Shorten the title to 55 characters or less while keeping it descriptive and relevant.',
    sortOrder: 80,
  },
  {
    code: 'PREFLIGHT_TITLE_TOO_SHORT',
    provider: 'ReleasePass',
    category: 'Site Resources',
    name: 'Title Too Short',
    description: 'Page title is below the recommended minimum length of 30 characters.',
    severity: 'HIGH',
    impact: 'Short titles provide insufficient context for search engines and users, potentially reducing click-through rates.',
    fix: 'Expand the title to at least 30 characters with relevant keywords and descriptive content.',
    sortOrder: 81,
  },
  {
    code: 'PREFLIGHT_META_DESC_TOO_LONG',
    provider: 'ReleasePass',
    category: 'Site Resources',
    name: 'Meta Description Too Long',
    description: 'Meta description exceeds the recommended maximum length of 155 characters.',
    severity: 'MEDIUM',
    impact: 'Long descriptions may be truncated in SERPs, potentially cutting off your call-to-action.',
    fix: 'Shorten the meta description to 155 characters or less while maintaining a compelling message.',
    sortOrder: 82,
  },
  {
    code: 'PREFLIGHT_META_DESC_TOO_SHORT',
    provider: 'ReleasePass',
    category: 'Site Resources',
    name: 'Meta Description Too Short',
    description: 'Meta description is below the recommended minimum length of 70 characters.',
    severity: 'MEDIUM',
    impact: 'Short descriptions may not provide enough context to entice users to click through from search results.',
    fix: 'Expand the meta description to at least 70 characters with a compelling summary of the page content.',
    sortOrder: 83,
  },

  // =========================================================================
  // LIGHTHOUSE SEO AUDITS (13 rules)
  // =========================================================================
  {
    code: 'document-title',
    provider: 'LIGHTHOUSE',
    category: 'SEO Essentials',
    name: 'Document Title',
    description: 'Document has a <title> element.',
    severity: 'CRITICAL',
    impact: 'The title is the first thing users see in search results and browser tabs.',
    fix: 'Add a descriptive <title> element to the <head> of your page.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/document-title/',
    sortOrder: 100,
  },
  {
    code: 'meta-description',
    provider: 'LIGHTHOUSE',
    category: 'SEO Essentials',
    name: 'Meta Description',
    description: 'Document has a meta description.',
    severity: 'HIGH',
    impact: 'Meta descriptions may be shown in search results and affect click-through rates.',
    fix: 'Add a <meta name="description" content="..."> tag with a compelling summary.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/meta-description/',
    sortOrder: 101,
  },
  {
    code: 'http-status-code',
    provider: 'LIGHTHOUSE',
    category: 'SEO Essentials',
    name: 'HTTP Status Code',
    description: 'Page has successful HTTP status code.',
    severity: 'BLOCKER',
    impact: 'Pages with unsuccessful status codes (4xx, 5xx) will not be indexed.',
    fix: 'Ensure the server returns a 2xx status code for valid pages.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/http-status-code/',
    sortOrder: 102,
  },
  {
    code: 'link-text',
    provider: 'LIGHTHOUSE',
    category: 'SEO Essentials',
    name: 'Descriptive Link Text',
    description: 'Links have descriptive text.',
    severity: 'MEDIUM',
    impact: 'Generic link text like "click here" hurts SEO and accessibility.',
    fix: 'Use descriptive anchor text that indicates the link destination.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/link-text/',
    sortOrder: 103,
  },
  {
    code: 'crawlable-anchors',
    provider: 'LIGHTHOUSE',
    category: 'Crawlability',
    name: 'Crawlable Links',
    description: 'Links are crawlable.',
    severity: 'HIGH',
    impact: 'Non-crawlable links prevent search engines from discovering linked pages.',
    fix: 'Ensure links use standard <a href="..."> elements with valid URLs.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/crawlable-anchors/',
    sortOrder: 104,
  },
  {
    code: 'is-crawlable',
    provider: 'LIGHTHOUSE',
    category: 'Crawlability',
    name: 'Page is Crawlable',
    description: 'Page is not blocked from indexing.',
    severity: 'BLOCKER',
    impact: 'Blocked pages will not appear in search results.',
    fix: 'Remove noindex directives from meta tags and HTTP headers if indexing is desired.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/is-crawlable/',
    sortOrder: 105,
  },
  {
    code: 'robots-txt',
    provider: 'LIGHTHOUSE',
    category: 'Crawlability',
    name: 'Valid robots.txt',
    description: 'robots.txt is valid.',
    severity: 'HIGH',
    impact: 'Invalid robots.txt may block search engines unintentionally.',
    fix: 'Validate your robots.txt file and ensure it allows desired crawling.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/robots-txt/',
    sortOrder: 106,
  },
  {
    code: 'image-alt',
    provider: 'LIGHTHOUSE',
    category: 'SEO Essentials',
    name: 'Image Alt Text',
    description: 'Image elements have [alt] attributes.',
    severity: 'HIGH',
    impact: 'Missing alt text hurts accessibility and image search visibility.',
    fix: 'Add descriptive alt attributes to all images.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/image-alt/',
    sortOrder: 107,
  },
  {
    code: 'hreflang',
    provider: 'LIGHTHOUSE',
    category: 'Internationalization',
    name: 'Valid hreflang',
    description: 'Document has a valid hreflang.',
    severity: 'MEDIUM',
    impact: 'Invalid hreflang tags can cause wrong language versions to appear in search.',
    fix: 'Ensure hreflang tags use valid language codes and point to correct URLs.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/hreflang/',
    sortOrder: 108,
  },
  {
    code: 'canonical',
    provider: 'LIGHTHOUSE',
    category: 'Canonical',
    name: 'Valid Canonical',
    description: 'Document has a valid rel=canonical.',
    severity: 'HIGH',
    impact: 'Missing or invalid canonical may cause duplicate content issues.',
    fix: 'Add a valid <link rel="canonical" href="..."> to specify the preferred URL.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/canonical/',
    sortOrder: 109,
  },
  {
    code: 'font-size',
    provider: 'LIGHTHOUSE',
    category: 'Mobile Usability',
    name: 'Legible Font Sizes',
    description: 'Document uses legible font sizes.',
    severity: 'HIGH',
    impact: 'Small text is hard to read on mobile devices.',
    fix: 'Use a base font size of at least 16px and ensure text is readable without zooming.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/font-size/',
    sortOrder: 110,
  },
  {
    code: 'tap-targets',
    provider: 'LIGHTHOUSE',
    category: 'Mobile Usability',
    name: 'Tap Targets Sized',
    description: 'Tap targets are sized appropriately.',
    severity: 'HIGH',
    impact: 'Small tap targets are hard to tap accurately on mobile devices.',
    fix: 'Ensure buttons and links are at least 48x48 pixels with adequate spacing.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/tap-targets/',
    sortOrder: 111,
  },
  {
    code: 'structured-data',
    provider: 'LIGHTHOUSE',
    category: 'SEO Essentials',
    name: 'Valid Structured Data',
    description: 'Structured data is valid.',
    severity: 'MEDIUM',
    impact: 'Invalid structured data may not generate rich results in search.',
    fix: 'Validate your JSON-LD or Schema.org markup using Google Rich Results Test.',
    docUrl: 'https://developer.chrome.com/docs/lighthouse/seo/structured-data/',
    sortOrder: 112,
  },

  // =========================================================================
  // LINKINATOR (4 rules)
  // =========================================================================
  {
    code: 'LINK_CHECK_PASSED',
    provider: 'LINKINATOR',
    category: 'Links',
    name: 'Links Valid',
    description: 'All links on the page are valid and accessible.',
    severity: 'LOW',
    impact: null,
    fix: null,
    sortOrder: 200,
  },
  {
    code: 'BROKEN_INTERNAL_LINK',
    provider: 'LINKINATOR',
    category: 'Links',
    name: 'Broken Internal Link',
    description: 'An internal link returns a 4xx or 5xx error.',
    severity: 'BLOCKER',
    impact: 'Broken internal links frustrate users and waste crawl budget.',
    fix: 'Fix or remove the broken link. Verify the target page exists.',
    sortOrder: 201,
  },
  {
    code: 'BROKEN_EXTERNAL_LINK',
    provider: 'LINKINATOR',
    category: 'Links',
    name: 'Broken External Link',
    description: 'An external link returns a 4xx or 5xx error.',
    severity: 'MEDIUM',
    impact: 'Broken external links degrade user experience and trust.',
    fix: 'Update or remove the broken link. Consider linking to an alternative resource.',
    sortOrder: 202,
  },
  {
    code: 'REDIRECT_CHAIN',
    provider: 'LINKINATOR',
    category: 'Links',
    name: 'Redirect Chain',
    description: 'Link redirects through multiple hops before reaching destination.',
    severity: 'LOW',
    impact: 'Redirect chains slow page load and dilute link equity.',
    fix: 'Update the link to point directly to the final destination URL.',
    sortOrder: 203,
  },
  {
    code: 'PREFLIGHT_EXTERNAL_LINK_TARGET',
    provider: 'ReleasePass',
    category: 'Links',
    name: 'External Links Open in New Window',
    description: 'External links should open in a new window/tab to keep users on your site.',
    severity: 'HIGH',
    impact: 'External links without target="_blank" navigate users away from your site.',
    fix: 'Add target="_blank" to external links. Consider also adding rel="noopener" for security.',
    sortOrder: 204,
    isOptional: true,
  },
  {
    code: 'PREFLIGHT_INLINE_CSS',
    provider: 'ReleasePass',
    category: 'Site Resources',
    name: 'Inline Styles Detected',
    description: 'Content elements have inline style attributes, often from copy-pasting from Google Docs or Word.',
    severity: 'HIGH',
    impact: 'Inline styles make content harder to maintain, override CSS rules, and can cause inconsistent styling across the site.',
    fix: 'Remove inline style attributes and use CSS classes instead. When pasting from Google Docs or Word, use "Paste as Plain Text" or clear formatting after pasting.',
    sortOrder: 84,
    isOptional: true,
  },
  {
    code: 'PREFLIGHT_PLACEHOLDER_TEXT',
    provider: 'ReleasePass',
    category: 'Site Resources',
    name: 'Placeholder Text Detected',
    description: 'Page contains lorem ipsum, TBD, TODO, or other placeholder text that was not replaced with real content.',
    severity: 'BLOCKER',
    impact: 'Placeholder text indicates incomplete content and should never appear on production pages. This is a launch-blocking issue.',
    fix: 'Replace all placeholder text (lorem ipsum, TBD, TODO, [Insert X here]) with actual content before publishing.',
    sortOrder: 86,
  },

  // =========================================================================
  // INTERNAL / ERROR CODES (4 rules)
  // =========================================================================
  {
    code: 'CHECK_FAILED',
    provider: 'INTERNAL',
    category: 'System',
    name: 'Check Failed',
    description: 'A check could not be completed due to an error.',
    severity: 'HIGH',
    impact: 'The check result is unknown due to a system error.',
    fix: 'Retry the test. If the error persists, check the URL is accessible.',
    sortOrder: 900,
  },
  {
    code: 'LIGHTHOUSE_API_ERROR',
    provider: 'INTERNAL',
    category: 'System',
    name: 'Lighthouse API Error',
    description: 'PageSpeed Insights API returned an error.',
    severity: 'HIGH',
    impact: 'Lighthouse SEO audits could not be performed.',
    fix: 'Retry the test. Check if the URL is publicly accessible.',
    sortOrder: 901,
  },
  {
    code: 'LINKINATOR_ERROR',
    provider: 'INTERNAL',
    category: 'System',
    name: 'Link Check Error',
    description: 'Link checking failed due to an error.',
    severity: 'HIGH',
    impact: 'Broken link detection could not be performed.',
    fix: 'Retry the test. Check if the URL is publicly accessible.',
    sortOrder: 902,
  },
  {
    code: 'CUSTOM_RULES_ERROR',
    provider: 'INTERNAL',
    category: 'System',
    name: 'Custom Rules Error',
    description: 'Custom preflight rules could not be executed.',
    severity: 'HIGH',
    impact: 'Custom rule checks could not be performed.',
    fix: 'Retry the test. Check if the URL is publicly accessible.',
    sortOrder: 903,
  },
  {
    code: 'SPELLING_CHECK_FAILED',
    provider: 'LANGUAGETOOL',
    category: 'System',
    name: 'Spelling Check Failed',
    description: 'System could not execute spell check.',
    severity: 'BLOCKER',
    impact: 'Spelling and grammar checks could not be performed.',
    fix: 'Retry the test. Check if the URL is publicly accessible.',
    sortOrder: 904,
  },
] as const;

async function main() {
  console.log('Seeding ReleaseRuleCategory table...');

  // Create a map to store category IDs
  const categoryMap = new Map<string, string>();

  // Seed categories first
  for (const cat of categories) {
    const category = await prisma.releaseRuleCategory.upsert({
      where: { name: cat.name },
      update: { sortOrder: cat.sortOrder },
      create: { name: cat.name, sortOrder: cat.sortOrder },
    });
    categoryMap.set(cat.name, category.id);
    console.log(`  ✓ Category: ${cat.name}`);
  }

  console.log(`\nSeeded ${categories.length} categories.\n`);
  console.log('Seeding ReleaseRule table...');

  // Seed rules with categoryId
  for (const rule of releaseRules) {
    const categoryId = categoryMap.get(rule.category);
    if (!categoryId) {
      console.error(`  ✗ Category not found for rule ${rule.code}: ${rule.category}`);
      continue;
    }

    await prisma.releaseRule.upsert({
      where: { code: rule.code },
      update: {
        provider: rule.provider as any,
        categoryId,
        name: rule.name,
        description: rule.description,
        severity: rule.severity as any,
        impact: rule.impact,
        fix: rule.fix,
        docUrl: 'docUrl' in rule ? rule.docUrl : null,
        sortOrder: rule.sortOrder,
        isOptional: 'isOptional' in rule ? rule.isOptional : false,
      },
      create: {
        code: rule.code,
        provider: rule.provider as any,
        categoryId,
        name: rule.name,
        description: rule.description,
        severity: rule.severity as any,
        impact: rule.impact,
        fix: rule.fix,
        docUrl: 'docUrl' in rule ? rule.docUrl : null,
        sortOrder: rule.sortOrder,
        isOptional: 'isOptional' in rule ? rule.isOptional : false,
      },
    });
    console.log(`  ✓ ${rule.code}`);
  }

  console.log(`\nSeeded ${releaseRules.length} rules.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
