# ReleasePass MVP: Implementation Plan & Documentation Needs

**Date**: December 20, 2025
**Status**: Ready for Implementation

This document outlines the recommended order of operations for implementing the ReleasePass MVP and identifies additional documentation that should be created during implementation.

> **Release Run Model**: This plan reflects the Release Run-centric architecture where tests are grouped into cohesive launch candidates. See `RELEASE-PASS-CHANGES.MD` for the full model specification.

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

#### `Documentation/providers/languagetool-integration.md` ✅ IMPLEMENTED
- API configuration: Self-hosted (LANGUAGETOOL_URL) or Cloud API (LANGUAGETOOL_API_KEY)
- Text extraction strategy from HTML (via Cheerio - no Playwright dependency)
- Filters navigation/boilerplate content (nav, header, footer, cookie notices)
- Maps LanguageTool issues to ResultItem records with severity levels
- Supports auto language detection
- See `worker/providers/languagetool/client.ts` and `worker/providers/spelling/index.ts`

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

**Release Runs** (Primary unit of release qualification)
- `POST /api/projects/[id]/release-runs` - Create new Release Run (with frozen URLs + selected tests)
- `GET /api/projects/[id]/release-runs` - List Release Runs for project
- `GET /api/release-runs/[id]` - Get Release Run details (with all TestRuns, issues, status)
- `GET /api/release-runs/[id]/status` - Get Release Run status (PENDING/READY/FAIL) for polling
- `DELETE /api/release-runs/[id]` - Delete Release Run and all child data

**Test Runs** (Within a Release Run)
- `POST /api/release-runs/[id]/test-runs` - Re-run a test within Release Run (creates new TestRun)
- `GET /api/release-runs/[id]/test-runs` - List test runs within Release Run
- `GET /api/test-runs/[id]` - Get test run details (with urlResults, issues, screenshots)
- `GET /api/test-runs/[id]/status` - Get TestRun execution status (for polling)

**Manual Test Status** (Scoped to Release Run)
- `POST /api/release-runs/[id]/manual-status` - Update manual test status (Screenshots/Spelling)
- `GET /api/release-runs/[id]/manual-status` - Get current manual statuses for Release Run

**Issues**
- `GET /api/test-runs/[id]/issues` - Get issues for test run
- `GET /api/test-runs/[id]/issues/summary` - Get aggregated issue summary by impact level

**Users**
- `GET /api/users` - List all users (admin only)
- `POST /api/users` - Create user
- `GET /api/auth/sync-user` - Upsert user from Supabase Auth session

**Site-Level Tests** (NOT part of Release Runs - v1.2)
- `POST /api/projects/[id]/site-audit` - Trigger site-level audit (SE Ranking Full Crawl)
- `GET /api/projects/[id]/site-audit` - Get latest site audit results

---

### 3. Scoring & Color Mapping (Medium Priority)

#### `Documentation/scoring-rules.md`

- Score-to-color threshold definitions
- Performance multi-URL averaging strategy
- Issue impact levels (BLOCKER, WARNING, INFO) and their effect on Release Run status
- Release Readiness computation algorithm (per Release Run, not across time)
- Release Run status determination (PENDING → READY or FAIL)
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
- [ ] Add project selector component (for Release Run creation)

#### Step 3.3: Release Run API
- [ ] `POST /api/projects/[id]/release-runs` - Create Release Run with frozen URLs + selected tests
- [ ] `GET /api/projects/[id]/release-runs` - List Release Runs for project
- [ ] `GET /api/release-runs/[id]` - Get Release Run details with all TestRuns
- [ ] `GET /api/release-runs/[id]/status` - Get Release Run status (PENDING/READY/FAIL)
- [ ] `DELETE /api/release-runs/[id]` - Delete Release Run and cascade to children

