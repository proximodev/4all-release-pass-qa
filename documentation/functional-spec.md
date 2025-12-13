# ReleasePass: QA Platform Functional Spec

# Overview
Platform will deliver an automated pre- and post-deployment QA layer purpose-built for modern websites. Instead of trying to do everything, we focus on the tests that matter most at launch: ensuring your site is healthy, fast, visually correct, and free of embarrassing errors.

We will combine SEO technical health, performance, visual QA, and grammar checks into one branded, automated workflow. The result is a clear pass/fail report and prioritized fixes you can trust.

# Roadmap

* **MVP:**
  * Password protected web interface
  * User management
  * Project data model and management
  * Test datamodel with history
  * Readiness score datamodel
  * QA Tests
    * Site Audit (SE Ranking)
    * Performance (Core Web Vitals)
    * Screenshots (Playwright)
    * Spelling/Grammar (LanguageTool)
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

* QA Tools
  * Site Audit
  * Performance
  * Browser Test
  * Spellcheck
* Projects
  * Projects (list/edit)
  * Add Project
* Settings
  * Users (list/edit)
  * Add User

## QA Tools Workspace

### General
Tabs include Site Audit, Performance, Browser Test, and Spellcheck. Each tab has:
- Left panel: project info, inputs, and Start Test button.
- Right panel: latest results summary, history preview, and link to full results.

### Project Selection
A project selector (display in left panel) that allows switching projects or creating new ones.
- Selecting a project loads latest test results and updates Release Readiness.
- Adding a new projects directs user to Project > Add Project

### Release Readiness
Displayed top-right. Shows per-test score or status with color coding. Updates after test completion.

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
* Supported manual tests:
  * Site Audit (SE Ranking)
  * Performance (PageSpeed)
  * Screenshots (manual status)
  * Spelling/Grammar (manual status)
* Test history retention:
  * Current + previous run per test type
  * Screenshots: current + previous only
  * Raw API payloads: two most recent per test type
* Test lifecycle:
  * QUEUED → RUNNING → SUCCESS / FAILED / PARTIAL
  * **IMPORTANT**: `TestRun.status` represents the **operational execution status** of the test run itself (whether the worker successfully completed processing), NOT the quality assessment of the test results.
  * Quality assessment for Screenshots and Spelling is stored separately in `ManualTestStatus` (PASS / REVIEW / FAIL).
  * For Site Audit and Performance, quality is determined by the numeric `score` field combined with configured thresholds.
* Partial test success must be supported.
* Background worker:
  * Atomic job locking
  * Retries for transient errors
  * Dead-letter after repeated failures
  * Enforces retention rules
* User management (admin only)
* Email notifications for completed test runs
* UI provides dashboards for running tests, browsing results, and reviewing issues
* Utilities rewritten and integrated:
  * Bulk Performance
  * HTML Cleaner
  * Bullshit Tester

## Release Readiness
Each project must display a Release Readiness summary based on the latest test runs.

**Test scoring model:**
* **Site Audit** — numeric score from SE Ranking
* **Performance** — may include multiple URLs; score rule may be average or worst-case (MVP uses a single defined method)
* **Screenshots** — manual status (Pass / Needs Review / Fail)
* **Spelling/Grammar** — manual status (Pass / Needs Review / Fail)

**Each test contributes either:**
* A numeric score
* OR a manual status label

**Color mapping:**
* Green — Passing
* Yellow — Moderate concern
* Red — Failing
* Grey (Review) — Not reviewed or needs manual verification

