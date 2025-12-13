# ReleasePass: Architecture Review & Recommendations

**Date**: December 8, 2024
**Status**: Decisions Finalized

This document captures architectural decisions, schema recommendations, and clarifications based on a comprehensive review of the functional and technical specifications.

---

## ✅ Key Decisions Summary

### Test Execution Scope

| Test Type | Scope | URL Selection | Notes |
|-----------|-------|---------------|-------|
| **Site Audit** | Full sitemap crawl | Automatic from `sitemapUrl` | Max 500 pages, same-subdomain only |
| **Performance** | User-selectable | Pages Mode OR Full Site Mode | Full Site limited to 20 URLs in MVP |
| **Screenshots** | Custom URL list | User-pasted URLs | Fixed viewport matrix (4 devices) |
| **Spelling** | Custom URL list | User-pasted URLs | Uses Playwright for text extraction |

### Performance Data Source
- **PageSpeed Insights API** is the source of truth for Core Web Vitals
- SE Ranking's "Speed & Performance" checks will **NOT** be disabled but PageSpeed data takes precedence
- Store both if needed, but Release Readiness uses PageSpeed scores only

### Performance Multi-URL Scoring
- **MVP Decision**: Use **average performance score** across all tested URLs
- Each URL tested for both mobile and desktop viewports
- Display per-URL breakdown in UI with visual warning if ANY page scores <50

### Test

Run Status vs. Quality Assessment
- `TestRun.status` = **Operational execution status** (QUEUED → RUNNING → SUCCESS/FAILED/PARTIAL)
  - SUCCESS: Worker completed processing successfully
  - FAILED: All providers failed or worker encountered fatal error
  - PARTIAL: Some providers succeeded, some failed
- **Quality assessment** stored separately:
  - Site Audit & Performance: `TestRun.score` field (0-100)
  - Screenshots & Spelling: `ManualTestStatus.statusLabel` (PASS/REVIEW/FAIL)

### Manual Test Status Behavior (MVP)
- Only current status is stored; updates overwrite previous status
- No history/audit trail in MVP
- Change history will be added in v1.5

---

## 🔧 Schema Changes & Additions

### 1. Add `score` field to TestRun

```prisma
model TestRun {
  id         String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId  String      @db.Uuid
  type       TestType
  status     TestStatus  @default(QUEUED)
  score      Int?        // 0-100 for Site Audit & Performance, null for Screenshots/Spelling
  startedAt  DateTime?
  finishedAt DateTime?
  rawPayload Json?
  error      String?
  lastHeartbeat DateTime? // Worker updates every 30s to detect stuck runs

  // ... relations
}
```

**Usage**:
- Site Audit: SE Ranking's health score
- Performance: Average of all URL scores (mobile viewport)
- Screenshots/Spelling: Always `null`

---

### 2. Add `TestRunConfig` table for URL selection

```prisma
enum TestScope {
  SINGLE_URL      // Just the project's siteUrl
  CUSTOM_URLS     // User-pasted list
  SITEMAP         // Full sitemap crawl
}

model TestRunConfig {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  testRunId   String    @unique @db.Uuid
  scope       TestScope
  urls        String[]  // Array of URLs for CUSTOM_URLS, empty for SITEMAP

  testRun     TestRun   @relation(fields: [testRunId], references: [id], onDelete: Cascade)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([testRunId])
}
```

**Purpose**: Store which URLs were included in each test run for reproducibility and debugging.

---

### 3. Enhance `UrlResult` table

