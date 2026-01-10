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

### 2. No Test Coverage
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

### 3. Heavy `any` Type Usage
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

### 4. No Rate Limiting
**Location**: All API routes
**Category**: Security
**Issue**: No rate limiting middleware. Authenticated users can spam API requests.
**Impact**: DoS potential, database exhaustion, worker queue flooding, cost overruns on external APIs.
**Recommendation**: Use `@upstash/ratelimit` or Vercel's rate limiting.
**Status**: Deferred
- Internal tool with ~10 trusted users - abuse risk is low
- Revisit if opening to external users or if abuse occurs

---

## MEDIUM PRIORITY ISSUES

### 5. No Pagination on List Endpoints
**Location**: `app/api/projects/route.ts`, `app/api/release-runs/route.ts`, `app/api/test-runs/route.ts`
**Category**: Performance
**Issue**: `findMany` without limits. Will fetch all records as database grows.
**Recommendation**: Add pagination with default limits (e.g., 50 per page).
**Status**: Deferred
- Projects: Users typically have 5-20 projects - pagination unnecessary
- Release Runs: At 1-2 releases/week, ~100/year - won't hit performance issues for 1-2 years
- Query performance remains acceptable up to ~500 records (~500KB payload, <500ms)
- Revisit when usage data indicates >200 release runs per project

### 6. Inconsistent Error Handling
**Location**: Multiple files
**Category**: Code Quality
**Issue**: Mixed patterns - some routes check ZodError, some check Prisma P2025, some don't. No standardized error response format.
**Recommendation**: Create `lib/errors.ts` with `handleApiError()` utility.
**Status**: Open

### 7. No Error Monitoring
**Location**: N/A (Missing)
**Category**: Code Quality
**Issue**: Sentry mentioned in CLAUDE.md but not implemented. No visibility into production errors.
**Recommendation**: Implement Sentry for both app and worker.
**Status**: Open

### 8. Console.log Statements Throughout
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

### 9. No Static Generation
**Location**: All pages
**Category**: Performance
**Issue**: All pages dynamically rendered. No `generateStaticParams` or ISR used.
**Recommendation**: Use ISR for project pages and completed test results.
**Status**: Open

---

## LOWER PRIORITY ISSUES

### 10. Large Component Files
**Location**: `TestResultsSummary.tsx` (530 lines), `TestResultDetail.tsx` (370 lines)
**Category**: Code Quality
**Issue**: Components too large with multiple responsibilities.
**Recommendation**: Break into smaller, focused components.
**Status**: Open

### 11. Missing PropTypes/Interface Documentation
**Location**: Most components
**Category**: Code Quality
**Issue**: Component interfaces lack JSDoc comments.
**Recommendation**: Add JSDoc comments for complex props.
**Status**: Open

### 12. Missing Next.js Image Optimization
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

### 13. No Bundle Analysis
**Location**: N/A (Missing)
**Category**: Performance
**Issue**: No visibility into bundle size or duplicate dependencies.
**Recommendation**: Add `@next/bundle-analyzer` for production builds.
**Status**: Open

### 14. Database Connection Pooling
**Location**: `lib/prisma.ts`
**Category**: Performance
**Issue**: No explicit connection pool configuration for serverless.
**Recommendation**: Add `?connection_limit=10&pool_timeout=20` to DATABASE_URL or use Supabase PgBouncer.
**Status**: Deferred (revisit if connection issues occur)

### 15. Missing Alt Text Strategy
**Location**: Screenshot storage
**Category**: Accessibility
**Issue**: No strategy for alt text on user-uploaded screenshots.
**Recommendation**: Implement when screenshot feature is built.
**Status**: Open

### 16. Convert to Monorepo Structure
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

### 17. Custom Rules Fetch Optimization
**Location**: `worker/providers/preflight/custom-rules.ts`
**Category**: Performance
**Issue**: Custom rules perform a separate HTTP fetch per URL to get raw HTML and headers, even though PageSpeed API already fetches the page. This adds one extra request per URL during preflight checks.
**Recommendation**: Investigate whether PageSpeed API response contains raw HTML that could be reused, or consider batching/caching the fetch if multiple providers need raw HTML.
**Status**: Open (future optimization)

---

## SECURITY CONSIDERATIONS

### Supabase RLS Verification
Verify Row-Level Security policies are enabled on all tables. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is exposed to client - without RLS, attackers could bypass API routes.

---

## PRIORITY REMEDIATION PLAN

### Phase 1 - Critical (Before Production)
1. Add resource-level authorization to API routes (#1) - Deferred for MVP
2. Add rate limiting (#4) - Deferred (internal tool, ~10 users)

### Phase 2 - High Priority
3. Replace `any` with proper types (#3)

### Phase 3 - Medium Priority
4. Set up error monitoring (Sentry) (#7)
5. Implement basic test suite (#2)

### Phase 4 - Ongoing
6. Refactor large components (#10)
7. Add remaining optimizations

---

## METRICS

| Status | Count |
|--------|-------|
| Complete | 0 |
| Deferred | 4 |
| Partial | 1 |
| Open | 12 |
| **Total** | **17** |

---

**Next Review**: Before production deployment
