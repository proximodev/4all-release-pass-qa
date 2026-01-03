# Custom Preflight Rules Implementation Plan

## Goal

Implement 18 custom preflight rules for v1 that validate launch-critical page elements using HTML parsing. Four render-related rules requiring Playwright are deferred to v1.1.

## V1 Scope (18 Rules - HTML Parsing Only)

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

## Deferred to v1.1 (4 Rules - Require Playwright)

- PREFLIGHT_H1_HIDDEN - H1 is hidden/visually suppressed
- PREFLIGHT_RENDER_EMPTY - No meaningful content in initial HTML
- PREFLIGHT_RENDER_JS_ONLY - Primary content requires JavaScript
- PREFLIGHT_RENDER_POSTLOAD - Critical SEO elements injected post-load

## Implementation

### 1. Add cheerio Dependency

```bash
cd worker && npm install cheerio
```

Cheerio provides jQuery-like API for HTML parsing (htmlparser2 is already available via linkinator).

### 2. Create Custom Rules Module

File: `worker/providers/preflight/custom-rules.ts`

Structure:

```typescript
import * as cheerio from 'cheerio'
import { IssueProvider, IssueSeverity, ResultStatus } from '@prisma/client'
import { fetchWithTimeout } from '../../lib/fetch'

interface ResultItemToCreate {
  provider: IssueProvider
  code: string
  name: string
  status: ResultStatus
  severity?: IssueSeverity
  meta?: any
}

interface FetchedPage {
  html: string
  headers: Headers
  url: string  // Final URL after redirects
  protocol: string
}

export async function runCustomRules(url: string): Promise<ResultItemToCreate[]> {
  const results: ResultItemToCreate[] = []
  const page = await fetchPage(url)
  const $ = cheerio.load(page.html)

  results.push(...checkIndexingRules($, page))
  results.push(...checkCanonicalRules($, page))
  results.push(...checkH1Rules($))
  results.push(...checkSecurityRules($, page))
  results.push(...checkViewportRules($))
  results.push(...checkLinkRules($))

  return results
}
```

### 3. Rule Category Functions

Each category function returns an array of ResultItems (both PASS and FAIL):

- `checkIndexingRules($, page)` - X-Robots-Tag header + meta robots
- `checkCanonicalRules($, page)` - Canonical tag validation
- `checkH1Rules($)` - H1 presence/count/content
- `checkSecurityRules($, page)` - Protocol and mixed content
- `checkViewportRules($)` - Viewport meta tag
- `checkLinkRules($)` - Empty href detection

### 4. Helper Functions

```typescript
function createPass(code: string, name: string): ResultItemToCreate
function createFail(code: string, name: string, severity: string, meta?: any): ResultItemToCreate
async function fetchPage(url: string): Promise<FetchedPage>
```

### 5. Integrate into Preflight Provider

File: `worker/providers/preflight/index.ts`

Add after Linkinator call (~line 102):

```typescript
import { runCustomRules } from './custom-rules'

// After Linkinator block:
const { resultItems: customItems } = await runCustomRulesWithErrorHandling(url)
urlCheckResult.resultItems.push(...customItems)
```

## Files to Create/Modify

| File                                       | Action                            |
|--------------------------------------------|-----------------------------------|
| worker/package.json                        | Add cheerio dependency            |
| worker/providers/preflight/custom-rules.ts | CREATE - All rule implementations |
| worker/providers/preflight/index.ts        | Import and call runCustomRules    |

## Key Implementation Notes

1. **HTTP Headers**: Use fetchWithTimeout() to get headers alongside HTML
2. **Canonical Mismatch**: Compare normalized paths (handle trailing slashes)
3. **Mixed Content**: Only checks static HTML src/href attributes
4. **Empty Links**: Match both href="#" and href=""
5. **Error Handling**: Wrap in try/catch, create FAIL item on error

## Testing

1. Run against pages with known issues to verify detection
2. Verify all 18 rules produce ResultItems
3. Confirm score calculation penalizes by severity
