# ReleasePass: QA Platform Functional Spec

# Overview
Platform will deliver an automated pre- and post-deployment QA layer purpose-built for modern websites. Instead of trying to do everything, we focus on the tests that matter most at launch: ensuring your site is healthy, fast, visually correct, and free of embarrassing errors.

We will combine SEO technical health, performance, visual QA, and grammar checks into one branded, automated workflow. The result is a clear pass/fail report and prioritized fixes you can trust.

# Roadmap

* **MVP:**
  * Password protected web interface
  * User management
  * Project data model and management
  * **Release Run model** — frozen URL snapshots tested as cohesive launch candidates
  * Test datamodel with history (scoped to Release Runs)
  * Readiness score per Release Run (PENDING / READY / FAIL)
  * QA Tests (Page-Level, part of Release Runs):
    * Page Preflight (PageSpeed Lighthouse SEO + Linkinator + Custom Rules)
    * Performance (PageSpeed Core Web Vitals)
    * Screenshots (Playwright)
    * Spelling/Grammar (LanguageTool)
  * Note: Site Audit Full Site Crawl Mode (SE Ranking) is site-level, NOT part of Release Runs, deferred to V1.2
* **V1.2**:
  * Visual diffs for regression detection
  * Baseline screenshot selection mechanism (TBD)
* **V1.5**:
  * ManualTestStatus change history/audit trail
  * Per-user email notification preferences
* **Later / TBD**:
  * Marketing/analytics sanity checks (tag firing, JSON-LD)
  * Accessibility scans (WCAG baseline) for organizations needing compliance or inclusivity assurance.


# Technical Stack
See technical-stack.md

# Design