#### Step 3.4: Test Run API (Within Release Runs)
- [ ] `POST /api/release-runs/[id]/test-runs` - Re-run a test within Release Run
- [ ] `GET /api/release-runs/[id]/test-runs` - List test runs within Release Run
- [ ] `GET /api/test-runs/[id]` - Get test run details
- [ ] `GET /api/test-runs/[id]/status` - Get TestRun execution status (for polling)

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

> **Note**: The worker processes TestRuns within Release Runs. Page-level tests (Page Preflight, Performance, Screenshots, Spelling) belong to Release Runs. Site-level tests (Site Audit Full Crawl) run independently and are deferred to v1.2.

#### Step 6.1: Worker Project Setup
- [ ] Create `worker` directory (not `qa-worker`)
- [ ] Initialize npm project
- [ ] Install dependencies:
  - Core: Prisma, TypeScript, @supabase/supabase-js, dotenv
  - Page Preflight: linkinator, zod
  - Future: axios (for SE Ranking, LanguageTool)
- [ ] Copy/link Prisma schema (includes ReleaseRun model)
- [ ] Configure environment variables in worker `.env`:
  - `DATABASE_URL`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `PAGE_SPEED_API_KEY` (Google API key - free tier: 25k requests/day)
- [ ] Set up TypeScript config
- [ ] Create worker directory structure:
  ```
  worker/
  ├── lib/ (prisma, retry, scoring, heartbeat, release-run-status)
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
- [ ] Update Release Run status after TestRun completion (recompute PENDING/READY/FAIL)

#### Step 6.3: Release Run Status Computation
- [ ] Create `lib/release-run-status.ts` utility
- [ ] Implement status computation logic:
  - PENDING: Tests incomplete or manual reviews not PASS
  - READY: All tests complete, no BLOCKER issues, all manual reviews PASS
  - FAIL: BLOCKER issues present or manual review FAIL
- [ ] Update Release Run status after each TestRun completes
- [ ] Send email notification when Release Run reaches terminal state (READY or FAIL)

#### Step 6.4: Stuck Run Cleanup Job
- [ ] Implement separate cleanup cron job (runs every 5 minutes)
- [ ] Detect TestRuns in RUNNING state with stale heartbeat (>60 minutes)
- [ ] Mark as FAILED with timeout error message
- [ ] Recompute parent Release Run status

**Note**: Schema migration for Release Run model was completed in Phase 3.6 (see `documentation/installation.md`).

**See**: `documentation/installation.md` Phase 6.1 for detailed worker infrastructure setup instructions.

---

### **Phase 7: Provider Integrations (Week 4-6)**

**Priority Order**: Page-level tests first (part of Release Runs), then site-level tests (v1.2)

**Page-Level Tests** (Part of Release Runs):
1. Page Preflight (Lighthouse SEO + Linkinator + Custom Rules)
2. Performance (PageSpeed Core Web Vitals)
3. Screenshots (Playwright)
4. Spelling (Playwright + LanguageTool)

**Site-Level Tests** (NOT part of Release Runs - v1.2):
- Site Audit Full Crawl (SE Ranking)

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
  - **Impact assignment**: BLOCKER (is-crawlable, http-status-code failures), WARNING (missing title/meta), INFO (alt text)
  - Audit IDs to map: `document-title`, `meta-description`, `http-status-code`, `is-crawlable`, `canonical`, `hreflang`, `structured-data`, `viewport`, `image-alt`, `link-text`
- [ ] Store issues in `Issue` table with provider='LIGHTHOUSE' and impact level
- [ ] Store per-URL issue counts in `UrlResult` table
- [ ] Test end-to-end with PAGE_PREFLIGHT test type within a Release Run

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
  - **Impact assignment**: BLOCKER (broken internal links), WARNING (broken external), INFO (redirect chains)
- [ ] Store issues in `Issue` table with provider='LINKINATOR' and impact level
- [ ] Test with various link scenarios (working, broken, redirects)

#### Step 7.3: Custom Rules Plugin System (Page Preflight - Priority 3)
- [ ] Write `Documentation/providers/custom-rules.md`
- [ ] Create `worker/providers/custom-rules/types.ts`
  - Define RuleContext interface (url, html, headers, statusCode)
  - Define RuleResult interface (code, summary, severity, **impact**, meta)
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
  - Convert RuleResult[] to Issue[] with provider='CUSTOM_RULE' and impact level
- [ ] Create `worker/rules/meta-tags.ts` (example rule)
  - Check for Open Graph tags (og:title, og:image) - WARNING impact
  - Check for Twitter Card tags - INFO impact
  - Check for noindex when not intended - BLOCKER impact
  - Validate title length (max 60 chars) - WARNING impact
- [ ] Create `worker/rules/README.md` (documentation for rule authors)
- [ ] Test with example rule

#### Step 7.4: Page Preflight Integration in Executor
- [ ] Update `worker/jobs/executor.ts`
  - Add executePagePreflight() function
  - Run 3 providers in parallel: PageSpeed Lighthouse SEO, linkinator, custom rules
  - Use Promise.allSettled() to handle partial success
  - Aggregate all issues from providers with impact levels
  - Determine TestRun status: SUCCESS (all 3 succeed), PARTIAL (1-2 succeed), FAILED (all fail)
  - Update parent Release Run status after completion
- [ ] Create `worker/lib/scoring.ts`
  - Implement calculatePagePreflightScore() function (optional, score not primary metric)
  - Primary metric is issue impact levels, not numeric score
- [ ] Test complete Page Preflight flow end-to-end within a Release Run

#### Step 7.5: PageSpeed Performance Integration (Page-Level - Priority 4)
- [ ] Write `Documentation/providers/pagespeed-performance.md`
- [ ] Create `worker/providers/pagespeed/performance.ts` (reuse client from 7.1)
- [ ] Implement mobile + desktop testing for performance category
- [ ] Parse Core Web Vitals and scores
- [ ] Store results in `UrlResult` table (2 rows per URL: mobile + desktop)
- [ ] Calculate average score and store in `TestRun.score`
- [ ] Update parent Release Run status after completion
- [ ] Test end-to-end within a Release Run (create Release Run → worker processes → view results)

#### Step 7.6: SE Ranking Integration (Site-Level - v1.2)
> **Note**: This is a site-level test that runs independently of Release Runs. Deferred to v1.2.

- [ ] Write `Documentation/providers/se-ranking-integration.md`
- [ ] Create `worker/providers/se-ranking.ts`
- [ ] Implement sitemap crawling (max 500 pages)
- [ ] Parse issues and store in `Issue` table with impact levels
- [ ] Store per-URL issue counts in `UrlResult`
- [ ] Store health score in `TestRun.score`
- [ ] Implement issue aggregation API (`GET /api/test-runs/[id]/issues/summary`)
- [ ] Note: Site Audit Full Crawl is NOT part of Release Runs - runs at project level independently

#### Step 7.7: Playwright Screenshots Integration (Page-Level - Priority 5)
- [ ] Write `Documentation/providers/playwright-integration.md`
- [ ] Create `worker/providers/playwright-screenshots.ts`
- [ ] Implement 4-viewport capture (Desktop Chrome/Safari, Tablet, Mobile)
- [ ] Upload to Supabase Storage (`qa-screenshots` bucket)
- [ ] Store metadata in `ScreenshotSet` table
- [ ] Generate signed URLs for UI display
- [ ] Update parent Release Run status after completion (requires manual PASS to reach READY)
- [ ] Implement screenshot viewer UI component

#### Step 7.8: LanguageTool Integration (Page-Level - Priority 6) ✅ IMPLEMENTED
- [x] Create `worker/providers/languagetool/client.ts` - API client supporting self-hosted and cloud
- [x] Create `worker/providers/spelling/index.ts` - Spelling provider with text extraction
- [x] Text extraction via Cheerio (no Playwright dependency needed)
- [x] Filters navigation, header, footer, cookie notices, hidden elements
- [x] Creates ResultItems with severity mapping (misspelling=HIGH, grammar=CRITICAL, style=MEDIUM)
- [x] Integrated into `worker/jobs/process.ts`
- [ ] Update parent Release Run status after completion (requires manual PASS to reach READY)
- [ ] Test with various page types

**Configuration:**
```bash
# Self-hosted (recommended - unlimited requests)
LANGUAGETOOL_URL=http://languagetool:8010/v2