**Behavior:**
* Recomputed whenever any test run completes
* Not stored as a physical table; derived dynamically
* Only current readiness state is shown in MVP

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
  * projectId — UUID (FK to Projects.id)
  * type — enum (`SITE_AUDIT`, `PERFORMANCE`, `SCREENSHOTS`, `SPELLING`)
  * status — enum (`QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `PARTIAL`)
  * startedAt — datetime (nullable until run starts)
  * finishedAt — datetime (nullable until run finishes)
  * rawPayload — JSON (raw API response for debugging; current run only)
  * error — text (nullable; error message or summary if failed/partial)
  * createdAt — datetime
  * updatedAt — datetime

* UrlResult
  * id — UUID
  * testRunId — UUID (FK to TestRun.id)
  * url — string
  * lcp — number (nullable)
  * cls — number (nullable)
  * inp — number (nullable)
  * performanceScore — integer (nullable)
  * additionalMetrics — JSON (nullable; for provider-specific metrics)
  * createdAt — datetime
  * updatedAt — datetime

  UrlResult represents per-URL metrics for a given TestRun. Fields are sparsely populated depending on the test type (e.g., Performance vs Site Audit).

* Issue
  * id — UUID
  * testRunId — UUID (FK to TestRun.id)
  * url — string
  * provider — string/enum (e.g., `SE_RANKING`, `LANGUAGETOOL`, `INTERNAL`)
  * code — string (normalized issue code, e.g. `MISSING_H1`, `SPELLING_ERROR`)
  * summary — string (short human-readable description)
  * severity — string/enum (e.g., `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  * meta — JSON (nullable; additional context such as selectors, offsets, raw messages)
  * createdAt — datetime
  * updatedAt — datetime

  Issue is a generic issue table used across test types (Site Audit, Spelling, possible future tools).

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
  * projectId — UUID (FK to Projects.id)
  * testType — enum (`SCREENSHOTS`, `SPELLING`)
  * statusLabel — enum (`PASS`, `REVIEW`, `FAIL`)
  * updatedByUserId — UUID (FK to Users.id)
  * createdAt — datetime
  * updatedAt — datetime

  ManualTestStatus stores user-entered status decisions for tests that do not have a numeric score (Screenshots and Spelling/Grammar). Release Readiness uses these statuses in combination with the latest TestRun data for each test type.

  **MVP Note**: Only the current status is stored; updates overwrite the previous status. Change history/audit trail will be added in v1.5.

Release Readiness itself is a derived object computed at runtime from:
* The most recent TestRun per test type for the selected Project, and
* Any corresponding ManualTestStatus entries.

No dedicated `Readiness` table is required in MVP.

## QA Tests

### Test Execution Scope & URL Selection

Each test type has different URL selection capabilities based on its purpose:

**Site Audit**:
- **Scope**: Full sitemap crawl
- **Configuration**: Automatically discovers and crawls all URLs from the project's `sitemapUrl`
- **Crawl limits**: Maximum 500 pages per run; respects same-subdomain rule (won't crawl external subdomains)
- **JavaScript rendering**: Not supported in MVP (static HTML only)
- **Authentication**: Not supported in MVP (public URLs only)

**Performance**:
- **Scope**: User-selectable — either custom URL list OR sitemap-based
- **Configuration Options**:
  - **Pages Mode**: User pastes 1 or more specific URLs in the UI (textarea, one per line)
  - **Full Site Mode**: Tests URLs from sitemap with a limit of 20 URLs for MVP (to manage API quotas and execution time)
- **Tests per URL**: Each URL is tested for both mobile and desktop viewports
- **Field data**: Uses lab metrics only (CrUX field data may not be available for all URLs, especially staging sites)
- **Scoring**: MVP uses **average performance score** across all tested URLs for Release Readiness computation

**Screenshots**:
- **Scope**: Custom URL list only
- **Configuration**: User pastes 1 or more specific URLs in the UI
- **Viewport matrix** (MVP fixed configuration):
  - Desktop / Chrome (1440px width)
  - Desktop / Safari (1440px width)
  - Tablet / iOS Safari (768px width)
  - Mobile / iOS Safari (375px width)
- **Capture mode**: Full-page screenshots
- **Authentication**: Not supported in MVP

**Spelling/Grammar**:
- **Scope**: Custom URL list only
- **Configuration**: User pastes 1 or more specific URLs in the UI
- **Text extraction**: Uses Playwright to render page and extract visible text from final DOM
- **Content filtering**: Extracts text content only; filters out navigation, hidden elements (subject to refinement during implementation)
- **Batching**: Large pages split into batches for LanguageTool API (max batch size TBD based on API limits)
- **JavaScript rendering**: Supported (Playwright waits for page load)
- **Authentication**: Not supported in MVP

### Site Audit (Crawl-Based)
* Purpose: Catch SEO and UX-breaking defects early
* Solution:
  * SE Ranking Website Audit API
* Documentation:
  * https://seranking.com/api/data/website-audit/
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

#### Performance
* Purpose: Keep Core Web Vitals (LCP, CLS, INP) in green and prevent regressions.
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

### Screenshots
* Purpose: Capture high-fidelity screenshots across devices/browsers for rendering verification.
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
  * Targeted page set
* Output:
  * Stored images in S3-compatible storage, linked in dashboard.

### Spelling 
* Purpose: Detect spelling and contextual grammar issues in rendered text.
* Solution:
  * Language Tool API
* Documentation
  * https://languagetool.org/
  * https://languagetool.org/http-api/
* Scope:
  * Extract visible page text, send in batches
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