* [https://www.figma.com/design/YMiFr3zrjXxKxdh1olKpwo/4all--internal-?node-id=4646-106\&t=VkE5uL05QSDQcSzB-1](https://www.figma.com/design/YMiFr3zrjXxKxdh1olKpwo/4all--internal-?node-id=4646-106&t=VkE5uL05QSDQcSzB-1)

# Information Architecture & UX
## Global Navigation
Persistent brand bar appears across the platform with the following navigation:

* ReleasePass (main QA area)
  * Preflight - page-level tests grouped by Release Run
  * Site Audit - site-wide crawl (SE Ranking only)
* Projects
  * Projects (list/edit)
  * Add Project
* Settings
  * Users (list/edit)
  * Add User

## ReleasePass Workspace

### Navigation Structure
ReleasePass is the primary QA workspace with two tabs:

- **Preflight**: Page-level tests (Baseline, Performance, Spelling, Browser) organized by Release Run
- **Site Audit**: Site-wide crawl using SE Ranking API, organized by independent test runs

### Preflight Tab
Primary navigation organized around **Release Runs** — the unit of release qualification.

- **Project Selector**: Dropdown with "(+) Add New Project" option
- **Test Selector**: Dropdown showing Release Runs by date (e.g., "12/27/24 Preflight Test") with "(+) New Test" option
- **New Test Form**: Create Release Run with test type checkboxes (Baseline, Performance, Spelling, Browser) and URL list
- **Results Summary**: Shows test status, scores, and issue counts for selected Release Run

### Site Audit Tab
Independent site-level testing using SE Ranking API.

- **Project Selector**: Same as Preflight tab
- **Test Selector**: Dropdown showing Site Audit runs by date with "(+) New Test" option
- **Results Summary**: Shows audit score and issue breakdown for selected test run

### Project Selection (Shared)
A project selector that allows switching projects or creating new ones.
- Selecting a project loads the list of tests for that project
- Query parameters (?project=&test=) preserve state across tab navigation
- Adding a new project via "(+) Add New Project" redirects to Projects > Add Project

### Release Readiness
Displayed per Release Run. Shows status (PENDING/READY/FAIL) with color coding.
- **PENDING**: Tests incomplete or manual reviews not yet marked PASS
- **READY**: All tests complete, no blockers, all manual reviews PASS
- **FAIL**: BLOCKER issues present or manual review marked FAIL

Updates in real-time as tests complete within the Release Run.

### Test Results Views
Each test type has a full results page with detailed metrics, issues, screenshots, or manual status controls.
Specifics will vary by test and will be defined and update in design and this document.

## Projects
Allows listing and adding projects. Add form includes name, URL, sitemap, and notes.

## Utilities
Bulk Performance, HTML Cleaner, and Bullshit Tester integrated into the authenticated UI.

**NOTE**: Utilities are not part of MVP scope. Detailed specifications will be added in a future version.

## Settings (Users)
List, edit and add users.

## States & Edge Cases
Empty states, no tests yet, partial failures, and manual review indicators are consistently handled.

# Functional Requirements
## General
* The platform must provide a password-protected web interface using Supabase Auth with email+password login. All authenticated users are treated as admins in MVP.
* A single shared data environment is used; Companies exist only as placeholders and are not exposed.
* Project-based testing:
  * Project name
  * Primary site URL
  * Optional sitemap URL
  * Notes
* **Release Run model**:
  * A Release Run represents a single launch candidate tested as a cohesive unit
  * Contains a frozen URL list and selected page-level tests
  * URLs are immutable once execution begins
  * Release Run status: PENDING → READY or FAIL
* Supported test types (page-level, part of Release Runs):
  * Page Preflight - automated with score-based pass/fail (Lighthouse SEO + Linkinator + Custom Rules)
  * Performance - automated with numeric score (PageSpeed)
  * Screenshots - automated capture with manual status review
  * Spelling/Grammar - automated detection with manual status review
* Site-level tests (NOT part of Release Runs):
  * Site Audit Full Crawl - automated with numeric score (SE Ranking, v1.2)
* Test history retention:
  * Current + previous Release Run per project
  * All TestRuns within retained Release Runs
  * Screenshots: current + previous only within retained Release Runs
  * Raw API payloads: two most recent per test type
* TestRun lifecycle (within a Release Run):
  * QUEUED → RUNNING → SUCCESS / FAILED / PARTIAL
  * **IMPORTANT**: `TestRun.status` represents the **operational execution status** of the test run itself (whether the worker successfully completed processing), NOT the quality assessment of the test results.
  * Quality assessment for Screenshots and Spelling is stored separately in `ManualTestStatus` (PASS / REVIEW / FAIL).
  * For Performance, quality is determined by the numeric `score` field combined with configured thresholds.
  * For Page Preflight, quality is determined by score (calculated from severity penalties; score >= 50 = pass).
* Partial test success must be supported.
* Background worker:
  * Atomic job locking
  * Retries for transient errors
  * Dead-letter after repeated failures
  * Enforces retention rules (scoped to Release Runs)
  * Updates Release Run status after TestRun completion
* User management (admin only)
* Email notifications for completed Release Runs
* UI provides dashboards for managing Release Runs, running tests, browsing results, and reviewing issues
* Utilities rewritten and integrated:
  * Bulk Performance
  * HTML Cleaner
  * Bullshit Tester

## Release Readiness

Release Readiness is computed **per Release Run**, not from "latest tests across time". The key question is: "Is *this release* ready?"

### Release Run Model

A **Release Run** represents a single launch candidate tested as a cohesive unit:
- Project-scoped container for multiple TestRuns
- Frozen snapshot of: URL list + selected page-level tests
- URLs are immutable once execution begins
- Only page-level tests are included (Site Audit Full Crawl is site-level, not part of Release Runs)

### Release Run Status

* **PENDING** — One or more tests not yet completed, or manual review tests not marked PASS
* **READY** — All tests completed, all scores >= threshold, all manual reviews marked PASS
* **FAIL** — One or more scores below threshold, or manual review marked FAIL

### Test Scoring Model

**Page-Level Tests (Part of Release Runs):**
* **Page Preflight** — score (0-100) calculated from severity penalties; pass/fail based on score threshold
* **Performance** — numeric score (0-100) averaged across tested URLs (mobile + desktop)
* **Screenshots** — manual status (Pass / Needs Review / Fail)
* **Spelling/Grammar** — manual status (Pass / Needs Review / Fail)

**Site-Level Tests (NOT part of Release Runs):**
* **Site Audit (Full Crawl)** — numeric score (0-100) from SE Ranking (v1.2)

### ResultItem Severity Levels

Failed ResultItems include a `severity` field that determines score penalties:
* **BLOCKER** — -40 points (e.g., broken internal links, page not crawlable)
* **CRITICAL** — -20 points (e.g., missing title, meta description)
* **HIGH** — -10 points (e.g., missing canonical)
* **MEDIUM** — -5 points (e.g., external broken links)
* **LOW** — -2 points (e.g., redirect chains)

### Pass/Fail Threshold

* **Pass threshold**: score >= 50 (configurable in `lib/config/scoring.ts`)
* Score starts at 100 and deducts based on severity of failed items

### Color Mapping

* Green — score >= 80
* Yellow — score 50-79 (passing but has issues)
* Red — score < 50 (failing)
* Grey — Not reviewed or needs manual verification / PENDING

### Behavior

* Computed per Release Run (not across unrelated test timestamps)
* Status updates in real-time as tests complete within the Release Run
* Re-running a test updates results within the same Release Run
* Not stored as a physical table; derived dynamically from TestRuns and ManualTestStatus

## Data Schema
General rules:
* All primary keys are UUID strings stored in an `id` field.
* All tables include `createdAt` and `updatedAt` timestamp fields.
* Foreign key fields reference the `id` of the related entity.
* Date/time fields are stored as ISO-8601 datetimes in the database.

* Company  (conceptual for future multi-tenant support; not exposed in MVP UI)
  * id — UUID
  * name — string
  * createdAt — datetime
  * updatedAt — datetime

* Projects
  * id — UUID
  * companyId — UUID (nullable in MVP; reserved for future Company linkage)
  * name — string
  * siteUrl — string
  * sitemapUrl — string (nullable)
  * notes — text (nullable)
  * createdAt — datetime
  * updatedAt — datetime

* ReleaseRun
  * id — UUID
  * projectId — UUID (FK to Projects.id)
  * status — enum (`PENDING`, `READY`, `FAIL`)
  * urls — JSON (frozen array of URLs to test)
  * selectedTests — JSON (array of selected page-level test types)
  * createdAt — datetime
  * updatedAt — datetime

  ReleaseRun represents a single launch candidate tested as a cohesive unit. URLs are frozen once execution begins and cannot be modified. All TestRuns within a ReleaseRun share the same URL set.

* Users
  * id — UUID
  * email — string (unique)
  * firstName — string (nullable)
  * lastName — string (nullable)
  * role — string/enum (MVP: "admin" only)
  * supabaseUserId — UUID or string (links to Supabase Auth user id)
  * createdAt — datetime
  * updatedAt — datetime

  > Passwords are NOT stored in this table. Authentication credentials are managed by Supabase Auth.

* TestRun
  * id — UUID
  * releaseRunId — UUID (FK to ReleaseRun.id; nullable for site-level tests)
  * projectId — UUID (FK to Projects.id)
  * type — enum (`PAGE_PREFLIGHT`, `PERFORMANCE`, `SCREENSHOTS`, `SPELLING`, `SITE_AUDIT`)
  * status — enum (`QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `PARTIAL`)
  * score — integer (nullable; 0-100 for Performance tests)
  * startedAt — datetime (nullable until run starts)
  * finishedAt — datetime (nullable until run finishes)
  * lastHeartbeat — datetime (nullable; updated by worker during processing)
  * rawPayload — JSON (structured with provider keys; see below)
  * error — text (nullable; error message or summary if failed/partial)
  * createdAt — datetime
  * updatedAt — datetime

  TestRun belongs to a ReleaseRun for page-level tests. Multiple TestRuns of the same type may exist within a ReleaseRun; only the latest per type is considered "current". Re-running a test creates a new TestRun within the same ReleaseRun.

  **rawPayload structure**: For multi-provider tests (e.g., PAGE_PREFLIGHT), rawPayload stores structured JSON with provider keys:
  ```json
  {
    "lighthouse": { /* full PageSpeed API response */ },
    "linkinator": { /* full link check results */ }
  }
  ```

* UrlResult
  * id — UUID
  * testRunId — UUID (FK to TestRun.id)
  * url — string
  * lcp — number (nullable)
  * cls — number (nullable)
  * inp — number (nullable)
  * performanceScore — integer (nullable)
  * additionalMetrics — JSON (nullable; for provider-specific summary metrics)
  * createdAt — datetime
  * updatedAt — datetime
  * → resultItems — one-to-many relation to ResultItem

  UrlResult represents per-URL metrics for a given TestRun. Fields are sparsely populated depending on the test type (e.g., Performance vs Site Audit). Each UrlResult contains multiple ResultItems representing individual check results.

* ResultItem
  * id — UUID
  * urlResultId — UUID (FK to UrlResult.id)
  * provider — string/enum (e.g., `LIGHTHOUSE`, `LINKINATOR`, `CUSTOM_RULE`, `SE_RANKING`, `LANGUAGETOOL`, `INTERNAL`)
  * code — string (normalized check code, e.g. `document-title`, `BROKEN_INTERNAL_LINK`, `MISSING_OG_IMAGE`, `SPELLING_ERROR`)
  * name — string (human-readable title of the check)
  * status — enum (`PASS`, `FAIL`, `SKIP`)
  * severity — string/enum (nullable; only for FAIL status: `BLOCKER`, `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`)
  * meta — JSON (nullable; additional context such as description, selectors, raw audit data)
  * createdAt — datetime
  * updatedAt — datetime

  ResultItem stores all check results (both passing and failing) from test providers. Each ResultItem belongs to a UrlResult, representing a single audit/check that was run for that URL.

  **Status**: Indicates the outcome of the check:
  * **PASS** — Check passed successfully
  * **FAIL** — Check failed; severity field is populated
  * **SKIP** — Check was skipped (e.g., not applicable)

  **Severity** (only for FAIL status): Determines score penalty and release readiness:
  * **BLOCKER** — -40 points (e.g., broken internal links, page not crawlable)
  * **CRITICAL** — -20 points (e.g., missing title, meta description)
  * **HIGH** — -10 points (e.g., missing canonical)
  * **MEDIUM** — -5 points (e.g., external broken links)
  * **LOW** — -2 points (e.g., redirect chains)

  **MVP Providers**: LIGHTHOUSE (PageSpeed SEO), LINKINATOR (link checking), CUSTOM_RULE (custom validation rules), LANGUAGETOOL (spelling/grammar).

  **Future Providers**: SE_RANKING (full site crawl), INTERNAL (system-generated checks).

* ScreenshotSet
  * id — UUID
  * testRunId — UUID (FK to TestRun.id)
  * projectId — UUID (FK to Projects.id)
  * url — string
  * viewport — string (e.g., `desktop`, `mobile`)
  * storageKey — string (path/key in Supabase Storage)
  * role — enum (`CURRENT`, `PREVIOUS`, `BASELINE`) — MVP uses `CURRENT` and `PREVIOUS`; `BASELINE` reserved for future visual diffing.
  * createdAt — datetime
  * updatedAt — datetime

  ScreenshotSet represents a group of screenshots for a single URL and viewport for a given TestRun.

* ManualTestStatus
  * id — UUID
  * releaseRunId — UUID (FK to ReleaseRun.id)
  * projectId — UUID (FK to Projects.id)
  * testType — enum (`SCREENSHOTS`, `SPELLING`)
  * statusLabel — enum (`PASS`, `REVIEW`, `FAIL`)
  * updatedByUserId — UUID (FK to Users.id)
  * createdAt — datetime
  * updatedAt — datetime

  ManualTestStatus stores user-entered status decisions for tests that do not have a numeric score (Screenshots and Spelling/Grammar). These statuses are scoped to a specific Release Run and contribute to that Release Run's readiness status.

  **MVP Note**: Only the current status is stored per Release Run; updates overwrite the previous status. Change history/audit trail will be added in v1.5.

Release Readiness itself is a derived object computed at runtime **per Release Run** from:
* All TestRuns within the Release Run (score >= 50 = pass), and
* ResultItem severity levels (BLOCKER items heavily penalize score), and
* ManualTestStatus entries for that Release Run.

No dedicated `Readiness` table is required in MVP.

## QA Tests

### Test Execution Scope & URL Selection

Tests are categorized as **page-level** (included in Release Runs) or **site-level** (run independently).

**IMPORTANT**: For page-level tests within a Release Run, URLs are **frozen** once the Release Run begins execution. All tests in the Release Run share the same URL set.

#### Page-Level Tests (Part of Release Runs)

**Page Preflight**:
- **Scope**: User-selected URL list (frozen per Release Run)
- **Configuration**: User pastes 1 or more specific URLs when creating a Release Run
- **Providers**:
  - PageSpeed Insights API (Lighthouse SEO audits) — binary pass/fail checks
  - Linkinator for link validation (internal, external, resources)
  - Custom rules plugin system for extensible checks
- **Maximum**: 50 URLs per Release Run in MVP
- **JavaScript rendering**: Not supported in MVP (static HTML only)
- **Authentication**: Not supported in MVP (public URLs only)

**Performance**:
- **Scope**: Uses frozen URL list from Release Run, or sitemap-based selection
- **Configuration Options**:
  - **Pages Mode**: Uses URLs from the Release Run's frozen URL list
  - **Full Site Mode**: Tests URLs from sitemap with a limit of 20 URLs for MVP (to manage API quotas and execution time)
- **Tests per URL**: Each URL is tested for both mobile and desktop viewports
- **Field data**: Uses lab metrics only (CrUX field data may not be available for all URLs, especially staging sites)
- **Scoring**: MVP uses **average performance score** across all tested URLs

**Screenshots**:
- **Scope**: Uses frozen URL list from Release Run
- **Configuration**: URLs come from the Release Run's frozen URL list
- **Viewport matrix** (MVP fixed configuration):
  - Desktop / Chrome (1440px width)
  - Desktop / Safari (1440px width)
  - Tablet / iOS Safari (768px width)
  - Mobile / iOS Safari (375px width)
- **Capture mode**: Full-page screenshots
- **Authentication**: Not supported in MVP

**Spelling/Grammar**:
- **Scope**: Uses frozen URL list from Release Run
- **Configuration**: URLs come from the Release Run's frozen URL list
- **Text extraction**: Uses Playwright to render page and extract visible text from final DOM
- **Content filtering**: Extracts text content only; filters out navigation, hidden elements (subject to refinement during implementation)
- **Batching**: Large pages split into batches for LanguageTool API (max batch size TBD based on API limits)
- **JavaScript rendering**: Supported (Playwright waits for page load)
- **Authentication**: Not supported in MVP

#### Site-Level Tests (NOT part of Release Runs)

**Site Audit (Full Site Crawl)** — Future implementation (v1.2):
- **Scope**: Comprehensive site-wide audit
- **Configuration**: Automatically discovers and crawls all URLs from project's `sitemapUrl`
- **Provider**: SE Ranking Website Audit API
- **Maximum**: 500 pages per run
- **Same-subdomain rule**: Won't crawl external subdomains
- **Note**: This is a site-level test that runs independently of Release Runs

### Page Preflight (Page-Level, Part of Release Runs)
* Purpose: Catch SEO and UX-breaking defects early with pre-deployment page validation
* Part of Release Runs with frozen URL lists
* Uses Lighthouse SEO for binary pass/fail checks (no element counts or granular diagnostics)

#### Components

**Provider 1: PageSpeed Insights API (Lighthouse SEO)**
* API: Google PageSpeed Insights API v5
* Documentation: https://developers.google.com/speed/docs/insights/v5/about
* Category: `seo` from Lighthouse audits
* Checks Performed:
  * **Meta Tags & Content**:
    * `document-title` - Page has title tag
    * `meta-description` - Document has meta description
  * **Crawlability & Indexing**:
    * `http-status-code` - Page has successful HTTP status
    * `is-crawlable` - Page isn't blocked from indexing
    * `robots-txt` - robots.txt is valid
    * `crawlable-anchors` - Links are crawlable
  * **Technical SEO**:
    * `canonical` - Document has valid canonical
    * `hreflang` - Document has valid hreflang
    * `structured-data` - Structured data is valid
    * `viewport` - Has viewport meta tag
  * **Content Quality**:
    * `image-alt` - Image elements have [alt] attributes
    * `link-text` - Links have descriptive text

**Provider 2: Linkinator (Link Validation)**
* Library: linkinator (Google's link checker)
* Documentation: https://github.com/JustinBeckwith/linkinator
* Checks Performed:
  * **Internal Links**: 404/500 errors, timeouts
  * **External Links**: 404/410 errors (dead links)
  * **Resource Links**: Missing images, CSS, JavaScript files (404 errors)
  * **Redirect Chains**: Links with 3+ redirects
* Configuration:
  * Concurrent requests: 10
  * Timeout: 10s (internal), 5s (external/resources)
  * Skip patterns: `mailto:*`, `tel:*`, `javascript:*`

**Provider 3: Custom Rules Plugin System**
* Architecture: File-based plugins loaded from `worker/rules/` directory
* Rule interface: Each rule receives page context (URL, HTML, headers) and returns issues
* MVP Rules:
  * Meta tags validation (Open Graph, Twitter Cards)
  * Title length validation
* Extensibility: Add new `.ts` files to `worker/rules/` directory

**Scoring for Page Preflight**:
* Base score: 100 points
* Deductions per failed item (based on severity):
  * BLOCKER: -40 points (e.g., broken internal links, page not crawlable)
  * CRITICAL: -20 points (e.g., missing title, meta description)
  * HIGH: -10 points (e.g., missing canonical)
  * MEDIUM: -5 points (e.g., external broken links)
  * LOW: -2 points (e.g., redirect chains)
* Pass threshold: score >= 50 (configurable in `lib/config/scoring.ts`)
* Final score: 0-100

### Site Audit Full Crawl (Site-Level, NOT Part of Release Runs) - Future v1.2

**Provider: SE Ranking Website Audit API**

> **Note**: This is a site-level test that runs independently of Release Runs. It provides comprehensive site-wide auditing but is not part of the release qualification workflow.
* Documentation: https://seranking.com/api/data/website-audit/
* Scope:
  Security (8 checks)
* No HTTPS encryption
* HTTP URLs in XML sitemap
* rel="canonical" from HTTPS to HTTP
* Mixed content
* Outdated security protocol version
* Certificate name mismatch
* Outdated encryption algorithm
* Security certificate expires soon  
  Crawling & Indexing (19 checks)
* 4XX HTTP Status Codes
* 5XX HTTP Status Codes
* Timed out
* Canonical URL with a 4XX Status Code
* Canonical URL with a 5XX Status Code
* Canonical URL with a 3XX Status Code
* Canonical chain
* Blocked by noindex
* HTML and HTTP header contain noindex
* Blocked by X-Robots-Tag
* Blocked by nofollow
* HTML and HTTP header contain nofollow
* Blocked by robots.txt
* Robots.txt file not found
* Robots.txt either has too many redirects or a redirect loop
* Robots.txt is not accessible
* Robots.txt is not valid
* Robots.txt is set to disallow crawling
* URL too long  
  Redirects (6 checks)
* Redirect to 4xx or 5xx
* Redirect loop
* Redirect chain
* Meta refresh redirect
* 3ХХ HTTP status code
* 302, 303, 307 temporary redirects  
  Sitemap (9 checks)
* 4XX pages in XML sitemap
* 5XX pages in XML sitemap
* 3XX redirects in XML sitemap
* Sitemap pages timed out
* Noindex pages in XML sitemap
* Non-canonical pages in XML sitemap
* XML sitemap is too large
* XML sitemap missing
* XML sitemap not found in robots.txt file  
  Meta Tags (9 checks)
* Title tag missing
* Multiple title tags
* URLs with duplicate page titles
* Title too long
* Title too short
* Description missing
* Multiple description tags
* Duplicate description
* Description too long  
  Content (16 checks)
* Duplicate content
* Multiple rel="canonical"
* No trailing slashes
* URLs with double slash
* No WWW redirect
* H1 tag missing
* H1 tag empty
* Multiple H1 tags
* Duplicate H1
* Identical Title and H1 tags
* H1 tag too long
* 3XX images
* 4XX images (Not Found)
* 5XX images (Loading Failed)
* Alt text missing
* Image too big  
  Localization (11 checks)
* Invalid language code
* Hreflang and HTML lang do not match
* Language duplicates in hreflang
* Multiple language codes for one page
* Hreflang to non-canonical
* Hreflang to 3XX, 4XX or 5XX
* Confirmation (return) links missing on hreflang pages
* Hreflang page doesn't link out to itself
* X-default hreflang attribute missing
* Invalid HTML lang
* HTML lang missing  
  Speed & Performance (13 checks)
* Slow page loading speed
* Speed Index
* Largest Contentful Paint (LCP) in real-world conditions
* Largest Contentful Paint (LCP) in a lab environment
* Cumulative Layout Shift (CLS) in real-world conditions
* Cumulative Layout Shift (CLS) in a lab environment
* First Contentful Paint (FCP) in real-world conditions
* First Contentful Paint (FCP) in a lab environment
* Interaction to Next Paint (INP) in real-world conditions
* Time to Interactive (TTI)
* Total Blocking Time (TBT)
* HTML size too big
* Uncompressed content  
  JavaScript (8 checks)
* 4XX or 5XX JavaScript file
* 3XX JavaScript file
* External JavaScript with 3XX, 4XX or 5XX
* JavaScript too big
* JavaScript not compressed
* JavaScript not minified
* JavaScript not cached
* Too many JavaScript files  
  CSS (8 checks)
* 4XX or 5XX CSS file
* 3XX CSS file
* External CSS files with 3XX, 4XX or 5XX
* CSS too big
* CSS not compressed
* CSS not minified
* CSS not cached
* Too many CSS files  
  Links (11 checks)
* No inbound links
* One inbound internal link
* Internal links to 3XX redirect pages
* Nofollow internal links
* Internal links missing anchor
* External links to 3XX
* External links to 4XX
* External links to 5XX
* External links Timed out
* Nofollow external links
* External links missing anchor  
  Mobile Optimization (2 checks)
* Viewport meta tag missing
* Fixed width value in viewport meta tag  
  Other (3 checks)
* Favicon missing
* X (ex-Twitter) Card tag missing
* Use of incompatible plugins

### Performance (Page-Level, Part of Release Runs)
* Purpose: Keep Core Web Vitals (LCP, CLS, INP) in green and prevent regressions.
* Part of Release Runs with frozen URL lists
* Solution:
  * Google PageSpeed Insights API v5 – lab \+ field data
* Documentation:
  * https://developers.google.com/speed/docs/insights/v5/about
* Cost:
  * Free for current usage
* Scope:
  * Lab metrics (synthetic Lighthouse)
    Field metrics (CrUX)
  * Lighthouse a11y

### Screenshots (Page-Level, Part of Release Runs)
* Purpose: Capture high-fidelity screenshots across devices/browsers for rendering verification.
* Part of Release Runs with frozen URL lists
* Manual review required (PASS / REVIEW / FAIL)
* Solution:
  * Playwright scripted captures
* Documentation
  * https://playwright.dev/docs/intro
* Cost
  * Playwright: free
  * LambdaTest: $15/month (current usage)
* Scope:
  * Device/viewport matrix (mobile breakpoints included)
  * Full-page \+ above-the-fold options
  * Targeted page set from Release Run's frozen URL list
* Output:
  * Stored images in S3-compatible storage, linked in dashboard.

### Spelling (Page-Level, Part of Release Runs)
* Purpose: Detect spelling and contextual grammar issues in rendered text.
* Part of Release Runs with frozen URL lists
* Manual review required (PASS / REVIEW / FAIL)
* Solution:
  * Language Tool API
* Documentation
  * https://languagetool.org/
  * https://languagetool.org/http-api/
* Scope:
  * Extract visible page text from Release Run's frozen URL list, send in batches
  * Return flagged issues and normalized suggestions.

## Version 1.2

### Visual Quality — Diffs (Visual Regression Testing)

* Purpose: Compare current vs baseline screenshots to detect unintended visual changes.
* Solution Options:
  * Primary: LambdaTest SmartUI (AI/heuristic noise reduction)
  * Secondary: Resemble.js (perceptual tolerance)
* Process: Fetch baseline → capture new → compare → output diff image \+ mismatch %.
* Noise Control: Ignore masks/dynamic regions, threshold tuning.

## Version 2.x / Later

### Content & Analytics Sanity (Gaps Only)
* Purpose: Verify key marketing/measurement wiring post-deployment.
* In Scope: Analytics tag firing verification (GA4, GTM, FB Pixel), consent logic testing, JSON-LD structured data validation, tag sequencing & ordering.
* Out of Scope (covered by SE Ranking): Meta tags, titles, descriptions, headings, sitemap, alt attributes.
* Tooling: Playwright network interception, JSON schema parsers, optional Google Tag Assistant API.

### Accessibility (a11y)
* Purpose: Baseline WCAG health checks via automated testing.
* Planned Tools: axe-core (primary), QualWeb (alternate).
* Notes: Lighthouse a11y via PSI already runs in MVP for basic checks; SE Ranking overlaps partially (alt text, headings, lang attr, title tags).
