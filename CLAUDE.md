# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReleasePass is an automated pre- and post-deployment QA platform for modern websites. It combines SEO technical health, performance, visual QA, and grammar checks into one automated workflow, delivering clear pass/fail reports and prioritized fixes.

## Technical Stack

- **Frontend/API**: Next.js (App Router) with TypeScript, deployed on Vercel
- **Database**: Supabase (managed PostgreSQL)
- **ORM**: Prisma for schema management and database access
- **Authentication**: Supabase Auth (email + password)
- **Storage**: Supabase Storage for screenshots
- **Styling**: Tailwind CSS + PostCSS
- **Worker**: Separate Node.js + TypeScript background service for test orchestration

## Architecture

### Three-Tier Structure

1. **Next.js Application (Vercel)**
   - Admin UI for managing projects and viewing test results
   - API routes (`app/api/...`) for CRUD operations
   - Handles authentication via Supabase Auth
   - Uses Prisma Client for database access

2. **Background Worker Service**
   - Separate Node.js + TypeScript application
   - Connects to same Supabase PostgreSQL via Prisma
   - Atomically claims and processes test runs
   - Orchestrates external test providers (SE Ranking, PageSpeed, Playwright, LanguageTool)
   - Enforces data retention rules
   - Sends email notifications on test completion

3. **Supabase Backend**
   - PostgreSQL database for all application data
   - Auth service for user authentication
   - Storage bucket (`qa-screenshots`) for screenshot artifacts

### Data Model Philosophy

- **UUID primary keys**: All entities use UUID `id` fields with `gen_random_uuid()` defaults
- **Timestamps**: Every table includes `createdAt` and `updatedAt` fields
- **Foreign keys**: Reference the `id` field of related entities
- **ISO-8601 datetimes**: All date/time fields stored in this format

### Core Entities

See `Documentation/platform-technical-setup.md` section 3 for the complete Prisma schema, which includes:

- `Company` - Future multi-tenant support (not exposed in MVP)
- `Project` - Sites being tested (name, siteUrl, sitemapUrl, notes)
- `User` - Links to Supabase Auth, stores role metadata
- `TestRun` - Test execution records with lifecycle states, score (0-100), and lastHeartbeat for stuck run detection
- `TestRunConfig` - Stores URL selection for each test run (scope: CUSTOM_URLS, SITEMAP, or SINGLE_URL)
- `UrlResult` - Per-URL metrics (Core Web Vitals, scores, issue counts, viewport)
- `Issue` - Normalized issues from all test providers
- `ScreenshotSet` - Screenshot metadata and storage keys
- `ManualTestStatus` - User-entered pass/fail/review statuses (no history in MVP)

### Test Lifecycle

Tests follow this state machine:
```
QUEUED → RUNNING → (SUCCESS | FAILED | PARTIAL)
```

- **QUEUED**: Test created, waiting for worker
- **RUNNING**: Worker has claimed and is executing
- **SUCCESS**: All providers succeeded
- **FAILED**: All providers failed
- **PARTIAL**: Some providers succeeded, some failed

**IMPORTANT**: `TestRun.status` represents **operational execution status** (whether the worker completed processing), NOT quality assessment. Quality is determined by:
- Site Audit & Performance: `TestRun.score` field (0-100) + configured thresholds
- Screenshots & Spelling: `ManualTestStatus.statusLabel` (PASS/REVIEW/FAIL)

### Test Execution Scope

Each test type has different URL selection capabilities:

- **Site Audit**: Full sitemap crawl (max 500 pages, same subdomain only)
- **Performance**: User-selectable (custom URL list OR sitemap with 20-URL limit in MVP)
- **Screenshots**: Custom URL list only (4 fixed viewports: Desktop Chrome/Safari 1440px, Tablet iOS Safari 768px, Mobile iOS Safari 375px)
- **Spelling**: Custom URL list only (Playwright extracts text from rendered pages)

### Data Retention Rules

The worker enforces these retention policies:

- **Test history**: Keep current + previous run per test type per project
- **Screenshots**: Current + previous only
- **Raw API payloads**: Two most recent per test type
- Older data is pruned after new test completion

### Release Readiness

Release Readiness is **computed at runtime, not stored**. For each project, it's derived from:

1. Latest completed `TestRun` per `TestType`
2. `ManualTestStatus` entries for manual review tests

