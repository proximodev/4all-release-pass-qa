# Code Review: Issues and Improvements

This document outlines security, performance, and code quality improvements for the ReleasePass QA Platform codebase. Items are ranked by severity within each category.

**Last Audit**: January 2, 2026

---

## CRITICAL ISSUES

### 1. Missing Resource-Level Authorization
**Location**: `app/api/projects/[id]/route.ts`, `app/api/release-runs/[id]/route.ts`, `app/api/test-runs/[id]/route.ts`
**Category**: Security
**Issue**: API routes verify user authentication but do NOT verify the user has permission to access the specific resource. Any authenticated user can access/modify/delete ANY resource by knowing the UUID.
**Impact**: Horizontal privilege escalation, data leakage across tenant boundaries.
**Recommendation**:
```typescript
// Add ownership validation
const project = await prisma.project.findUnique({
  where: { id, deletedAt: null },
})
if (!project) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
// When multi-tenant: verify project.companyId === user.companyId
```
**Status**: Deferred (MVP - all authenticated users share access; TODO comments added for future multi-tenant)

### 2. URL Validation Allows SSRF Attacks
**Location**: `lib/validation/releaseRun.ts:13-14`, `lib/validation/testRun.ts:9`
**Category**: Security
**Issue**: URL validation uses only Zod's `.url()` which doesn't block `file://`, `javascript:`, internal IPs, or cloud metadata endpoints (169.254.x.x).
**Impact**: Worker could be tricked into scanning internal services or leaking cloud credentials.
**Recommendation**:
```typescript
const urlSchema = z.string().url().refine((url) => {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) return false
  if (['localhost', '127.0.0.1'].some(h => parsed.hostname.includes(h))) return false
  if (parsed.hostname.startsWith('169.254.')) return false
  return true
}, 'Only public HTTP/HTTPS URLs allowed')
```
**Status**: Complete (lib/validation/url.ts created with safeUrlSchema)

### 3. N+1 Query in Release Run Details
**Location**: `app/api/release-runs/[id]/route.ts:23-52`
**Category**: Performance
**Issue**: Deeply nested includes fetch ReleaseRun → TestRuns → UrlResults → ResultItems. For 10 URLs × 4 tests, this fetches 500+ rows in one query.
**Impact**: Slow API responses, database connection exhaustion under load.
**Recommendation**:
- Add `take` limits on nested includes
- Paginate urlResults and resultItems
- Consider two-step fetch: summary first, details on demand
**Status**: Complete
- Split into summary endpoint (no resultItems) + detail endpoint
- Created `/api/release-runs/[id]/url-results/[urlResultId]` for fetching single URL's results
- Updated TestResultDetail.tsx to fetch resultItems on demand
- Added `preflightScore` field to UrlResult; worker calculates and stores score
- Summary page displays stored scores for both PAGE_PREFLIGHT and PERFORMANCE

### 4. No Test Coverage
**Location**: N/A (Missing)
**Category**: Code Quality
**Issue**: Zero test files in codebase. No unit, integration, or E2E tests.
**Impact**: High regression risk, unsafe refactoring, no confidence in deployments.
**Recommendation**:
- Set up Vitest + React Testing Library
- Start with critical paths: scoring logic, API routes, form validation
- Add Playwright for E2E tests
**Status**: Open

---

## HIGH PRIORITY ISSUES

### 5. Repeated Authentication in Every Route
**Location**: All API routes in `app/api/**`
**Category**: Code Quality
**Issue**: Every route independently calls `supabase.auth.getUser()`, duplicating 5 lines of auth code per handler.
**Recommendation**: Create shared auth helper to reduce duplication.
**Status**: Complete
- Created `lib/auth.ts` with `requireAuth()` helper
- Updated routes to use: `const { user, error } = await requireAuth(); if (error) return error`
- Reduces auth boilerplate from 5 lines to 2 lines per handler
- Note: Does not reduce latency (still one auth call per request); middleware approach deferred

### 6. Heavy `any` Type Usage
**Location**: 17 files, especially API route error handlers
**Category**: Code Quality
**Issue**: All API routes use `catch (error: any)` bypassing TypeScript safety.
**Recommendation**:
```typescript
catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  // ...
}
```
**Status**: Open

### 8. Missing Composite Database Indexes
**Location**: `prisma/schema.prisma`
**Category**: Performance
**Issue**: Common query patterns missing optimized indexes.
**Status**: Complete
- Added `@@index([releaseRunId, type])` to TestRun
- Added `@@index([releaseRunId, status])` to TestRun
- Added `@@index([urlResultId, status])` to ResultItem

### 9. No API Response Caching
**Location**: All GET endpoints
**Category**: Performance
**Issue**: No cache headers set. Every request hits database even for unchanging data.
**Status**: Complete (selective)
- Added `Cache-Control: private, max-age=60, stale-while-revalidate=300` to:
  - `/api/projects` (list)
  - `/api/projects/[id]` (detail)