```prisma
model UrlResult {
  id                String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  testRunId         String     @db.Uuid
  url               String

  // Core Web Vitals (Performance only)
  lcp               Float?     // Largest Contentful Paint (seconds)
  cls               Float?     // Cumulative Layout Shift (score)
  inp               Float?     // Interaction to Next Paint (ms)
  fcp               Float?     // First Contentful Paint (seconds)
  tbt               Float?     // Total Blocking Time (ms)
  tti               Float?     // Time to Interactive (seconds)

  // Scores
  performanceScore  Int?       // PageSpeed performance score (0-100)
  accessibilityScore Int?      // Lighthouse accessibility score (0-100)

  // Site Audit specific
  issueCount        Int?       // Total issues for this URL
  criticalIssues    Int?       // Count of CRITICAL severity issues

  // Viewport/device (for Performance tests)
  viewport          String?    // "mobile" or "desktop"

  // Raw data
  additionalMetrics Json?      // Provider-specific extras

  testRun           TestRun    @relation(fields: [testRunId], references: [id], onDelete: Cascade)

  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  @@index([testRunId])
  @@index([url])
  @@index([performanceScore])
}
```

**Usage**:
- Performance: 2 rows per URL (mobile + desktop), with `viewport` set
- Site Audit: 1 row per crawled URL with `issueCount` aggregates
- Screenshots/Spelling: Do NOT create UrlResult rows

---

## 🎨 Score-to-Color Mapping (MVP)

**Recommendation**: Hardcoded configuration in code, not database table.

```typescript
// lib/scoring.ts
export const SCORE_THRESHOLDS = {
  SITE_AUDIT: {
    GREEN: 90,    // 90-100
    YELLOW: 70,   // 70-89
    RED: 0        // 0-69
  },
  PERFORMANCE: {
    GREEN: 90,    // Good
    YELLOW: 50,   // Needs Improvement
    RED: 0        // Poor
  }
} as const;

export type ScoreColor = 'GREEN' | 'YELLOW' | 'RED' | 'GREY';

export function getScoreColor(score: number | null, testType: 'SITE_AUDIT' | 'PERFORMANCE'): ScoreColor {
  if (score === null) return 'GREY';

  const thresholds = SCORE_THRESHOLDS[testType];
  if (score >= thresholds.GREEN) return 'GREEN';
  if (score >= thresholds.YELLOW) return 'YELLOW';
  return 'RED';
}

export function getManualStatusColor(status: ManualStatusLabel): ScoreColor {
  switch (status) {
    case 'PASS': return 'GREEN';
    case 'FAIL': return 'RED';
    case 'REVIEW': return 'GREY';
  }
}
```

**Future**: Move to database `ScoringConfig` table if custom thresholds are needed per client (v1.5+).

---

## 🔄 Worker Implementation Recommendations

### Worker Polling Strategy

```typescript
// worker/index.ts
let pollInterval = 10_000; // Start at 10 seconds
const MIN_INTERVAL = 10_000;
const MAX_INTERVAL = 60_000;

async function workerLoop() {
  while (true) {
    const job = await claimNextQueuedRun();

    if (job) {
      pollInterval = MIN_INTERVAL; // Reset on success
      await processTestRun(job);
    } else {
      // No jobs, back off exponentially
      pollInterval = Math.min(pollInterval * 1.5, MAX_INTERVAL);
    }

    await sleep(pollInterval);
  }
}
```

**Alternative for v1.2+**: Consider Supabase Realtime or a queue system (BullMQ).

---

### External API Retry Strategy

```typescript
async function callExternalApi<T>(
  apiCall: () => Promise<T>,
  options = { maxRetries: 3, initialDelay: 1000 }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (except 429 rate limit)
      if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
        throw error;
      }

      if (attempt < options.maxRetries) {
        const delay = options.initialDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        await sleep(delay + jitter);
      }
    }
  }

  throw lastError;
}
```

