# Code Review: Issues and Improvements

This document outlines security, performance, and code quality improvements for the ReleasePass QA Platform codebase. Items are ranked by severity within each category.

**Last Audit**: December 31, 2025

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
- Summary page now shows "View" badge for PAGE_PREFLIGHT (score shown in detail view)

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
**Category**: Performance
**Issue**: Every route independently calls `supabase.auth.getUser()`, creating a new client and making a network call each time (~50-100ms latency per request).
**Recommendation**: Move auth to middleware:
```typescript
// middleware.ts
if (request.nextUrl.pathname.startsWith('/api')) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
**Status**: Open

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

### 7. Excessive Client Components
**Location**: 19 of 25 components marked `'use client'`
**Category**: Performance
**Issue**: Components like `Breadcrumb.tsx`, `Header.tsx` could be server components. Increases JS bundle and slows TTI.
**Recommendation**:
- Convert static layout components to server components
- Split Header into server (structure) + client (interactive parts)
- Only use `'use client'` at interactivity boundaries
**Status**: Open

### 8. Missing Composite Database Indexes
**Location**: `prisma/schema.prisma`
**Category**: Performance
**Issue**: Common query patterns missing optimized indexes:
- `TestRun` queries by `releaseRunId + type`
- `ResultItem` queries by `urlResultId + status`
**Recommendation**:
```prisma
// In TestRun model
@@index([releaseRunId, type])
@@index([releaseRunId, status])

// In ResultItem model
@@index([urlResultId, status])
```
**Status**: Open

### 9. No API Response Caching
**Location**: All GET endpoints
**Category**: Performance
**Issue**: No cache headers set. Every request hits database even for unchanging data.
**Recommendation**:
```typescript
return NextResponse.json(data, {
  headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' }
})
```
**Status**: Open

### 10. No Rate Limiting
**Location**: All API routes
**Category**: Security
**Issue**: No rate limiting middleware. Authenticated users can spam API requests.
**Impact**: DoS potential, database exhaustion, worker queue flooding, cost overruns on external APIs.
**Recommendation**: Use `@upstash/ratelimit` or Vercel's rate limiting.
**Status**: Open

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
**Status**: Open

### 13. Duplicate Type Definitions
**Location**: `TestResultsSummary.tsx`, `TestResultDetail.tsx`
**Category**: Code Quality
**Issue**: Interfaces for `ResultItem`, `UrlResultData`, `TestRunData`, `ReleaseRun` duplicated across components.
**Recommendation**: Create `lib/types/` directory with shared type definitions.
**Status**: Open

### 14. Duplicate Scoring Configuration
**Location**: `lib/config/scoring.ts`, `worker/lib/scoring.ts`
**Category**: Code Quality
**Issue**: Identical scoring logic maintained separately in app and worker. Changes must be synced manually.
**Recommendation**: Extract to shared package or monorepo structure.
**Status**: Open

### 15. Business Logic in Components
**Location**: `TestResultDetail.tsx:117-183`
**Category**: Code Quality
**Issue**: 70+ lines of scoring/calculation logic in useMemo. Hard to test, can't reuse.
**Recommendation**: Extract to `lib/services/scoring.ts` as pure functions.
**Status**: Open

### 16. No Pagination on List Endpoints
**Location**: `app/api/projects/route.ts`, `app/api/release-runs/route.ts`, `app/api/test-runs/route.ts`
**Category**: Performance
**Issue**: `findMany` without limits. Will fetch all records as database grows.
**Recommendation**: Add pagination with default limits (e.g., 50 per page).
**Status**: Open

### 17. Missing React.memo on Expensive Components
**Location**: `TestResultsSummary.tsx`, `TestResultDetail.tsx`
**Category**: Performance
**Issue**: Large components (400+ lines) re-render on every parent state change and polling interval.
**Recommendation**: Wrap with `React.memo`, add `useMemo`/`useCallback` for expensive operations.
**Status**: Open

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
**Status**: Open

### 21. UUID Parameters Not Validated
**Location**: `app/api/release-runs/route.ts:85-91`
**Category**: Security
**Issue**: Query parameters like `projectId` used directly in Prisma queries without UUID format validation.
**Recommendation**: Validate with `z.string().uuid()` before use.
**Status**: Open

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
**Status**: Open

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

### 25. Missing useCallback for Event Handlers
**Location**: All selector and form components
**Category**: Performance
**Issue**: Event handlers recreated on every render, breaking memoization.
**Recommendation**: Wrap handlers with `useCallback`.
**Status**: Open

### 26. Duplicate Form Handling Logic
**Location**: `projects/new/page.tsx`, `projects/[id]/edit/page.tsx`
**Category**: Code Quality
**Issue**: Form data extraction and error handling patterns duplicated.
**Recommendation**: Create shared form utilities in `lib/utils/forms.ts`.
**Status**: Open

### 27. Missing PropTypes/Interface Documentation
**Location**: Most components
**Category**: Code Quality
**Issue**: Component interfaces lack JSDoc comments.
**Recommendation**: Add JSDoc comments for complex props.
**Status**: Open

### 28. No Client-Side Request Caching
**Location**: Multiple selector components
**Category**: Performance
**Issue**: Same data (projects) fetched independently by multiple components.
**Recommendation**: Implement SWR or React Query for client caching.
**Status**: Open

### 29. Missing Next.js Image Optimization
**Location**: `next.config.ts`
**Category**: Performance
**Issue**: Empty config, no image optimization settings.
**Recommendation**:
```typescript
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
}
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
**Status**: Partial

### 33. Missing Alt Text Strategy
**Location**: Screenshot storage
**Category**: Accessibility
**Issue**: No strategy for alt text on user-uploaded screenshots.
**Recommendation**: Implement when screenshot feature is built.
**Status**: Open

---

## SECURITY CONSIDERATIONS

### Missing Security Headers
Add to `next.config.ts`:
```typescript
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
    ],
  }]
}
```

### Supabase RLS Verification
Verify Row-Level Security policies are enabled on all tables. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is exposed to client - without RLS, attackers could bypass API routes.

---

## PRIORITY REMEDIATION PLAN

### Phase 1 - Critical (Before Production)
1. Add resource-level authorization to API routes (#1)
2. Implement URL validation for SSRF prevention (#2)
3. Add rate limiting (#10)
4. Fix N+1 query with pagination (#3)

### Phase 2 - High Priority (Week 1-2)
5. Move auth to middleware (#5)
6. Add composite database indexes (#8)
7. Exclude rawPayload from default queries (#11)
8. Replace `any` with proper types (#6)
9. Convert static components to server components (#7)

### Phase 3 - Medium Priority (Month 1)
10. Set up error monitoring (Sentry) (#19)
11. Create shared types and auth utilities (#12, #13)
12. Add response caching (#9)
13. Add pagination to list endpoints (#16)
14. Implement basic test suite (#4)

### Phase 4 - Ongoing
15. Extract business logic from components (#15)
16. Refactor large components (#24)
17. Implement React Query for data fetching (#28)
18. Add remaining optimizations

---

## METRICS

| Category | Critical | High | Medium | Lower |
|----------|----------|------|--------|-------|
| Security | 2 | 2 | 1 | 0 |
| Performance | 1 | 4 | 5 | 5 |
| Code Quality | 1 | 2 | 6 | 5 |
| **Total** | **4** | **8** | **12** | **10** |

**Total Open Issues**: 33

---

**Next Review**: Before production deployment
