# Custom Preflight Rules Implementation Plan

## Goal

Implement custom preflight rules that validate launch-critical page elements using HTML parsing. Rules requiring Playwright for rendered DOM analysis are deferred to v1.1.

## V1 Scope (20 Rules - HTML Parsing Only) ✓ COMPLETE

### Indexing & Crawl Control (3 rules)

| Code                           | Severity | Description                                    |
|--------------------------------|----------|------------------------------------------------|
| PREFLIGHT_INDEX_NOINDEX_HEADER | Blocker  | Page marked noindex via HTTP headers           |
| PREFLIGHT_INDEX_NOFOLLOW       | Critical | Page marked nofollow via meta or headers       |
| PREFLIGHT_INDEX_CONFLICT       | Blocker  | Conflicting index directives (meta vs headers) |

### Canonical (6 rules)

| Code                         | Severity | Description                                    |
|------------------------------|----------|------------------------------------------------|
| PREFLIGHT_CANONICAL_MISSING  | Blocker  | Canonical tag missing                          |
| PREFLIGHT_CANONICAL_MULTIPLE | Blocker  | Multiple canonical tags detected               |
| PREFLIGHT_CANONICAL_MISMATCH | Blocker  | Canonical points to different URL              |
| PREFLIGHT_CANONICAL_PROTOCOL | Blocker  | Canonical uses wrong protocol (HTTP vs HTTPS)  |
| PREFLIGHT_CANONICAL_HOSTNAME | Blocker  | Canonical points to non-primary hostname       |
| PREFLIGHT_CANONICAL_PARAMS   | Critical | Canonical contains tracking/session parameters |

### Heading Structure (3 rules)

| Code                  | Severity | Description                       |
|-----------------------|----------|-----------------------------------|
| PREFLIGHT_H1_MISSING  | Blocker  | No H1 present on page             |
| PREFLIGHT_H1_MULTIPLE | Critical | More than one H1 present          |
| PREFLIGHT_H1_EMPTY    | Blocker  | H1 exists but is empty/whitespace |

### Security & Protocol (4 rules)

| Code                             | Severity | Description                     |
|----------------------------------|----------|---------------------------------|
| PREFLIGHT_SECURITY_HTTP          | Blocker  | Page served over HTTP           |
| PREFLIGHT_SECURITY_HTTP_URLS     | Blocker  | Canonical or OG URLs use HTTP   |
| PREFLIGHT_SECURITY_MIXED_CONTENT | Critical | Mixed content assets detected   |
| PREFLIGHT_SECURITY_IFRAME        | Critical | Insecure iframe embeds detected |

### Mobile & Responsiveness (1 rule)

| Code                       | Severity | Description               |
|----------------------------|----------|---------------------------|
| PREFLIGHT_VIEWPORT_MISSING | Critical | Viewport meta tag missing |

### Links (1 rule)

| Code                 | Severity | Description              |
|----------------------|----------|--------------------------|
| PREFLIGHT_EMPTY_LINK | Blocker  | Links with href="#" only |

### Accessibility & SEO (1 rule)

| Code          | Severity | Description                                      |
|---------------|----------|--------------------------------------------------|
| EMPTY_ALT_TAG | High     | Image has empty alt attribute (alt="" or alt=" ") |

### Site Resources (1 rule)

| Code                     | Severity | Description                |
|--------------------------|----------|----------------------------|
| PREFLIGHT_FAVICON_MISSING| Critical | Favicon missing or not found |

## V1.1 Scope (4 Rules - Require Playwright) - DEFERRED

These rules require rendered DOM analysis via Playwright:

| Code                      | Severity | Description                                |
|---------------------------|----------|--------------------------------------------|
| PREFLIGHT_H1_HIDDEN       | Critical | H1 is hidden or visually suppressed        |
| PREFLIGHT_RENDER_EMPTY    | Blocker  | No meaningful content in initial HTML      |
| PREFLIGHT_RENDER_JS_ONLY  | Critical | Primary content requires JavaScript        |
| PREFLIGHT_RENDER_POSTLOAD | Critical | Critical SEO elements injected post-load   |

## V1.2 Scope (4 Rules) - PLANNED

### Meta & Title Quality (4 rules)

| Code                        | Severity | Description                            |
|-----------------------------|----------|----------------------------------------|
| PREFLIGHT_TITLE_TOO_LONG    | High     | Title exceeds 55 characters            |
| PREFLIGHT_TITLE_TOO_SHORT   | High     | Title below 30 characters              |
| PREFLIGHT_META_DESC_TOO_LONG| Medium   | Meta description exceeds 155 characters|
| PREFLIGHT_META_DESC_TOO_SHORT| Medium  | Meta description below 70 characters   |