Each test contributes either:
- A numeric score (Site Audit, Performance)
- A manual status label (Screenshots, Spelling: PASS / REVIEW / FAIL)

Color mapping: Green (passing), Yellow (moderate concern), Red (failing), Grey (needs review)

## Development Commands

### Initial Setup

```bash
# Install dependencies
npm install

# Set up Prisma (first time)
npx prisma init

# Generate Prisma Client
npx prisma generate

# Run initial migration
npx prisma migrate dev --name init_core_schema
```

### Development

```bash
# Start Next.js dev server
npm run dev

# Run database migrations
npx prisma migrate dev

# View database in Prisma Studio
npx prisma studio

# Generate Prisma Client (after schema changes)
npx prisma generate
```

### Production Deployment

```bash
# Deploy migrations (CI/CD)
npx prisma migrate deploy

# Build Next.js app
npm run build
```

## Environment Variables

### Next.js App (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgres://...
EMAIL_PROVIDER_API_KEY=...
EMAIL_FROM=qa-bot@example.com
```

### Worker Service (`.env`)

```bash
DATABASE_URL=postgres://...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_URL=...
PAGE_SPEED_API_KEY=...
SE_RANKING_API_KEY=...
LANGUAGETOOL_API_KEY=...
LAMBDA_TEST_API_KEY=...
EMAIL_PROVIDER_API_KEY=...
EMAIL_FROM=qa-bot@example.com
```

## QA Test Providers

### Site Audit
- **Provider**: SE Ranking Website Audit API
- **Scope**: 105 checks across security, crawling, redirects, sitemap, meta tags, content, localization, performance, JavaScript, CSS, links, mobile optimization
- **Documentation**: https://seranking.com/api/data/website-audit/

### Performance
- **Provider**: Google PageSpeed Insights API v5
- **Scope**: Core Web Vitals (LCP, CLS, INP), lab metrics, field data (CrUX), Lighthouse accessibility
- **Documentation**: https://developers.google.com/speed/docs/insights/v5/about

### Screenshots
- **Provider**: Playwright + optional LambdaTest
- **Scope**: Multi-device/viewport captures, full-page and above-the-fold options
- **Storage**: Supabase Storage bucket

### Spelling/Grammar
- **Provider**: LanguageTool API
- **Scope**: Spelling and contextual grammar issues in rendered text
- **Documentation**: https://languagetool.org/http-api/

## Worker Atomic Job Locking

The worker must atomically claim jobs to prevent race conditions:

```typescript
// Simplified pattern
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
      },
    });
  });
}
```

## Authentication Flow

1. User logs in via Supabase Auth (email + password)
2. On successful session, upsert a `User` record linking `supabaseUserId` to Supabase Auth
3. MVP: All authenticated users are admins with full access
4. Passwords are managed by Supabase Auth, never stored in the `User` table

## Key Implementation Notes

- **Prisma Client singleton**: Use `lib/prisma.ts` helper to avoid multiple instances in dev
- **Shared schema**: Worker and app use the same Prisma schema file
- **TypeScript strictness**: Relaxed initially for MVP, with project-wide TypeScript usage
- **No stored readiness**: Release Readiness is always computed on-demand
- **Partial success handling**: Tests can complete with mixed provider results
- **Error tracking**: Use Sentry (free plan) for both app and worker errors
- **Email notifications**: Sent by worker on test completion (SUCCESS/PARTIAL/FAILED)

## Roadmap Context

- **MVP**: Core platform with 4 test types, basic UI, authentication, single admin bucket
- **V1.2**: Visual diffs for regression detection (LambdaTest SmartUI or Resemble.js)
- **Later**: Marketing/analytics checks, accessibility scans (WCAG baseline)

## Design Reference

Figma: https://www.figma.com/design/YMiFr3zrjXxKxdh1olKpwo/4all--internal-?node-id=4646-106&t=VkE5uL05QSDQcSzB-1

## Critical Documentation

- `Documentation/functional-spec.md` - Complete functional requirements and data schema
- `Documentation/technical-stack.md` - Technology choices and architecture decisions
- `Documentation/platform-technical-setup.md` - Step-by-step Supabase + Prisma setup guide
- `Documentation/architecture-recommendations.md` - Schema enhancements, scoring rules, worker patterns, and resolved architectural decisions