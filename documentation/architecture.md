# ReleasePass: Architecture & Technical Design

**Last Updated**: December 14, 2024 (Page Preflight MVP)

This document describes the technical architecture, design decisions, and implementation patterns for the ReleasePass QA platform.

For setup instructions, see `installation.md`. For functional requirements, see `functional-spec.md`. For implementation timeline, see `mvp-implementation-plan.md`.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [System Architecture](#2-system-architecture)
3. [Key Architectural Decisions](#3-key-architectural-decisions)
4. [Implementation Patterns](#4-implementation-patterns)
5. [Data Model Philosophy](#5-data-model-philosophy)
6. [Deployment Strategy](#6-deployment-strategy)
7. [Deferred Features](#7-deferred-features)
8. [Critical Implementation Notes](#8-critical-implementation-notes)

---

## 1. Technology Stack

### Overview

The QA Platform is built as a modern web application designed to:
- Ship an MVP quickly
- Maintain a clean, versioned data model
- Handle background work safely (job locking, retries, dead letters)
- Provide basic observability from day one
- Stay flexible for future scaling and feature expansion

### Frontend & API Application

**Framework**: Next.js (App Router)
- **Language**: TypeScript (project-wide), with relaxed strictness initially to ease development
- **Deployment**: Vercel
- **Styling**: Tailwind CSS + PostCSS (aligns with marketing site: Astro + Tailwind)

**Responsibilities**:
- Admin UI for:
  - Managing projects
  - Triggering tests
  - Viewing test run history and issues
  - Accessing rewritten utilities (Bulk Performance, HTML Cleaner, "Bullshit Tester")
- API layer via Next.js Route Handlers:
  - CRUD endpoints for core entities (Projects, TestRuns, Issues, ScreenshotSets)
  - Endpoints to enqueue new test runs
  - Endpoints to fetch normalized test results for the UI

The app uses shared TypeScript types for core domain entities but does not enforce fully strict typing at MVP to reduce friction while still gaining type safety benefits.

### Database & ORM

**Database Provider**: Supabase (managed PostgreSQL)
**ORM / Schema**: Prisma

**Key Points**:
- Central `schema.prisma` file defines all entities (Users, Projects, TestRuns, UrlResults, Issues, ScreenshotSets, etc.)
- **Prisma Migrate** manages schema changes and keeps development, staging, and production synchronized
- **Prisma Client** used in both:
  - Next.js application (API routes)
  - Worker service (test orchestration and persistence)

This ensures a single, versioned source of truth for the data model and consistent database access across the system.

### Authentication & Authorization

**Auth Provider**: Supabase Auth

**MVP Login Flow**:
- Email + password for internal admin users
- All authenticated users are treated as admins with access to all projects (single "bucket" of data)

**Future Extensions**:
- Additional roles (e.g., read-only)
- Company → Project → User relationships for multi-tenant client access

The application maintains its own `User` table linked to Supabase Auth users via `supabaseUserId`, including a `role` field for future authorization logic.

### File Storage (Screenshots & Assets)

**Provider**: Supabase Storage (S3-compatible)

**Usage**:
- Store screenshots captured during visual QA tests
- Organize assets by project, test run, viewport/device, and URL

**Retention Rules (MVP)**:
- Only **current** and **previous** screenshot sets per project are retained
- Older screenshot objects are cleaned up by the worker as part of test completion

Database records store the storage keys/paths for screenshots. The app uses signed URLs to render images in the UI.

### Background Worker & Job Processing

**Worker Service**:
- Separate Node.js + TypeScript application
- Deployed on container-friendly platform (Railway, Fly.io, Render)
- Uses Prisma to connect to the same Supabase PostgreSQL database

**Job Model & Locking**:
- Test runs represented as rows in `TestRun` table with `status` field (QUEUED, RUNNING, SUCCESS, FAILED, PARTIAL)
- Worker **atomically claims jobs** using row-level locking or transactional updates:
  - Selects next QUEUED test run
  - Updates status to RUNNING in single atomic operation
  - Ensures only one worker can process a given job
- If test run exceeds time window or encounters repeated failures:
  - Marked as FAILED
  - Optionally moved to "dead letter" state for diagnosis

**Responsibilities**:
- Orchestrate external test providers:
  - Site Audit (PageSpeed Lighthouse SEO, Linkinator, Custom Rules for Page Preflight; SE Ranking for Full Site Crawl in v1.2)
  - Performance (PageSpeed API)
  - Screenshots (Playwright / LambdaTest)
  - Spelling/grammar (LanguageTool)
- Normalize external results into:
  - URL-level metrics (UrlResults)
  - Issue records (Issues)
  - Screenshot metadata (ScreenshotSets)
- Store small raw JSON payload per test run for debugging
- Enforce retention policies for test history and screenshot assets

### External API Providers

**Site Audit (Page Preflight - MVP)**:
- PageSpeed Insights API v5 (Lighthouse SEO audits)
- Linkinator (link checking)
- Custom Rules plugin system (file-based extensibility)

**Site Audit (Full Site Crawl - v1.2)**:
- SE Ranking Website Audit API (105 checks)

**Performance**:
- Google PageSpeed Insights API v5 (Core Web Vitals, lab metrics, CrUX field data)

**Screenshots**:
- Playwright (local rendering)
- LambdaTest (optional cloud rendering)

**Spelling/Grammar**:
- LanguageTool API

### Observability & Logging

**Error Tracking**:
- Sentry (free plan) for both app and worker errors

**Logging**:
- Structured console logs with key fields:
  - `projectId`, `testRunId`, `provider`, `status`, `duration`
- Rely on platform log views (Vercel, worker host) initially
- Dedicated log aggregator can be added later

**Timeouts & Safeguards**:
- Worker enforces maximum processing time per test run
- Mark overdue runs as FAILED with timeout error
- Heartbeat monitoring (worker updates `lastHeartbeat` every 30s)
- Separate cleanup job detects stuck runs (>60 min without heartbeat)

### Email Notifications

**Provider**: Transactional email service (Resend or Postmark)

**Trigger**: Worker sends email when TestRun transitions to terminal state:
- SUCCESS
- PARTIAL
- FAILED

**Recipients (MVP)**:
- All admin users, or configurable internal list

**Content**:
- Project name and domain
- Test type(s) included in run
- Overall status
- High-level summary (e.g., "3 providers succeeded, 1 failed: SE Ranking API error")
- Direct link to Test Run detail page

**Implementation**:
- Worker calls email provider API after updating TestRun status
- Notification failures are logged but don't affect test result

---

## 2. System Architecture

### Three-Tier Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                       │
│                        (Vercel)                              │
│                                                              │
│  ┌────────────────┐        ┌─────────────────────────────┐ │
│  │   Admin UI     │        │   API Routes                │ │
│  │   (React)      │◄──────►│   /api/projects             │ │
│  │                │        │   /api/test-runs            │ │
│  │  - Projects    │        │   /api/issues               │ │
│  │  - Test Runs   │        │   Prisma Client ──────┐     │ │
│  │  - Issues      │        └─────────────────────────────┘ │
│  │  - Screenshots │                                   │     │
│  └────────────────┘                                   │     │
└───────────────────────────────────────────────────────┼─────┘
                                                        │
                    Supabase Auth ◄─────────────────────┤
                                                        │
┌───────────────────────────────────────────────────────┼─────┐
│                   Supabase Backend                     │     │
│                                                        ▼     │
│  ┌─────────────────────────────────────────────────────────┐
│  │           PostgreSQL Database                           │
│  │  - Company, Project, User                               │
│  │  - TestRun, TestRunConfig, UrlResult, Issue             │
│  │  - ScreenshotSet, ManualTestStatus                      │
│  └─────────────────────────────────────────────────────────┘
│                                                        ▲     │
│  ┌─────────────────────────────────────────────────────────┐
│  │           Supabase Storage                              │
│  │  - qa-screenshots bucket (private)                      │
│  └─────────────────────────────────────────────────────────┘
└───────────────────────────────────────────────────────┼─────┘
                                                        │
┌───────────────────────────────────────────────────────┼─────┐
│                  Worker Service                        │     │
│              (Railway / Fly.io / Render)               │     │
│                                                        │     │
│  ┌──────────────────────────────────────┐             │     │
│  │  Job Polling Loop                    │             │     │
│  │  - Claim QUEUED TestRuns ────────────┼─────────────┘     │
│  │  - Update status to RUNNING          │                   │
│  │  - Execute providers in parallel     │                   │
│  │  - Save results                      │                   │
│  │  - Update status to SUCCESS/FAILED   │                   │
│  └──────────────────────────────────────┘                   │
│                      │                                       │
│         ┌────────────┼────────────┐                         │
│         ▼            ▼            ▼                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │PageSpeed │ │Linkinator│ │ Custom   │                    │
│  │   API    │ │          │ │  Rules   │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│         │            │            │                         │
│         └────────────┴────────────┘                         │
│                      │                                       │
│              Save to Database                               │
│          (UrlResult, Issue, etc.)                           │
└─────────────────────────────────────────────────────────────┘
```

### Test Lifecycle

Tests follow this state machine:

```
QUEUED → RUNNING → (SUCCESS | FAILED | PARTIAL)
```

**Status Definitions**:
- **QUEUED**: Test created, waiting for worker to claim
- **RUNNING**: Worker has claimed and is actively executing
- **SUCCESS**: All providers completed successfully
- **FAILED**: All providers failed or worker encountered fatal error
- **PARTIAL**: Some providers succeeded, some failed

**IMPORTANT**: `TestRun.status` represents **operational execution status** (whether the worker completed processing), NOT quality assessment.

**Quality Assessment** is stored separately:
- Site Audit & Performance: `TestRun.score` field (0-100) + configured thresholds
- Screenshots & Spelling: `ManualTestStatus.statusLabel` (PASS/REVIEW/FAIL)

### Data Flow

**1. User Triggers Test**:
- UI calls API route: `POST /api/test-runs`
- API creates TestRun record with `status = QUEUED`
- API creates TestRunConfig record with scope and URLs (if applicable)

**2. Worker Processes Test**:
- Worker polls for QUEUED runs
- Atomically claims run (updates to RUNNING)
- Executes providers based on test type and scope:
  - Site Audit CUSTOM_URLS: Lighthouse + Linkinator + Custom Rules
  - Site Audit SITEMAP: SE Ranking (v1.2)
  - Performance: PageSpeed API
  - Screenshots: Playwright
  - Spelling: Playwright + LanguageTool
- Saves results to UrlResult, Issue, ScreenshotSet tables
- Calculates score (for Site Audit / Performance)
- Updates TestRun to SUCCESS/FAILED/PARTIAL
- Sends email notification

**3. User Views Results**:
- UI fetches TestRun with related data
- Displays score, issues, screenshots
- Computes Release Readiness on-demand

### Handling External API Failures

External APIs are treated as independent providers within a test run.

**Retry Policy**:
- Transient errors (network errors, 5xx responses): Retry limited times with backoff
- Hard errors (4xx auth issues, invalid input, exhausted quotas): Fail immediately with clear error reason

**TestRun Status Semantics**:
- All providers succeed → `status = SUCCESS`
- Some providers succeed, some fail → `status = PARTIAL`
- All providers fail → `status = FAILED`

**User-Facing Behavior**:
- UI displays per-provider status within test run (success, error, skipped)
- Raw error context captured for debugging but surfaced in simplified way

This approach avoids throwing away successful work and provides clear visibility into partial results.

---

## 3. Key Architectural Decisions

### Page Preflight vs Full Site Crawl (Site Audit)

**Decision**: Implement Page Preflight first (CUSTOM_URLS scope) using Lighthouse + Linkinator + Custom Rules, defer SE Ranking (SITEMAP scope) to V1.2.

**Rationale**:
- Page Preflight addresses primary use case: pre-deployment validation of specific pages
- Lighthouse SEO is free and provides comprehensive SEO checks
- Linkinator provides reliable link checking without external API dependencies
- Custom rules plugin system allows extensibility without code changes
- SE Ranking requires full sitemap crawl which is better suited for periodic site-wide audits

**Implementation**:
- Site Audit test type supports two modes via `TestRunConfig.scope`:
  - `CUSTOM_URLS`: Page Preflight mode (MVP) - Lighthouse + Linkinator + Custom Rules
  - `SITEMAP`: Full Site Crawl mode (V1.2) - SE Ranking API

### Test Execution Scope

Each test type has different URL selection capabilities:

| Test Type | Supported Scopes | Notes |
|-----------|------------------|-------|
| Site Audit | CUSTOM_URLS (MVP), SITEMAP (v1.2) | Page Preflight: max 50 URLs. Full Site Crawl: max 500 pages, same subdomain only |
| Performance | SINGLE_URL, CUSTOM_URLS, SITEMAP | Full Site mode limited to 20 URLs to avoid excessive API usage |
| Screenshots | CUSTOM_URLS | Fixed 4 viewports: Desktop Chrome/Safari 1440px, Tablet iOS 768px, Mobile iOS 375px |
| Spelling | CUSTOM_URLS | Playwright extracts text from rendered pages |

> See `functional-spec.md` for detailed per-test-type URL selection rules.

### Performance Data Source

**Decision**: PageSpeed Insights API is the source of truth for Core Web Vitals.

**Rationale**:
- SE Ranking's "Speed & Performance" checks (future) will NOT be disabled but PageSpeed data takes precedence
- Release Readiness uses PageSpeed scores only
- Lighthouse accessibility scores included as bonus data

### Performance Multi-URL Scoring

**MVP Decision**: Use **average performance score** across all tested URLs.

**Implementation**:
- Each URL tested for both mobile and desktop viewports
- Display per-URL breakdown in UI with visual warning if ANY page scores <50
- Average score used for Release Readiness calculation

### Site Audit Scoring

**Page Preflight (CUSTOM_URLS mode)**:
- Start with 100 points
- Deduct points based on issue severity:
  - CRITICAL: -10 points each
  - HIGH: -5 points each
  - MEDIUM: -2 points each
  - LOW: -1 point each
- Normalize by URL count (more URLs = proportionally more tolerance)
- Clamp to 0-100 range
- Example: 1 URL with 1 CRITICAL + 2 HIGH = 100 - 10 - 10 = 80

**Full Site Crawl (SITEMAP mode - v1.2)**:
- Use SE Ranking's health score directly (0-100)

### Score-to-Color Mapping

**Decision**: Hardcoded configuration in code, not database table.

**Rationale**: MVP simplicity, database table only needed if custom thresholds per client required (v1.5+).

**Implementation**: See section 4 for code.

### Release Readiness Computation

**Decision**: Release Readiness is **computed at runtime, never stored**.

**Rationale**:
- Always reflects latest test data
- No risk of stale cached values
- Simpler implementation

**Implementation**: Query latest TestRun per type + ManualTestStatus on-demand when UI needs it.

### Data Retention Strategy

**Decision**: Keep current + previous run per test type per project.

**Rationale**:
- Supports visual diffs (compare current vs previous screenshots)
- Keeps database size manageable
- Provides enough history for trend analysis

**Implementation**:
- Test history: Two most recent TestRun rows per (projectId, type)
- Screenshots: Current + previous ScreenshotSet rows only
- Raw API payloads: Two most recent per type keep rawPayload populated
- Worker enforces retention after each test completion
- Delete older TestRuns and all related UrlResult, Issue, ScreenshotSet rows

---

## 4. Implementation Patterns

### Score-to-Color Mapping

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

### Site Audit Scoring Algorithm

```typescript
// worker/lib/scoring.ts
function calculateSiteAuditScore(issues: Issue[], urlCount: number): number {
  let score = 100;

  // Deduct points by severity
  for (const issue of issues) {
    switch (issue.severity) {
      case 'CRITICAL': score -= 10; break;
      case 'HIGH': score -= 5; break;
      case 'MEDIUM': score -= 2; break;
      case 'LOW': score -= 1; break;
    }
  }

  // Normalize by URL count (more URLs = more tolerance)
  const normalizationFactor = Math.max(1, urlCount / 5);
  score = score + (100 - score) * (1 - 1 / normalizationFactor) * 0.5;

  return Math.max(0, Math.min(100, Math.round(score)));
}
```

**Examples**:
- 1 URL, 0 issues → Score: 100
- 1 URL, 1 CRITICAL → Score: 90
- 1 URL, 2 HIGH + 3 MEDIUM → Score: 84
- 10 URLs, 20 MEDIUM + 30 LOW → Score: 60

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

**Alternative for v1.2+**: Consider Supabase Realtime or queue system (BullMQ).

### Atomic Job Claiming

```typescript
// worker/jobs/claim.ts
async function claimNextQueuedRun() {
  return prisma.$transaction(async (tx) => {
    const run = await tx.testRun.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
    });

    if (!run) return null;

    return tx.testRun.update({
      where: { id: run.id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        lastHeartbeat: new Date(),
      },
    });
  });
}
```

This pattern ensures only one worker can claim a given job (proper job locking).

### External API Retry Strategy

```typescript
// worker/lib/retry.ts
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
- **Lighthouse (PageSpeed SEO)**: Retry 5x on 5xx (PageSpeed API can be flaky), 2-second initial delay
- **Linkinator**: Retry 2x on network errors only, fail immediately on 404/500 (these are the issues we're detecting)
- **Custom Rules**: No retries (rules should be fast and deterministic)
- **PageSpeed Performance**: Retry 5x on 5xx, 2-second initial delay (same as Lighthouse)
- **SE Ranking** (v1.2): Retry 3x on 500/503, fail immediately on 401/403
- **LanguageTool**: Retry 3x on 5xx
- **Playwright/LambdaTest**: Retry 2x on network errors

**Rate limit handling**: If rate-limited mid-test, mark TestRun as PARTIAL and log which provider failed.

### Stuck TestRun Cleanup

```typescript
// worker/jobs/cleanup.ts
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

### Screenshot Storage Cleanup

```typescript
// worker/jobs/cleanup.ts
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

### Issue Aggregation

**Approach**: Simple grouping by issue code with provider attribution.

Store issues as-is in `Issue` table (one row per URL per issue). API endpoint provides aggregated view:

```typescript
// API: /api/test-runs/{runId}/issues/summary
{
  issueGroups: [
    {
      code: "LIGHTHOUSE_NO_TITLE",
      provider: "LIGHTHOUSE",
      severity: "HIGH",
      affectedUrlCount: 3,
      affectedUrls: ["url1", "url2", "url3"],  // First 10 for preview
      summary: "Page is missing a title tag"
    },
    {
      code: "LINK_BROKEN_INTERNAL",
      provider: "LINKINATOR",
      severity: "HIGH",
      affectedUrlCount: 5,
      affectedUrls: ["url1", "url2", ...],
      summary: "Broken internal link (404 error)"
    },
    {
      code: "MISSING_OG_IMAGE",
      provider: "CUSTOM_RULE",
      severity: "MEDIUM",
      affectedUrlCount: 2,
      affectedUrls: ["url1", "url2"],
      summary: "Missing Open Graph image tag"
    }
  ],
  totalIssues: 47,
  criticalCount: 2,
  highCount: 18,
  mediumCount: 22,
  lowCount: 5
}
```

**UI Display**:
- Group by severity, then by provider
- Show issue count badges by severity
- Expandable sections per provider
- Example: "Missing title tag (3 pages) [LIGHTHOUSE]"

**Future Enhancement (V1.2 with SE Ranking)**:
- Add `externalReportUrl` field for deep links to SE Ranking reports

### Fixed Viewport Matrix

```typescript
// lib/screenshots.ts
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

### Release Readiness Computation

```typescript
// lib/release-readiness.ts
import { prisma } from '@/lib/prisma';
import { TestType, TestStatus, ManualTestType } from '@prisma/client';

export async function getReleaseReadiness(projectId: string) {
  // Get latest completed run per test type
  const runs = await prisma.testRun.groupBy({
    by: ['type'],
    where: {
      projectId,
      status: { in: [TestStatus.SUCCESS, TestStatus.FAILED, TestStatus.PARTIAL] },
    },
    _max: { createdAt: true },
  });

  const latestRuns = await prisma.testRun.findMany({
    where: {
      projectId,
      OR: runs.map((r) => ({
        type: r.type,
        createdAt: r._max.createdAt!,
      })),
    },
    include: {
      urlResults: true,
      issues: true,
    },
  });

  // Get manual test statuses
  const manualStatuses = await prisma.manualTestStatus.findMany({
    where: {
      projectId,
      testType: { in: [ManualTestType.SCREENSHOTS, ManualTestType.SPELLING] },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Map to readiness model (numeric scores + manual labels + colors)
  return buildReadinessObject(latestRuns, manualStatuses);
}
```

Key rule: Never persist Release Readiness; recompute whenever UI needs it or test completes.

### Basic API Route Examples

**Projects CRUD**:

```typescript
// app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const body = await request.json();
  const project = await prisma.project.create({
    data: {
      name: body.name,
      siteUrl: body.siteUrl,
      sitemapUrl: body.sitemapUrl || null,
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ project });
}
```

**Enqueue Test Run**:

```typescript
// app/api/projects/[projectId]/test-runs/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TestType, TestStatus } from '@prisma/client';

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const body = await request.json();
  const { type } = body as { type: TestType };

  const run = await prisma.testRun.create({
    data: {
      projectId: params.projectId,
      type,
      status: TestStatus.QUEUED,
    },
  });

  return NextResponse.json({ run });
}
```

---

## 5. Data Model Philosophy

### Core Principles

- **UUID primary keys**: All entities use UUID `id` fields with `gen_random_uuid()` defaults
- **Timestamps**: Every table includes `createdAt` and `updatedAt` fields
- **Foreign keys**: Reference the `id` field of related entities with proper indexing
- **ISO-8601 datetimes**: All date/time fields stored in this format
- **Soft deletes where appropriate**: `Project` has `deletedAt` field for soft delete

### Core Entities

See `prisma/schema.prisma` for complete schema. Key entities:

- **Company** - Future multi-tenant support (placeholder only, not exposed in MVP)
- **Project** - Sites being tested (name, siteUrl, sitemapUrl, notes)
- **User** - Links to Supabase Auth via `supabaseUserId`, stores role metadata
- **TestRun** - Test execution records with lifecycle states, score (0-100), lastHeartbeat for stuck run detection
- **TestRunConfig** - Stores URL selection for each test run (scope: CUSTOM_URLS, SITEMAP, or SINGLE_URL)
- **UrlResult** - Per-URL metrics (Core Web Vitals, scores, issue counts, viewport)
- **Issue** - Normalized issues from all test providers
- **ScreenshotSet** - Screenshot metadata and storage keys
- **ManualTestStatus** - User-entered pass/fail/review statuses (no history in MVP)

### Schema Management

- **Single source of truth**: `prisma/schema.prisma` defines entire data model
- **Shared by app and worker**: Both use same Prisma Client and database
- **Migration workflow**: Use `prisma migrate dev` in development, `prisma migrate deploy` in production
- **Cascading deletes**: `ON DELETE CASCADE` on all child tables (UrlResult, Issue, ScreenshotSet) when parent TestRun is deleted

> For complete Prisma schema, see `installation.md` Phase 1.2 or `prisma/schema.prisma`.

---

## 6. Deployment Strategy

### Next.js Application (Vercel)

**Setup**:
- Set environment variables in Vercel dashboard:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - Email provider keys (if applicable)

**Build Process**:
- `npx prisma generate` runs automatically via `@prisma/client`
- Next.js builds app for production

**Deploy Process**:
- Run `npx prisma migrate deploy` as CI step or post-deploy step targeting Supabase DB
- Vercel deploys built app

### Worker Service

**Deployment Platform Options**:
- Railway
- Fly.io
- Render
- Any container hosting platform

**Setup**:
- Set same `DATABASE_URL` and Supabase/API keys
- Additional keys:
  - `PAGE_SPEED_API_KEY`
  - `SE_RANKING_API_KEY` (v1.2)
  - `LANGUAGETOOL_API_KEY`
  - Email provider keys

**CI Flow**:
1. Run `npx prisma generate`
2. Run `npx prisma migrate deploy` (once per environment) **before** starting worker
3. Build TypeScript: `npm run build`
4. Start worker process: `npm start`

**Worker Process**:
- Simple loop with backoff:
  - Claim job → process → sleep → repeat
- Runs continuously as background service
- Automatically restarts on crash (via platform)

**Scaling**:
- MVP: Single worker instance sufficient
- Future: Multiple workers supported via atomic job locking
- Horizontal scaling: Add more worker instances as needed

---

## 7. Deferred Features

### Not in MVP

1. **SE Ranking Full Site Crawl (SITEMAP scope)** — Deferred to v1.2 (Page Preflight with CUSTOM_URLS scope is MVP)
2. **Email notification preferences** — All admins get all notifications (v1.5)
3. **ManualTestStatus history** — Only current status stored (v1.5)
4. **Visual diff baselines** — Schema supports `BASELINE` role but no UI/workflow (v1.2)
5. **Scheduled/webhook test triggers** — Manual only (v2.x)
6. **Authentication for password-protected sites** — Public URLs only (v2.x)
7. **JavaScript rendering for Custom Rules** — Static HTML only in MVP (v2.x)
8. **Company entity exposure** — Placeholder only, no UI (v2.x)
9. **Utilities (Bulk Performance, HTML Cleaner, Bullshit Tester)** — Separate spec needed

### Future Roadmap

**v1.2**:
- SE Ranking Full Site Crawl (SITEMAP scope)
- Visual diff baseline selection mechanism
- Advanced link validation (mixed content, anchor fragments)

**v1.5**:
- Email notification preferences per user
- ManualTestStatus history tracking
- Custom score thresholds per client (move to database)

**v2.x**:
- Scheduled tests and webhook triggers
- Authentication for password-protected sites
- JavaScript rendering for Custom Rules (Playwright-based)
- Multi-tenant company/project access control
- Marketing/analytics checks
- Accessibility scans (WCAG baseline)

---

## 8. Critical Implementation Notes

### Page Preflight (CUSTOM_URLS mode)

1. **URL Limit**: Maximum 50 URLs per run in MVP to balance usability with execution time and API quotas
2. **PageSpeed API rate limits**: Free tier provides 25,000 requests/day and 400 requests/minute. Worker must throttle and handle rate limit errors gracefully (mark as PARTIAL)
3. **Custom Rules are fail-safe**: Individual rule failures must not crash the test. Wrap each rule in try-catch and log errors
4. **Linkinator link checking**: Internal links fail immediately on 404/500 (these are issues to detect), but retry 2x on network errors only

### Performance Tests

5. **Full Site mode**: Limited to 20 URLs to avoid excessive PageSpeed API usage and long execution times
6. **Field data (CrUX) fallback**: If CrUX data is unavailable for a URL, use lab metrics only. Add UI note: "Field data unavailable (not enough real-user traffic)"

### Site Audit Full Site Crawl (v1.2)

7. **Sitemap crawl**: Will NOT jump to different subdomains (security/scope control)

### Other

8. **Spelling text extraction**: Needs refinement during implementation to filter navigation/boilerplate
9. **Foreign key cascades**: All child tables (UrlResult, Issue, ScreenshotSet) have `ON DELETE CASCADE` when parent TestRun is deleted
10. **TestRun deletion triggers retention cleanup**: When new test completes, immediately prune old TestRuns and related data
11. **Release Readiness is always computed**, never stored. Query latest TestRun per type + ManualTestStatus on-demand

---

## Architectural Decisions Record

All key architectural questions have been resolved:

| # | Question | Resolution |
|---|----------|------------|
| 1 | Site Audit provider selection | ✅ Page Preflight (CUSTOM_URLS): Lighthouse + Linkinator + Custom Rules (MVP). SE Ranking (SITEMAP): v1.2 |
| 2 | Page Preflight architecture | ✅ Extend SITE_AUDIT with scope-based modes, not new test type |
| 3 | Custom rules extensibility | ✅ File-based plugin system (worker/rules/) with RuleContext interface |
| 4 | Link checker scope | ✅ Internal + external + resources (defer external/resources if complex) |
| 5 | PageSpeed API category | ✅ Use SEO category for Page Preflight, Performance category for Performance test |
| 6 | Site Audit scoring | ✅ Page Preflight: Start at 100, deduct by severity, normalize by URL count. Full Site Crawl: SE Ranking health score (v1.2) |
| 7 | Performance data overlap | ✅ PageSpeed is source of truth |
| 8 | Test scope (single URL vs sitemap) | ✅ Defined per test type via TestRunConfig.scope |
| 9 | Score-to-color mapping | ✅ Hardcoded thresholds in code |
| 10 | Screenshot manual status | ✅ Clarified TestRun.status = operational, ManualTestStatus = QA decision |
| 11 | Spelling test execution | ✅ Playwright extracts text, LanguageTool API processes |
| 12 | Performance multi-URL scoring | ✅ Average score (MVP) |
| 13 | UrlResult schema | ✅ Enhanced with viewport, issueCount fields |
| 14 | Issue aggregation | ✅ Simple grouping by code + provider attribution |
| 15 | Screenshot viewports | ✅ Fixed 4-viewport matrix |
| 16 | Retention enforcement | ✅ Added heartbeat + separate cleanup job |
| 17 | Utilities | ✅ Marked as out-of-scope for MVP |
| 18 | Email notifications | ✅ All admins, deferred preferences to v1.5 |
| 19 | Test triggers | ✅ Manual only in MVP |
| 20 | Company entity | ✅ Placeholder only, no UI |
| 21 | ManualTestStatus history | ✅ Deferred to v1.5 |
| 22 | Worker polling | ✅ 10-60s exponential backoff |
| 23 | API rate limits | ✅ Retry strategy defined per provider |
| 24 | Worker scaling | ✅ Atomic locking supports multiple workers |
| 25 | Storage cleanup | ✅ Two-phase delete (storage first, then DB) |
| 26 | Performance field data | ✅ Lab only, UI note if CrUX unavailable |
| 27 | Screenshot auth | ✅ Not supported in MVP |
| 28 | Spelling text extraction | ✅ Playwright-based, filter TBD during implementation |

---

## Next Steps

1. ✅ **Documentation complete** - All architectural decisions documented
2. **Schema migration** (Priority 1):
   - Add LIGHTHOUSE, LINKINATOR, CUSTOM_RULE to IssueProvider enum
   - Run migration: `npx prisma migrate dev --name add_page_preflight_providers`
3. **Begin Page Preflight implementation** following the plan in `mvp-implementation-plan.md`:
   - Week 1: Worker foundation (job claiming, heartbeat, retry logic)
   - Week 2: PageSpeed Lighthouse SEO integration
   - Week 3: Linkinator integration
   - Week 4: Custom rules plugin system
   - Week 5: UI updates and polish
4. **Create provider integration specs** (separate documents per provider as implementation progresses)

---

## Related Documentation

- **Setup Instructions**: See `installation.md`
- **Functional Requirements**: See `functional-spec.md`
- **Implementation Plan**: See `mvp-implementation-plan.md`
- **Prisma Schema**: See `prisma/schema.prisma`