- Added `Cache-Control: private, max-age=300, stale-while-revalidate=600` to:
  - `/api/release-runs/[id]/url-results/[urlResultId]` (immutable result data)
- Skipped release-runs endpoints to avoid stale polling data during test execution

### 10. No Rate Limiting
**Location**: All API routes
**Category**: Security
**Issue**: No rate limiting middleware. Authenticated users can spam API requests.
**Impact**: DoS potential, database exhaustion, worker queue flooding, cost overruns on external APIs.
**Recommendation**: Use `@upstash/ratelimit` or Vercel's rate limiting.
**Status**: Deferred
- Internal tool with ~10 trusted users - abuse risk is low
- Revisit if opening to external users or if abuse occurs

### 11. rawPayload Fetched Unnecessarily
**Location**: `prisma/schema.prisma:183`
**Category**: Performance
**Issue**: `TestRun.rawPayload` stores 50-200KB JSON blobs (full PageSpeed responses) and is always fetched in queries.
**Recommendation**: Exclude from default queries using `select`, only fetch when needed for debug views.
**Status**: Complete (excluded from /api/release-runs/[id] summary endpoint via select)

---

## MEDIUM PRIORITY ISSUES

### 12. Duplicate Authentication Code
**Location**: All 12+ API route files
**Category**: Code Quality
**Issue**: Every route duplicates the same 5-line auth pattern.
**Recommendation**: Create `lib/middleware/auth.ts` with `requireAuth()` helper.
**Status**: Complete
- Created `lib/auth.ts` with `requireAuth()` helper (see #5)
- Migrated all API routes to use the helper (12 handlers across 8 files)

### 13. Duplicate Type Definitions
**Location**: `TestResultsSummary.tsx`, `TestResultDetail.tsx`, `TestSelector.tsx`
**Category**: Code Quality
**Issue**: Interfaces for `ResultItem`, `UrlResultData`, `TestRunData`, `ReleaseRun` duplicated across components. Recent changes (adding `viewport` field) required updating both files.
**Recommendation**: Create `lib/types/releasepass.ts` with shared type definitions.
**Status**: Complete
- Created `lib/types/releasepass.ts` with shared types: `ProjectSummary`, `ResultItem`, `UrlResultData`, `TestRunData`, `TestRunSummary`, `ReleaseRun`, `ReleaseRunSummary`
- Updated `TestResultsSummary.tsx` to import from shared types
- Updated `TestResultDetail.tsx` to import from shared types
- Updated `TestSelector.tsx` to import from shared types

### 14. Duplicate Scoring Configuration
**Location**: `lib/config/scoring.ts`, `worker/lib/scoring.ts`
**Category**: Code Quality
**Issue**: Identical scoring logic maintained separately in app and worker. Changes must be synced manually.
**Status**: Complete
- Created `shared/scoring-config.json` as single source of truth for passThreshold and severityPenalties
- Updated `lib/config/scoring.ts` to import from shared config
- Updated `worker/lib/scoring.ts` to import from shared config
- Added clear comments explaining the shared config pattern
- See #34 for future monorepo conversion

### 15. Business Logic in Components
**Location**: `TestResultDetail.tsx:117-183`
**Category**: Code Quality
**Issue**: 70+ lines of scoring/calculation logic in useMemo. Hard to test, can't reuse.
**Recommendation**: Extract to `lib/services/scoring.ts` as pure functions.
**Status**: Complete
- Created `lib/services/testResults.ts` with pure functions:
  - `countResultItems()` - count pass/fail/total
  - `getPerformanceScores()` - find mobile/desktop scores
  - `calculateUrlScore()` - compute score by test type
  - `getTestStatus()` - determine pass/fail status
  - `getPreflightAdditionalInfo()` - get link count info
  - `calculateUrlResultSummary()` - orchestrates all above
- Updated `TestResultDetail.tsx` useMemo from 70+ lines to ~25 lines
- Logic now reusable and testable

### 16. No Pagination on List Endpoints
**Location**: `app/api/projects/route.ts`, `app/api/release-runs/route.ts`, `app/api/test-runs/route.ts`
**Category**: Performance
**Issue**: `findMany` without limits. Will fetch all records as database grows.
**Recommendation**: Add pagination with default limits (e.g., 50 per page).
**Status**: Deferred
- Projects: Users typically have 5-20 projects - pagination unnecessary
- Release Runs: At 1-2 releases/week, ~100/year - won't hit performance issues for 1-2 years
- Query performance remains acceptable up to ~500 records (~500KB payload, <500ms)
- Revisit when usage data indicates >200 release runs per project

### 17. Missing React.memo on Expensive Components
**Location**: `TestResultsSummary.tsx`, `TestResultDetail.tsx`
**Category**: Performance
**Issue**: Large components (400+ lines) re-render on every parent state change and polling interval.
**Recommendation**: Wrap with `React.memo`, add `useMemo`/`useCallback` for expensive operations.
**Status**: Complete
- Wrapped `TestResultsSummary` with `React.memo`
- Wrapped `TestResultDetail` with `React.memo`
- Added `useCallback` to all event handlers and data fetching functions in both components
- Existing `useMemo` usage preserved for computed data

### 18. Inconsistent Error Handling
**Location**: Multiple files
**Category**: Code Quality
**Issue**: Mixed patterns - some routes check ZodError, some check Prisma P2025, some don't. No standardized error response format.
**Recommendation**: Create `lib/errors.ts` with `handleApiError()` utility.
**Status**: Open

### 19. No Error Monitoring
**Location**: N/A (Missing)
**Category**: Code Quality
**Issue**: Sentry mentioned in CLAUDE.md but not implemented. No visibility into production errors.
**Recommendation**: Implement Sentry for both app and worker.
**Status**: Open

### 20. Console.log Statements Throughout
**Location**: 30+ instances across worker and components
**Category**: Code Quality
**Issue**: Extensive console logging may leak sensitive data. Not searchable or structured.
**Recommendation**: Use structured logging (pino/winston) with log levels.
**Status**: Partial
- Reviewed all console.log/error statements - no sensitive data exposed
- API routes already guard with `NODE_ENV === 'development'` check
- Worker logs only contain operational data (IDs, URLs, scores)
- Env var check only logs "Set" or "MISSING", not actual values
- Structured logging deferred to post-MVP

### 21. UUID Parameters Not Validated
**Location**: `app/api/release-runs/route.ts`, `app/api/test-runs/route.ts`
**Category**: Security
**Issue**: Query parameters like `projectId` used directly in Prisma queries without UUID format validation.
**Recommendation**: Validate with `z.string().uuid()` before use.
**Status**: Complete
- Created `lib/validation/common.ts` with `uuidSchema`, `validateUuid()`, `isValidUuid()` helpers
- Added UUID validation to `GET /api/release-runs` for `projectId` parameter
- Added UUID validation to `GET /api/test-runs` for `projectId` parameter
- Returns 400 error with "Invalid projectId format" for malformed UUIDs

### 22. Missing Request Timeouts on External APIs
**Location**: `worker/providers/seranking/client.ts`, `worker/providers/pagespeed/client.ts`
**Category**: Performance
**Issue**: Fetch requests don't have explicit timeouts. Worker could hang on unresponsive APIs.
**Recommendation**:
```typescript
const controller = new AbortController()
setTimeout(() => controller.abort(), 30000)
const response = await fetch(url, { signal: controller.signal })
```
**Status**: Complete
- Created `worker/lib/fetch.ts` with `fetchWithTimeout()` utility using AbortController
- Updated `worker/providers/pagespeed/client.ts` to use 60s timeout (PageSpeed runs Lighthouse)
- Updated `worker/providers/seranking/client.ts` to use 30s timeout on all API calls
- Linkinator already had built-in timeout support (30s default)

### 23. No Static Generation
**Location**: All pages
**Category**: Performance
**Issue**: All pages dynamically rendered. No `generateStaticParams` or ISR used.
**Recommendation**: Use ISR for project pages and completed test results.
**Status**: Open

---

## LOWER PRIORITY ISSUES

### 24. Large Component Files
**Location**: `TestResultsSummary.tsx` (530 lines), `TestResultDetail.tsx` (370 lines)
**Category**: Code Quality
**Issue**: Components too large with multiple responsibilities.
**Recommendation**: Break into smaller, focused components.
**Status**: Open

### 27. Missing PropTypes/Interface Documentation
**Location**: Most components
**Category**: Code Quality
**Issue**: Component interfaces lack JSDoc comments.
**Recommendation**: Add JSDoc comments for complex props.
**Status**: Open

### 29. Missing Next.js Image Optimization
**Location**: `next.config.ts`
**Category**: Performance
**Issue**: No image optimization settings configured.
**Recommendation**: Add images config alongside existing headers:
```typescript
images: {
  formats: ['image/avif', 'image/webp'],
  remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
},
```
**Status**: Open

### 30. No Bundle Analysis
**Location**: N/A (Missing)
**Category**: Performance
**Issue**: No visibility into bundle size or duplicate dependencies.
**Recommendation**: Add `@next/bundle-analyzer` for production builds.
**Status**: Open

### 31. Database Connection Pooling
**Location**: `lib/prisma.ts`
**Category**: Performance
**Issue**: No explicit connection pool configuration for serverless.
**Recommendation**: Add `?connection_limit=10&pool_timeout=20` to DATABASE_URL or use Supabase PgBouncer.
**Status**: Deferred (revisit if connection issues occur)

### 32. Inconsistent Path References
**Location**: Multiple files
**Category**: Code Quality
**Issue**: Some legacy `/dashboard/` paths may remain.
**Recommendation**: Audit and consolidate to `/releasepass/`.
**Status**: Complete
- Audited codebase: only `/dashboard/` reference is intentional redirect to `/releasepass/`
- Middleware matcher includes it for auth before redirect
- No actual legacy path issues found

### 33. Missing Alt Text Strategy
**Location**: Screenshot storage
**Category**: Accessibility
**Issue**: No strategy for alt text on user-uploaded screenshots.
**Recommendation**: Implement when screenshot feature is built.
**Status**: Open

### 34. Convert to Monorepo Structure
**Location**: Project root
**Category**: Code Quality
**Issue**: App and worker are separate codebases sharing some configuration via JSON imports. As shared code grows, this pattern becomes harder to maintain.
**Recommendation**: Convert to monorepo using pnpm workspaces or Turborepo:
- `packages/shared` - Shared types, config, utilities
- `apps/web` - Next.js application
- `apps/worker` - Background worker service
**Benefits**:
- Single dependency tree
- Shared TypeScript types with proper imports
- Unified build/test/lint commands
- Atomic commits across app and worker
**Status**: Open (future enhancement)

### 35. Performance Test Displaying Only One Viewport Score
**Location**: `components/releasepass/TestResultsSummary.tsx`, `components/releasepass/TestResultDetail.tsx`
**Category**: Bug Fix
**Issue**: Performance tests create two UrlResult records per URL (mobile and desktop), but UI was only displaying the first one found, showing only one viewport's score.
**Status**: Complete
- Updated `TestResultsSummary.tsx` to find both mobile and desktop results per URL and display both scores side-by-side
- Updated `TestResultDetail.tsx` URL selector to show unique URLs (no viewport duplication in dropdown)
- Updated `TestResultDetail.tsx` summary section to display "Mobile Score" and "Desktop Score" separately for Performance tests
- Pass/fail status now requires both mobile AND desktop to pass threshold
- Hidden "Passed X/Y checks" text for Performance tests (no ResultItems)
- Added `viewport` field to API response (`/api/release-runs/[id]`)

### 36. TypeScript Export Type Errors in Worker
**Location**: `worker/providers/linkinator/index.ts`, `worker/providers/pagespeed/index.ts`
**Category**: Code Quality
**Issue**: Re-exporting types without `export type` syntax when `isolatedModules` is enabled causes TypeScript errors.
**Status**: Complete
- Changed `export { Type }` to `export type { Type }` for type-only exports

---

## SECURITY CONSIDERATIONS

### Missing Security Headers
**Status**: Complete
- Added security headers to `next.config.ts`:
  - `X-DNS-Prefetch-Control: on` - faster DNS resolution
  - `Strict-Transport-Security` - enforce HTTPS for 2 years
  - `X-Frame-Options: SAMEORIGIN` - prevent clickjacking
  - `X-Content-Type-Options: nosniff` - prevent MIME sniffing
  - `Referrer-Policy: origin-when-cross-origin` - limit referrer leakage

### Supabase RLS Verification
Verify Row-Level Security policies are enabled on all tables. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is exposed to client - without RLS, attackers could bypass API routes.

---

## PRIORITY REMEDIATION PLAN

### Phase 1 - Critical (Before Production)
1. ~~Add resource-level authorization to API routes (#1)~~ - Deferred for MVP
2. ~~Implement URL validation for SSRF prevention (#2)~~ - Complete
3. ~~Add rate limiting (#10)~~ - Deferred (internal tool, ~10 users)
4. ~~Fix N+1 query with pagination (#3)~~ - Complete

### Phase 2 - High Priority
5. ~~Create auth helper (#5)~~ - Complete
6. ~~Add composite database indexes (#8)~~ - Complete
7. ~~Exclude rawPayload from default queries (#11)~~ - Complete
8. Replace `any` with proper types (#6)

### Phase 3 - Medium Priority
9. Set up error monitoring (Sentry) (#19)
10. ~~Create shared auth utilities (#12)~~ - Complete
11. ~~Create shared types (#13)~~ - Complete
12. ~~Add response caching (#9)~~ - Complete (selective)
13. ~~Add pagination to list endpoints (#16)~~ - Deferred
14. Implement basic test suite (#4)

### Phase 4 - Ongoing
15. ~~Extract business logic from components (#15)~~ - Complete
16. Refactor large components (#24)
17. Add remaining optimizations

---

## METRICS

| Status | Count |
|--------|-------|
| Complete | 16 |
| Deferred | 4 |
| Partial | 1 |
| Open | 11 |
| **Total** | **32** |

---

**Next Review**: Before production deployment
