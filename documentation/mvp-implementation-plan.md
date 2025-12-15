# ReleasePass MVP: Implementation Plan & Documentation Needs

**Date**: December 8, 2024
**Status**: Ready for Implementation

This document outlines the recommended order of operations for implementing the ReleasePass MVP and identifies additional documentation that should be created during implementation.

---

## 📚 Additional Documentation Needed

### 1. Provider Integration Guides (High Priority)

Each test provider needs a detailed integration specification:

#### `Documentation/providers/se-ranking-integration.md`
- API authentication and rate limits
- Request/response formats for Website Audit API
- Mapping SE Ranking issue codes to our `Issue` table schema
- Handling pagination for large site crawls
- Error handling and retry strategies
- Example request/response payloads

#### `Documentation/providers/pagespeed-integration.md`
- API key setup and quotas (free vs paid tiers)
- Request format for mobile vs desktop testing
- Parsing Core Web Vitals from response
- Handling missing CrUX (field) data gracefully
- Lab-only fallback strategy
- Rate limit handling (burst allowances)
- Example payloads

#### `Documentation/providers/playwright-integration.md`
- Fixed viewport configuration matrix
- Browser launch options (Chrome, WebKit)
- Screenshot capture strategies (full-page vs above-fold)
- Handling timeouts and failed page loads
- Storage upload flow to Supabase Storage
- Naming convention for storage keys

#### `Documentation/providers/languagetool-integration.md`
- API authentication
- Text extraction strategy from rendered HTML (via Playwright)
- Batching large text blocks
- Filtering navigation/boilerplate content
- Mapping LanguageTool issues to our `Issue` schema
- Example API payloads

---

### 2. API Endpoint Specifications (Medium Priority)

#### `Documentation/api-endpoints.md`

Document all Next.js API routes:

**Projects**
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get project details
- `PATCH /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project

**Test Runs**
- `POST /api/projects/[id]/test-runs` - Enqueue new test run (with TestRunConfig)
- `GET /api/projects/[id]/test-runs` - List test runs for project
- `GET /api/test-runs/[id]` - Get test run details (with urlResults, issues, screenshots)
- `GET /api/test-runs/[id]/status` - Get test run status (for polling)

**Manual Test Status**
- `POST /api/projects/[id]/manual-status` - Update manual test status (Screenshots/Spelling)
- `GET /api/projects/[id]/manual-status` - Get current manual statuses

**Release Readiness**
- `GET /api/projects/[id]/release-readiness` - Compute and return release readiness

**Issues**
- `GET /api/test-runs/[id]/issues` - Get issues for test run
- `GET /api/test-runs/[id]/issues/summary` - Get aggregated issue summary

**Users**
- `GET /api/users` - List all users (admin only)
- `POST /api/users` - Create user
- `GET /api/auth/sync-user` - Upsert user from Supabase Auth session

---

### 3. Scoring & Color Mapping (Medium Priority)

#### `Documentation/scoring-rules.md`

- Score-to-color threshold definitions
- Performance multi-URL averaging strategy
- Release Readiness computation algorithm
- Example calculations with test data

---

### 4. Worker Implementation Guide (High Priority)

#### `Documentation/worker-implementation.md`

- Worker loop structure (polling + backoff)
- Job claiming transaction pattern
- Provider orchestration flow
- Heartbeat update strategy
- Retention enforcement logic
- Error handling and partial success
- Email notification triggers
- Stuck run cleanup job

---

### 5. Email Notification Templates (Low Priority)

#### `Documentation/email-notifications.md`

- Test completion email template (HTML + plain text)
- Subject line format
- Content structure (test summary, link to results, issue count)
- Styling guidelines (inline CSS)
- Recipient configuration (all admins in MVP)

---

### 6. Development Workflow (Low Priority)

#### `Documentation/development-workflow.md`

- Git branching strategy
- PR review process
- Local development setup (running app + worker simultaneously)
- Debugging tips (Prisma Studio, logs)
- Testing strategy (unit tests for core logic, integration tests for API routes)

---

## 🚀 Implementation Plan: Recommended Order

### **Phase 1: Foundation (Week 1-2)**

#### Step 1.1: Project Initialization
- [ ] Create Next.js project (`npx create-next-app`)
- [ ] Install dependencies (Prisma, Supabase client, Tailwind)
- [ ] Set up Supabase project (database, auth, storage)
- [ ] Configure environment variables (`.env.local`, `.gitignore`)

#### Step 1.2: Database & Prisma Setup
- [ ] Copy Prisma schema from `Documentation/platform-technical-setup.md`
- [ ] Run `npx prisma init` and configure `DATABASE_URL`
- [ ] Run `npx prisma migrate dev --name init_core_schema`
- [ ] Create `lib/prisma.ts` singleton helper
- [ ] Verify schema in Prisma Studio

#### Step 1.3: Authentication Setup
- [ ] Configure Supabase Auth (email + password)
- [ ] Create `lib/supabase.ts` client helpers (client-side + server-side)
- [ ] Implement login page (`app/login/page.tsx`)
- [ ] Create auth sync API route (`app/api/auth/sync-user/route.ts`)
- [ ] Add auth middleware for protected routes
- [ ] Test login flow end-to-end

---

### **Phase 2: Dashboard UI Framework (Week 2)**

#### Overview
Establish the foundational dashboard UI structure, layout components, navigation system, and reusable components based on the Figma design. This phase creates the visual framework that all subsequent features will build upon.

#### URL Structure
```
/dashboard                      → Dashboard home (template ready, redirects to /dashboard/qa/audit for now)
/dashboard/qa/audit             → Site Audit (default QA Tools page)
/dashboard/qa/performance       → Performance Tests
/dashboard/qa/browser           → Browser Test/Screenshots
/dashboard/qa/spelling          → Spellcheck
/dashboard/projects             → Projects list
/dashboard/projects/new         → Add New Project
/dashboard/settings             → Settings placeholder
/dashboard/utilities/[tool]     → Future utilities (not MVP)
```

**Project Context**: Query parameter pattern for QA Tools pages
```
/dashboard/qa/audit?project=[projectId]
```

#### Key Components to Build
- **Layout System**
  - `DashboardLayout` component (header + footer + main content area)
  - Header with logo, top-level nav (QA Tools, Projects, Utilities), Settings, Logout
  - Footer with copyright
  - Breadcrumb component (route-based with project name support)

- **Navigation**
  - Top-level nav with active state detection (route-based)
  - Second-level tabs for QA Tools (Site Audit, Performance, Browser Test, Spellcheck)
  - Active tab styling with yellow underline

- **Reusable UI Components**
  - `Button` (primary, secondary variants)
  - `Input`, `Select`, `Textarea` form controls
  - `Tabs` component for QA Tools workspace
  - `Card` / `Panel` components for content sections

- **Styling Foundation**
  - Import fonts from `temp/global.css` (Forma DJR Display, Gibson)
  - Color palette: Brand Yellow (#FCC61D), Brand Cyan (#01A1AD), Dark Gray (#383439), etc.
  - Basic responsive breakpoints (mobile, tablet, desktop)
  - Tailwind CSS configuration

#### Deliverables
- [ ] Shared layout component with header, footer, navigation
- [ ] Dashboard home page template (currently redirects)
- [ ] URL structure implemented with Next.js App Router
- [ ] Breadcrumb system with project name support
- [ ] Core reusable components (Button, Input, Select, Textarea, Tabs, Card)
- [ ] Responsive design with basic breakpoints
- [ ] Settings placeholder page

#### Notes
- Breadcrumb format: `QA Tools / [Project Name]` (project name from query param)
- Release Readiness component is **out of scope** for this phase
- Focus on structure and reusability over pixel-perfect design

---

### **Phase 3: Core Data Layer (Week 2-3)**

#### Step 3.1: Project Management API
- [ ] `POST /api/projects` - Create project
- [ ] `GET /api/projects` - List projects
- [ ] `GET /api/projects/[id]` - Get project details
- [ ] `PATCH /api/projects/[id]` - Update project
- [ ] `DELETE /api/projects/[id]` - Delete project

#### Step 3.2: Project Management UI
- [ ] Create project list page (`app/projects/page.tsx`)
- [ ] Create new project form (`app/projects/new/page.tsx`)
- [ ] Create project detail page (`app/projects/[id]/page.tsx`)
- [ ] Add project selector component (for QA Tools workspace)

#### Step 3.3: Test Run API (Basic)
- [ ] `POST /api/projects/[id]/test-runs` - Enqueue test with TestRunConfig
- [ ] `GET /api/projects/[id]/test-runs` - List test runs
- [ ] `GET /api/test-runs/[id]` - Get test run details
- [ ] `GET /api/test-runs/[id]/status` - Get status (for polling)

---

### **Phase 4: Vercel Deployment (Optional - Week 3)**

Deploy the Next.js application to Vercel early to validate production setup before building complex features.

#### Step 4.1: Git Setup
- [ ] Initialize git repository
- [ ] Create GitHub repository
- [ ] Push code to GitHub

#### Step 4.2: Vercel Deployment
- [ ] Connect GitHub repository to Vercel
- [ ] Configure environment variables in Vercel dashboard
- [ ] Deploy application
- [ ] Verify deployment works

#### Step 4.3: Production Setup
- [ ] Update Supabase redirect URLs for production domain
- [ ] Run migrations in production (`npx prisma migrate deploy`)
- [ ] Test authentication flow in production
- [ ] Verify database connectivity

#### Deliverables
- [ ] Application deployed to Vercel with production URL
- [ ] Environment variables configured
- [ ] Database migrations applied to production
- [ ] Authentication working in production

**See**: `documentation/installation.md` Phase 4 for detailed step-by-step instructions.

---

### **Phase 5: Worker Platform Setup (Optional - Week 3)**

Set up worker hosting platform (Railway or Fly.io) to validate deployment before implementing complex provider logic.

#### Step 5.1: Platform Selection
- [ ] Choose platform: Railway (recommended) or Fly.io
- [ ] Create account and connect GitHub

#### Step 5.2: Minimal Worker Deployment
- [ ] Create basic worker with heartbeat only
- [ ] Configure environment variables on platform
- [ ] Deploy worker to platform
- [ ] Verify worker starts and logs appear

#### Step 5.3: Database Connectivity Test
- [ ] Add Prisma client to minimal worker
- [ ] Test database connection from worker
- [ ] Verify worker can query database

#### Deliverables
- [ ] Worker deployed to production platform
- [ ] Worker logs visible in platform dashboard
- [ ] Database connectivity verified from worker
- [ ] Platform ready for provider implementations

**See**: `documentation/installation.md` Phase 5 for detailed step-by-step instructions with Railway and Fly.io options.

---

### **Phase 6: Worker Service & Page Preflight (Week 3-4)**

#### Step 6.1: Worker Project Setup
- [ ] Create `worker` directory (not `qa-worker`)
- [ ] Initialize npm project
- [ ] Install dependencies:
  - Core: Prisma, TypeScript, @supabase/supabase-js, dotenv
  - Page Preflight: linkinator, zod
  - Future: axios (for SE Ranking, LanguageTool)
- [ ] Copy/link Prisma schema
- [ ] Configure environment variables in worker `.env`:
  - `DATABASE_URL`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `PAGE_SPEED_API_KEY` (Google API key - free tier: 25k requests/day)
- [ ] Set up TypeScript config
- [ ] Create worker directory structure:
  ```
  worker/
  ├── lib/ (prisma, retry, scoring, heartbeat)
  ├── jobs/ (claim, executor, cleanup)
  ├── providers/ (pagespeed, linkinator, custom-rules, se-ranking, languagetool)
  └── rules/ (custom rule plugins)
  ```

#### Step 6.2: Worker Core Loop
- [ ] Implement job claiming with atomic transaction
- [ ] Implement polling loop with exponential backoff (10s-60s)
- [ ] Add heartbeat update mechanism (every 30s)
- [ ] Create provider orchestration skeleton
- [ ] Add error handling and logging (Winston or Pino)
- [ ] Implement retry utility with exponential backoff

#### Step 6.3: Stuck Run Cleanup Job
- [ ] Implement separate cleanup cron job (runs every 5 minutes)
- [ ] Detect runs in RUNNING state with stale heartbeat (>60 minutes)
- [ ] Mark as FAILED with timeout error message

**Note**: Schema migration for Page Preflight was completed in Phase 3.5 (see `documentation/installation.md`).

**See**: `documentation/installation.md` Phase 6.1 for detailed worker infrastructure setup instructions.

---

### **Phase 7: Provider Integrations (Week 4-6)**

**Priority Order: Page Preflight first (MVP), then other providers**

#### Step 7.1: PageSpeed Lighthouse SEO Integration (Page Preflight - Priority 1)
- [ ] Write `Documentation/providers/pagespeed-lighthouse-seo.md`
- [ ] Create `worker/providers/pagespeed/client.ts`
  - Call PageSpeed Insights API v5 with `category=seo`
  - Parse `lighthouseResult.audits` object
  - Retry on 5xx errors (PageSpeed can be flaky)
  - Implement rate limiting (max 400/min)
- [ ] Create `worker/providers/pagespeed/seo-mapper.ts`
  - Map Lighthouse SEO audits to Issue records
  - Severity assignment: CRITICAL (HTTP errors), HIGH (missing title), MEDIUM (meta description), LOW (alt text)
  - Audit IDs to map: `document-title`, `meta-description`, `http-status-code`, `is-crawlable`, `canonical`, `hreflang`, `structured-data`, `viewport`, `image-alt`, `link-text`
- [ ] Store issues in `Issue` table with provider='LIGHTHOUSE'
- [ ] Store per-URL issue counts in `UrlResult` table
- [ ] Test end-to-end with SITE_AUDIT + CUSTOM_URLS

#### Step 7.2: Linkinator Integration (Page Preflight - Priority 2)
- [ ] Write `Documentation/providers/linkinator-integration.md`
- [ ] Create `worker/providers/linkinator/checker.ts`
  - Use linkinator library to check links on page
  - Configuration: concurrency=10, timeout=10s (internal) / 5s (external)
  - Check internal links (404/500), external links (404/410), resources (404)
  - Detect redirect chains (3+ redirects)
  - Skip patterns: `mailto:*`, `tel:*`, `javascript:*`
- [ ] Create `worker/providers/linkinator/mapper.ts`
  - Map link states to Issue records
  - Issue codes: LINK_BROKEN_INTERNAL (HIGH), LINK_BROKEN_EXTERNAL (MEDIUM), LINK_REDIRECT_CHAIN (LOW), LINK_TIMEOUT (MEDIUM)
- [ ] Store issues in `Issue` table with provider='LINKINATOR'
- [ ] Test with various link scenarios (working, broken, redirects)

#### Step 7.3: Custom Rules Plugin System (Page Preflight - Priority 3)
- [ ] Write `Documentation/providers/custom-rules.md`
- [ ] Create `worker/providers/custom-rules/types.ts`
  - Define RuleContext interface (url, html, headers, statusCode)
  - Define RuleResult interface (code, summary, severity, meta)
  - Define CustomRule type signature
- [ ] Create `worker/providers/custom-rules/loader.ts`
  - Scan `worker/rules/` directory for `.ts`/`.js` files
  - Import each file (must export default function)
  - Ignore files starting with `_` or `README`
  - Handle loading errors gracefully
- [ ] Create `worker/providers/custom-rules/executor.ts`
  - Fetch page HTML via simple HTTP GET
  - Execute all rules in parallel
  - Wrap each rule in try-catch
  - Convert RuleResult[] to Issue[] with provider='CUSTOM_RULE'
- [ ] Create `worker/rules/meta-tags.ts` (example rule)
  - Check for Open Graph tags (og:title, og:image)
  - Check for Twitter Card tags
  - Validate title length (max 60 chars)
- [ ] Create `worker/rules/README.md` (documentation for rule authors)
- [ ] Test with example rule

#### Step 7.4: Page Preflight Integration in Executor
- [ ] Update `worker/jobs/executor.ts`
  - Add executeSiteAuditCustomUrls() function
  - Run 3 providers in parallel: PageSpeed Lighthouse SEO, linkinator, custom rules
  - Use Promise.allSettled() to handle partial success
  - Aggregate all issues from providers
  - Calculate score using scoring algorithm (100 base - penalties by severity)
  - Determine status: SUCCESS (all 3 succeed), PARTIAL (1-2 succeed), FAILED (all fail)
- [ ] Create `worker/lib/scoring.ts`
  - Implement calculateSiteAuditScore() function
  - Deductions: CRITICAL (-10), HIGH (-5), MEDIUM (-2), LOW (-1)
  - Normalize by URL count
- [ ] Test complete Page Preflight flow end-to-end

#### Step 7.5: PageSpeed Performance Integration (Existing - Priority 4)
- [ ] Write `Documentation/providers/pagespeed-performance.md`
- [ ] Create `worker/providers/pagespeed/performance.ts` (reuse client from 5.1)
- [ ] Implement mobile + desktop testing for performance category
- [ ] Parse Core Web Vitals and scores
- [ ] Store results in `UrlResult` table (2 rows per URL: mobile + desktop)
- [ ] Calculate average score and store in `TestRun.score`
- [ ] Test end-to-end (enqueue → worker processes → view results)

#### Step 7.6: SE Ranking Integration (Future - Full Site Crawl)
- [ ] Write `Documentation/providers/se-ranking-integration.md`
- [ ] Create `worker/providers/se-ranking.ts`
- [ ] Implement sitemap crawling (max 500 pages)
- [ ] Parse issues and store in `Issue` table
- [ ] Store per-URL issue counts in `UrlResult`
- [ ] Store health score in `TestRun.score`
- [ ] Implement issue aggregation API (`GET /api/test-runs/[id]/issues/summary`)
- [ ] Note: SE Ranking used for SITE_AUDIT + SITEMAP scope (not CUSTOM_URLS)

#### Step 7.7: Playwright Screenshots Integration
- [ ] Write `Documentation/providers/playwright-integration.md`
- [ ] Create `worker/providers/playwright-screenshots.ts`
- [ ] Implement 4-viewport capture (Desktop Chrome/Safari, Tablet, Mobile)
- [ ] Upload to Supabase Storage (`qa-screenshots` bucket)
- [ ] Store metadata in `ScreenshotSet` table
- [ ] Generate signed URLs for UI display
- [ ] Implement screenshot viewer UI component

#### Step 7.8: LanguageTool Integration
- [ ] Write `Documentation/providers/languagetool-integration.md`
- [ ] Create `worker/providers/languagetool.ts`
- [ ] Use Playwright to render page and extract text
- [ ] Filter out navigation/boilerplate (heuristic-based)
- [ ] Batch large text blocks for API
- [ ] Parse issues and store in `Issue` table
- [ ] Test with various page types

---

### **Phase 8: UI Development (Week 6-8)**

#### Step 8.1: Release Readiness Component
- [ ] Create `lib/scoring.ts` with threshold constants
- [ ] Implement `getReleaseReadiness()` function
- [ ] Create Release Readiness display component (top-right of UI)
- [ ] Show per-test color indicators
- [ ] Add tooltips with score details

#### Step 8.2: QA Tools Workspace
- [ ] Create tabbed interface (Site Audit, Performance, Screenshots, Spelling)
- [ ] Add project selector to left panel
- [ ] Implement "Start Test" button with URL input (for Performance/Screenshots/Spelling)
- [ ] Add test history preview in right panel
- [ ] Implement real-time status polling (for RUNNING tests)

#### Step 8.3: Test Results Pages
- [ ] **Site Audit Results**: Issue list with filtering, links to SE Ranking report
- [ ] **Performance Results**: Per-URL table with mobile/desktop scores, Core Web Vitals chart
- [ ] **Screenshots Results**: Grid view with viewport labels, manual status controls
- [ ] **Spelling Results**: Issue list with context snippets, manual status controls

#### Step 8.4: Manual Test Status
- [ ] Implement `POST /api/projects/[id]/manual-status`
- [ ] Add PASS/REVIEW/FAIL buttons to Screenshots/Spelling result pages
- [ ] Update Release Readiness in real-time after status change

---

### **Phase 9: Polish & Retention (Week 8-9)**

#### Step 9.1: Data Retention Implementation
- [ ] Implement retention logic in worker (prune old TestRuns)
- [ ] Cascade delete related UrlResult, Issue, ScreenshotSet records
- [ ] Delete old screenshots from Supabase Storage
- [ ] Test retention with multiple test runs

#### Step 9.2: Email Notifications
- [ ] Choose email provider (Resend, SendGrid, AWS SES)
- [ ] Write `Documentation/email-notifications.md`
- [ ] Create email templates (HTML + plain text)
- [ ] Implement notification trigger in worker (on test completion)
- [ ] Test with all statuses (SUCCESS, PARTIAL, FAILED)

#### Step 9.3: Error Handling & Monitoring
- [ ] Set up Sentry (free tier) for app and worker
- [ ] Add comprehensive error logging
- [ ] Implement API retry logic for all providers (exponential backoff + jitter)
- [ ] Add health check endpoints for app and worker

---

### **Phase 10: Testing & Deployment (Week 9-10)**

#### Step 10.1: Testing
- [ ] Write unit tests for scoring logic (`lib/scoring.test.ts`)
- [ ] Write integration tests for API routes
- [ ] Test worker with all 4 test types end-to-end
- [ ] Test retention enforcement
- [ ] Test stuck run cleanup
- [ ] Test with various project types (small sites, large sites, broken sites)

#### Step 10.2: Deployment
- [ ] Deploy Next.js app to Vercel
- [ ] Configure production environment variables
- [ ] Run `npx prisma migrate deploy` on production database
- [ ] Deploy worker to Railway / Fly.io / Render
- [ ] Verify all API keys and access in production
- [ ] Test production deployment with real sites

#### Step 10.3: Documentation Finalization
- [ ] Review and update all documentation
- [ ] Add screenshots to functional spec
- [ ] Create troubleshooting guide
- [ ] Document known limitations and MVP scope boundaries

---

## 📦 Deliverables Checklist

### Code
- [ ] Next.js application (deployed to Vercel)
- [ ] Worker service (deployed to Railway/Fly.io/Render)
- [ ] Prisma schema and migrations
- [ ] API routes (projects, test runs, manual status, release readiness)
- [ ] UI components (project management, QA tools workspace, test results)
- [ ] Provider integrations (SE Ranking, PageSpeed, Playwright, LanguageTool)

### Documentation
- [ ] `Documentation/functional-spec.md` (updated)
- [ ] `Documentation/technical-stack.md`
- [ ] `Documentation/platform-technical-setup.md` (updated with enhanced schema)
- [ ] `Documentation/architecture-recommendations.md`
- [ ] `Documentation/providers/*.md` (4 provider integration guides)
- [ ] `Documentation/api-endpoints.md`
- [ ] `Documentation/scoring-rules.md`
- [ ] `Documentation/worker-implementation.md`
- [ ] `Documentation/email-notifications.md`
- [ ] `CLAUDE.md` (updated)
- [ ] `README.md` (project overview for GitHub)

### Infrastructure
- [ ] Supabase project (database, auth, storage)
- [ ] Vercel deployment
- [ ] Worker deployment
- [ ] Sentry error tracking
- [ ] Email provider setup

---

## 🎯 Success Criteria

### Functional
- [ ] Users can create projects with siteUrl and optional sitemapUrl
- [ ] Users can trigger all 4 test types (Site Audit, Performance, Screenshots, Spelling)
- [ ] Worker processes tests atomically without race conditions
- [ ] Test results display correctly in UI
- [ ] Manual status updates work for Screenshots and Spelling
- [ ] Release Readiness computes and displays correctly
- [ ] Data retention enforces 2-run history per test type
- [ ] Email notifications sent on test completion

### Non-Functional
- [ ] All API routes respond in <2 seconds (excluding long-running test execution)
- [ ] Worker handles failures gracefully (retries, PARTIAL status)
- [ ] Stuck runs are detected and cleaned up within 5-10 minutes
- [ ] No memory leaks in worker (can run for days)
- [ ] Error tracking captures all exceptions (Sentry)
- [ ] Code is TypeScript strict (or near-strict)

---

## 🚨 Critical Path Items

These items MUST be completed in order:

1. **Database schema & migrations** - Foundation for everything
2. **Authentication** - Required before any protected routes
3. **Worker atomic job locking** - Required before provider integrations
4. **One complete provider integration** - Validates entire test flow end-to-end
5. **Release Readiness computation** - Core UX feature

Everything else can be done in parallel or iteratively.

---

## 📝 Notes

- **Prioritize one complete vertical slice**: Instead of building all APIs then all UI, complete one test type end-to-end (e.g., PageSpeed) to validate the full flow early.
- **Provider integrations are independent**: These can be assigned to different developers or completed sequentially.
- **UI polish can happen in parallel**: While provider integrations are being built, UI components can be stubbed with mock data.
- **Documentation should be written DURING implementation**, not after. Each provider integration should produce its integration guide.

---

## ⏱️ Timeline Estimate

- **Phase 1 (Foundation)**: 1-2 weeks
- **Phase 2 (Dashboard UI Framework)**: 1 week
- **Phase 3 (Core Data Layer)**: 1 week
- **Phase 4 (Worker Service)**: 1 week
- **Phase 5 (Provider Integrations)**: 2 weeks (all 4 providers)
- **Phase 6 (UI Development)**: 2 weeks
- **Phase 7 (Polish & Retention)**: 1 week
- **Phase 8 (Testing & Deployment)**: 1 week

**Total: 10-11 weeks** for a single full-time developer working alone.

With 2 developers working in parallel:
- Developer 1: Foundation → Dashboard UI Framework → Worker → Provider Integrations
- Developer 2: Core Data Layer → UI Development → Manual Status

**Total: 7-8 weeks** with parallelization.

---

## 🤝 Team Collaboration Points

If working with multiple developers, these are natural handoff points:

- **Dashboard UI Framework** (Phase 2) - Establish visual patterns and components before feature development
- **API contract definition** (Phase 3.1) - Must agree on request/response formats before UI work
- **Provider integration specs** (Phase 5) - Write spec first, then implement in worker
- **Scoring thresholds** (Phase 6.1) - Agree on Green/Yellow/Red values before UI implementation
- **Email template review** (Phase 7.2) - Stakeholder approval needed before implementation

---

## 📊 Progress Tracking

Use this checklist to track implementation progress. Update weekly.

**Current Phase**: Not Started
**Blockers**: None
**Next Milestone**: Phase 1.1 - Project Initialization