## V1.3 Scope (5 Rules) - PLANNED

### Social Metadata (3 rules)

| Code                      | Severity | Description                              |
|---------------------------|----------|------------------------------------------|
| PREFLIGHT_OG_TITLE_MISSING| Low      | Missing og:title (no SEO impact)         |
| PREFLIGHT_OG_DESC_MISSING | Low      | Missing og:description (no SEO impact)   |
| PREFLIGHT_OG_IMAGE_MISSING| Low      | Missing og:image (no SEO impact)         |

### Language & Accessibility (2 rules)

| Code                  | Severity | Description                              |
|-----------------------|----------|------------------------------------------|
| PREFLIGHT_LANG_MISSING| Low      | HTML lang attribute missing (no SEO impact) |
| PREFLIGHT_LANG_INVALID| Low      | HTML lang value invalid/malformed (no SEO impact) |

## Implementation Details

### Architecture

File: `worker/providers/preflight/custom-rules.ts`

```typescript
import * as cheerio from 'cheerio'
import { IssueProvider, IssueSeverity, ResultStatus } from '@prisma/client'
import { fetchWithTimeout } from '../../lib/fetch'

export async function runCustomRules(url: string, rulesMap: ReleaseRulesMap): Promise<ResultItemToCreate[]> {
  const results: ResultItemToCreate[] = []
  const page = await fetchPage(url)
  const $ = cheerio.load(page.html)

  // Batch 1: H1 + Viewport rules
  results.push(...checkH1Rules($, rulesMap))
  results.push(...checkViewportRules($, rulesMap))

  // Batch 2: Indexing rules
  results.push(...checkIndexingRules($, page, rulesMap))

  // Batch 3: Canonical rules
  results.push(...checkCanonicalRules($, page, rulesMap))

  // Batch 4: Security rules
  results.push(...checkSecurityRules($, page, rulesMap))

  // Batch 5: Link rules
  results.push(...checkLinkRules($, rulesMap))

  // Batch 6: Alt tag rules
  results.push(...checkAltTagRules($, rulesMap))

  // Batch 7: Favicon rules
  results.push(...await checkFaviconRules($, page, rulesMap))

  return results
}
```

### Rule Category Functions

Each category function returns an array of ResultItems (both PASS and FAIL):

- `checkH1Rules($, rulesMap)` - H1 presence/count/content
- `checkViewportRules($, rulesMap)` - Viewport meta tag
- `checkIndexingRules($, page, rulesMap)` - X-Robots-Tag header + meta robots
- `checkCanonicalRules($, page, rulesMap)` - Canonical tag validation
- `checkSecurityRules($, page, rulesMap)` - Protocol and mixed content
- `checkLinkRules($, rulesMap)` - Empty href detection
- `checkAltTagRules($, rulesMap)` - Empty alt attribute detection
- `checkFaviconRules($, page, rulesMap)` - Favicon presence validation

### Helper Functions

```typescript
function createPass(code: string, name: string, meta?: Record<string, unknown>): ResultItemToCreate
function createFail(code: string, name: string, fallbackSeverity: IssueSeverity, rulesMap: ReleaseRulesMap, meta?: Record<string, unknown>): ResultItemToCreate
function getSeverityFromRule(code: string, rulesMap: ReleaseRulesMap, fallback: IssueSeverity): IssueSeverity
async function fetchPage(url: string): Promise<FetchedPage>
```

## Files

| File                                       | Status   |
|--------------------------------------------|----------|
| worker/providers/preflight/custom-rules.ts | Complete |
| worker/providers/preflight/index.ts        | Complete |
| prisma/seed-release-rules.ts               | Complete |

## Key Implementation Notes

1. **ReleaseRulesMap**: Severity is looked up from database, with hardcoded fallback
2. **HTTP Headers**: Use fetchWithTimeout() to get headers alongside HTML
3. **Canonical Mismatch**: Compare normalized paths (handle trailing slashes)
4. **Mixed Content**: Only checks static HTML src/href attributes
5. **Empty Links**: Excludes nav dropdown triggers (aria-haspopup, nested lists)
6. **Error Handling**: Wrap in try/catch, operational errors fail the URL

## Testing

1. Run against pages with known issues to verify detection
2. Verify all rules produce ResultItems (PASS or FAIL)
3. Confirm score calculation penalizes by severity
4. Run seed script: `npx tsx prisma/seed-release-rules.ts`