# OR Cloud API (paid tiers)
LANGUAGETOOL_API_KEY=your-api-key
```

**Self-hosted Docker:**
```bash
docker run -d -p 8010:8010 erikvl87/languagetool
```

---

### **Phase 8: UI Development (Week 6-8)**

> **Note**: The UI is organized around Release Runs as the primary navigation unit. Users create Release Runs, view their status, and drill into individual test results.

#### Step 8.1: Release Run List & Creation
- [ ] Create Release Run list page (`app/dashboard/release-runs/page.tsx`)
  - Show all Release Runs for selected project with status (PENDING/READY/FAIL)
  - Color coding: Green (READY), Red (FAIL), Grey (PENDING)
- [ ] Create "New Release Run" form
  - URL input (paste URLs, one per line)
  - Test selection checkboxes (Page Preflight, Performance, Screenshots, Spelling)
  - URLs are frozen on creation
- [ ] Implement Release Run status polling (for PENDING runs)

#### Step 8.2: Release Run Detail View
- [ ] Create Release Run detail page (`app/dashboard/release-runs/[id]/page.tsx`)
- [ ] Show Release Run status prominently (PENDING/READY/FAIL)
- [ ] Create tabbed interface for tests within Release Run (Page Preflight, Performance, Screenshots, Spelling)
- [ ] Show per-test status and results summary
- [ ] Add "Re-run Test" button for each test type
- [ ] Implement real-time status polling (for RUNNING tests)

#### Step 8.3: Test Results Pages (Within Release Run Context)
- [ ] **Page Preflight Results**: Issue list grouped by impact (BLOCKER, WARNING, INFO), filter by provider
- [ ] **Performance Results**: Per-URL table with mobile/desktop scores, Core Web Vitals chart
- [ ] **Screenshots Results**: Grid view with viewport labels, manual status controls
- [ ] **Spelling Results**: Issue list with context snippets, manual status controls

#### Step 8.4: Manual Test Status (Scoped to Release Run)
- [ ] Implement `POST /api/release-runs/[id]/manual-status`
- [ ] Add PASS/REVIEW/FAIL buttons to Screenshots/Spelling result pages
- [ ] Update Release Run status in real-time after manual status change
- [ ] Show warning if PASS would enable READY status (user confirmation)

#### Step 8.5: Release Readiness Summary Component
- [ ] Create Release Readiness display component (shows within Release Run detail)
- [ ] Show per-test status with color indicators
- [ ] Show BLOCKER issue count prominently
- [ ] Add tooltips with test details

---

### **Phase 9: Polish & Retention (Week 8-9)**

#### Step 9.1: Data Retention Implementation
- [ ] Implement retention logic in worker (prune old Release Runs)
- [ ] Keep current + previous Release Run per project
- [ ] Cascade delete related TestRun, UrlResult, Issue, ScreenshotSet, ManualTestStatus records
- [ ] Delete old screenshots from Supabase Storage
- [ ] Test retention with multiple Release Runs

#### Step 9.2: Email Notifications
- [ ] Choose email provider (Resend, SendGrid, AWS SES)
- [ ] Write `Documentation/email-notifications.md`
- [ ] Create email templates (HTML + plain text)
- [ ] Implement notification trigger in worker (on Release Run reaching READY or FAIL)
- [ ] Include Release Run summary: test results, BLOCKER count, manual review status
- [ ] Test with all Release Run statuses (READY, FAIL)

#### Step 9.3: Error Handling & Monitoring
- [ ] Set up Sentry (free tier) for app and worker
- [ ] Add comprehensive error logging
- [ ] Implement API retry logic for all providers (exponential backoff + jitter)
- [ ] Add health check endpoints for app and worker

---

### **Phase 10: Testing & Deployment (Week 9-10)**

#### Step 10.1: Testing
- [ ] Write unit tests for Release Run status computation (`lib/release-run-status.test.ts`)
- [ ] Write unit tests for issue impact logic
- [ ] Write integration tests for Release Run API routes
- [ ] Test worker with all 4 page-level test types end-to-end within Release Runs
- [ ] Test Release Run status transitions (PENDING → READY, PENDING → FAIL)
- [ ] Test retention enforcement (keeps 2 most recent Release Runs per project)
- [ ] Test stuck run cleanup and Release Run status recomputation
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
- [ ] Prisma schema and migrations (includes ReleaseRun model)
- [ ] API routes (projects, release runs, test runs, manual status)
- [ ] UI components (project management, Release Run list/detail, test results)
- [ ] Provider integrations (PageSpeed Lighthouse SEO, Linkinator, Custom Rules, PageSpeed Performance, Playwright, LanguageTool)
- [ ] Release Run status computation logic

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
- [ ] Users can create Release Runs with frozen URLs and selected page-level tests
- [ ] Users can trigger all 4 page-level test types within Release Runs (Page Preflight, Performance, Screenshots, Spelling)
- [ ] Worker processes TestRuns atomically without race conditions
- [ ] Worker updates Release Run status after each TestRun completion
- [ ] Test results display correctly in UI within Release Run context
- [ ] Manual status updates work for Screenshots and Spelling (scoped to Release Run)
- [ ] Release Run status computes correctly (PENDING → READY or FAIL)
- [ ] BLOCKER issues correctly cause Release Run FAIL status
- [ ] Data retention enforces 2 Release Runs per project
- [ ] Email notifications sent when Release Run reaches READY or FAIL

### Non-Functional
- [ ] All API routes respond in <2 seconds (excluding long-running test execution)
- [ ] Worker handles failures gracefully (retries, PARTIAL status, Release Run status update)
- [ ] Stuck runs are detected and cleaned up within 5-10 minutes
- [ ] No memory leaks in worker (can run for days)
- [ ] Error tracking captures all exceptions (Sentry)
- [ ] Code is TypeScript strict (or near-strict)

---

## 🚨 Critical Path Items

These items MUST be completed in order:

1. **Database schema & migrations** - Foundation for everything (includes ReleaseRun model)
2. **Authentication** - Required before any protected routes
3. **Release Run API** - Create/list/get Release Runs (core data model)
4. **Worker atomic job locking** - Required before provider integrations
5. **Release Run status computation** - Determines PENDING/READY/FAIL based on TestRuns and issues
6. **One complete provider integration within Release Run** - Validates entire test flow end-to-end
7. **Issue impact levels** - BLOCKER/WARNING/INFO determine Release Run status

Everything else can be done in parallel or iteratively.

---

## 📝 Notes

- **Prioritize one complete vertical slice**: Instead of building all APIs then all UI, complete one Release Run with Page Preflight end-to-end to validate the full flow early.
- **Provider integrations are independent**: These can be assigned to different developers or completed sequentially. All page-level tests work within Release Runs.
- **UI polish can happen in parallel**: While provider integrations are being built, UI components can be stubbed with mock data.
- **Documentation should be written DURING implementation**, not after. Each provider integration should produce its integration guide.
- **Release Run is the atomic unit**: Always think in terms of Release Runs, not individual tests. Tests exist within the context of a Release Run.

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