**Provider-specific rules**:
- SE Ranking: Retry 3x on 500/503, fail immediately on 401/403
- PageSpeed: Retry 5x (it's flaky), 2-second initial delay
- LanguageTool: Retry 3x on 5xx
- Playwright/LambdaTest: Retry 2x on network errors

**Rate limit handling**: If rate-limited mid-test, mark TestRun as PARTIAL and log which provider failed.

---

### Stuck TestRun Cleanup

```typescript
// Separate cleanup job (runs every 5 minutes)
const stuckRuns = await prisma.testRun.findMany({
  where: {
    status: 'RUNNING',
    lastHeartbeat: {
      lt: new Date(Date.now() - 60 * 60 * 1000) // 60 minutes
    }
  }
});

for (const run of stuckRuns) {
  await prisma.testRun.update({
    where: { id: run.id },
    data: {
      status: 'FAILED',
      error: 'Test run timed out (worker may have crashed)',
      finishedAt: new Date()
    }
  });
}
```

**Worker heartbeat**: Update `lastHeartbeat` every 30 seconds during processing.

---

### Screenshot Storage Cleanup

```typescript
async function cleanupOldScreenshots(projectId: string, testType: TestType) {
  // Phase 1: Find old screenshot records
  const oldSets = await prisma.screenshotSet.findMany({
    where: {
      projectId,
      testRun: { type: testType },
      createdAt: {
        lt: // older than 2nd most recent run
      }
    }
  });

  // Phase 2: Delete from storage first, then DB
  for (const set of oldSets) {
    try {
      await supabase.storage
        .from('qa-screenshots')
        .remove([set.storageKey]);
    } catch (err) {
      console.error(`Failed to delete ${set.storageKey}, continuing anyway`);
      // Don't block on storage errors
    }

    await prisma.screenshotSet.delete({ where: { id: set.id } });
  }
}
```

**Future improvement (v1.3)**: Add a `deleted` flag instead of hard delete, then reconcile storage async.

---

## 📊 Issue Aggregation (MVP)

**Recommendation**: Simple grouping by issue code + link to SE Ranking report.

Store issues as-is in `Issue` table (one row per URL per issue). API endpoint provides aggregated view:

```typescript
// API: /api/projects/{id}/test-runs/{runId}/issues/summary
{
  issueGroups: [
    {
      code: "TITLE_TOO_SHORT",
      severity: "MEDIUM",
      affectedUrlCount: 47,
      affectedUrls: ["url1", "url2", ...],  // First 10 for preview
      summary: "Title tag is shorter than 30 characters"
    }
  ],
  seRankingReportUrl: "https://seranking.com/..." // Deep link if available
}
```

UI displays: "Title too short (47 affected pages) — [View SE Ranking Report]"

---

## 📱 Fixed Viewport Matrix (MVP)

```typescript
export const SCREENSHOT_VIEWPORTS = [
  { name: 'Desktop / Chrome', width: 1440, browser: 'chromium' },
  { name: 'Desktop / Safari', width: 1440, browser: 'webkit' },
  { name: 'Tablet / iOS Safari', width: 768, browser: 'webkit', isMobile: true },
  { name: 'Mobile / iOS Safari', width: 375, browser: 'webkit', isMobile: true },
] as const;
```

**Stored in ScreenshotSet**:
- `viewport`: "Desktop / Chrome (1440)" (human-readable string)
- `storageKey`: `{projectId}/{testRunId}/{urlSlug}/{viewport}.png`

---

## 🚧 Deferred to Future Versions

### Not in MVP
1. **Email notification preferences** — All admins get all notifications (v1.5)
2. **ManualTestStatus history** — Only current status stored (v1.5)
3. **Visual diff baselines** — Schema supports `BASELINE` role but no UI/workflow (v1.2)
4. **Scheduled/webhook test triggers** — Manual only (v2.x)
5. **Authentication for password-protected sites** — Public URLs only (v2.x)
6. **JavaScript rendering for Site Audit** — Static HTML only (v2.x)
7. **Company entity exposure** — Placeholder only, no UI (v2.x)
8. **Utilities (Bulk Performance, HTML Cleaner, Bullshit Tester)** — Separate spec needed

---

## 🎯 Critical Implementation Notes

1. **Performance test "Full Site" mode** is limited to 20 URLs to avoid excessive PageSpeed API usage and long execution times.

2. **Field data (CrUX) fallback**: If CrUX data is unavailable for a URL, use lab metrics only. Add UI note: "Field data unavailable (not enough real-user traffic)."

3. **Sitemap crawl** for Site Audit will NOT jump to different subdomains (security/scope control).

4. **Spelling text extraction** needs refinement during implementation to filter navigation/boilerplate.

5. **Foreign key cascades**: Add `ON DELETE CASCADE` to all child tables (UrlResult, Issue, ScreenshotSet) when parent TestRun is deleted.

6. **TestRun deletion triggers retention cleanup**: When a new test completes, immediately prune old TestRuns and related data.

7. **Release Readiness is always computed**, never stored. Query latest TestRun per type + ManualTestStatus on-demand.

---

## 📝 Documentation Updates Completed

### functional-spec.md
- ✅ Added "Test Execution Scope & URL Selection" section with detailed per-test-type rules
- ✅ Clarified `TestRun.status` vs quality assessment (ManualTestStatus / score)
- ✅ Added MVP note on ManualTestStatus (no history in MVP)
- ✅ Added v1.5 roadmap items (status history, email preferences)
- ✅ Added v1.2 note (baseline selection mechanism TBD)
- ✅ Marked Utilities as "not MVP scope"

### Next Documentation Needed
1. Provider-specific integration guides (SE Ranking, PageSpeed, Playwright, LanguageTool)
2. Email notification template and content
3. Detailed Release Readiness scoring rules and color thresholds
4. API endpoint specifications

---

## ❓ Open Questions (Resolved)

All 24 question groups from the initial architecture review have been addressed:

| # | Question | Resolution |
|---|----------|------------|
| 1 | Performance data overlap (SE Ranking vs PageSpeed) | ✅ PageSpeed is source of truth |
| 2 | Test scope (single URL vs sitemap) | ✅ Defined per test type, added TestRunConfig table |
| 3 | Site Audit score source | ✅ SE Ranking API returns health score |
| 4 | Score-to-color mapping | ✅ Hardcoded thresholds in code |
| 5 | Screenshot manual status confusion | ✅ Clarified TestRun.status = operational, ManualTestStatus = QA decision |
| 6 | Spelling test execution | ✅ Playwright extracts text, LanguageTool API processes |
| 7 | Performance multi-URL scoring | ✅ Average score (MVP) |
| 8 | UrlResult schema | ✅ Enhanced with viewport, issueCount fields |
| 9 | Issue aggregation | ✅ Simple grouping + SE Ranking link |
| 10 | Screenshot viewports | ✅ Fixed 4-viewport matrix |
| 11 | Retention enforcement | ✅ Added heartbeat + separate cleanup job |
| 12 | Utilities | ✅ Marked as out-of-scope for MVP |
| 13 | Email notifications | ✅ All admins, deferred preferences to v1.5 |
| 14 | Test triggers | ✅ Manual only in MVP |
| 15 | Company entity | ✅ Placeholder only, no UI |
| 16 | ManualTestStatus history | ✅ Deferred to v1.5 |
| 17 | Worker polling | ✅ 10-60s exponential backoff |
| 18 | API rate limits | ✅ Retry strategy defined |
| 19 | Worker scaling | ✅ Atomic locking supports multiple workers |
| 20 | Storage cleanup | ✅ Two-phase delete (storage first, then DB) |
| 21 | Site Audit crawl config | ✅ 500 page limit, no subdomain jumping |
| 22 | Performance field data | ✅ Lab only, UI note if CrUX unavailable |
| 23 | Screenshot auth | ✅ Not supported in MVP |
| 24 | Spelling text extraction | ✅ Playwright-based, filter TBD during implementation |

---

## 🚀 Next Steps

1. **Review and approve this document** with stakeholders
2. **Update `platform-technical-setup.md`** with the enhanced Prisma schema
3. **Begin implementation** starting with:
   - Enhanced Prisma schema migration
   - Test configuration UI (URL selection)
   - Worker retry and heartbeat logic
   - Score-to-color mapping utility
4. **Create provider integration specs** (separate documents per provider)