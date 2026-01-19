# ReleasePass: QA Platform Functional Spec

## Table of Contents

- [Overview](#overview)
- [Roadmap](#roadmap)
- [Technical Stack](#technical-stack)
- [Design](#design)
- [Information Architecture & UX](#information-architecture--ux)
  - [Global Navigation](#global-navigation)
  - [ReleasePass Workspace](#releasepass-workspace)
    - [Navigation Structure](#navigation-structure)
    - [Preflight Tab](#preflight-tab)
    - [Site Audit Tab](#site-audit-tab)
    - [Project Selection (Shared)](#project-selection-shared)
    - [Release Readiness](#release-readiness)
    - [Test Results Views](#test-results-views)
  - [Projects](#projects)
  - [Utilities](#utilities)
  - [Settings (Users & Companies)](#settings-users--companies)
  - [States & Edge Cases](#states--edge-cases)
- [Functional Requirements](#functional-requirements)
  - [General](#general)
  - [Release Readiness](#release-readiness-1)
    - [Release Run Model](#release-run-model)
    - [Release Run Status](#release-run-status)
    - [Test Scoring Model](#test-scoring-model)
    - [ResultItem Severity Levels](#resultitem-severity-levels)
    - [Pass/Fail Threshold](#passfail-threshold)
    - [Color Mapping](#color-mapping)
    - [Behavior](#behavior)
  - [Data Schema](#data-schema)
  - [QA Tests](#qa-tests)
    - [Test Execution Scope & URL Selection](#test-execution-scope--url-selection)
    - [Page Preflight (Page-Level, Part of Release Runs)](#page-preflight-page-level-part-of-release-runs)
    - [Site Audit Full Crawl (Site-Level, NOT Part of Release Runs) - Future v1.2](#site-audit-full-crawl-site-level-not-part-of-release-runs---future-v12)
    - [Performance (Page-Level, Part of Release Runs)](#performance-page-level-part-of-release-runs)
    - [Screenshots (Page-Level, Part of Release Runs)](#screenshots-page-level-part-of-release-runs)
    - [Spelling (Page-Level, Part of Release Runs)](#spelling-page-level-part-of-release-runs)
  - [Version 1.2](#version-12)
    - [Visual Quality — Diffs (Visual Regression Testing)](#visual-quality--diffs-visual-regression-testing)
  - [Version 2.x / Later](#version-2x--later)
    - [Content & Analytics Sanity (Gaps Only)](#content--analytics-sanity-gaps-only)
    - [Accessibility (a11y)](#accessibility-a11y)

---

# Overview
Platform will deliver an automated pre- and post-deployment QA layer purpose-built for modern websites. Instead of trying to do everything, we focus on the tests that matter most at launch: ensuring your site is healthy, fast, visually correct, and free of embarrassing errors.

We will combine SEO technical health, performance, visual QA, and grammar checks into one branded, automated workflow. The result is a clear pass/fail report and prioritized fixes you can trust.

[Back to top](#table-of-contents)

# Roadmap

* **V1.0 - MVP:**
  * Password protected web interface
  * User management
  * Project data model and management
  * **Release Run model** — frozen URL snapshots tested as cohesive launch candidates
  * Test datamodel with history (scoped to Release Runs)
  * Readiness score per Release Run (PENDING / READY / FAIL)
  * Preflight Rules with ability to customize severity, categorization and test/issue metadata
  * Scored and Manual testing 
  * QA Tests (Page-Level, part of Release Runs):
    * Page Preflight (PageSpeed Lighthouse SEO + Linkinator + Custom Rules)
    * Performance (PageSpeed Core Web Vitals)
    * Spelling/Grammar (LanguageTool)
    * Screenshots (Playwright)
* **V1.1**:
  * Asana Integration
  * Release Readiness Report
* **V1.2**
  * Visual diffs for regression detection
* **V1.5**:
  * Site Audit Full Site Crawl Mode (SE Ranking) (site-level, NOT part of Release Runs)
  * ManualTestStatus change history/audit trail
  * Per-user email notification preferences
* **Later / TBD**:
  * Marketing/analytics sanity checks (tag firing, JSON-LD)
  * Accessibility scans (WCAG baseline) for organizations needing compliance or inclusivity assurance.

[Back to top](#table-of-contents)

# Technical Stack
See technical-stack.md

[Back to top](#table-of-contents)

# Design

* [https://www.figma.com/design/YMiFr3zrjXxKxdh1olKpwo/4all--internal-?node-id=4646-106\&t=VkE5uL05QSDQcSzB-1](https://www.figma.com/design/YMiFr3zrjXxKxdh1olKpwo/4all--internal-?node-id=4646-106&t=VkE5uL05QSDQcSzB-1)

[Back to top](#table-of-contents)

# Information Architecture & UX
## Global Navigation
Persistent brand bar appears across the platform with the following navigation:

* ReleasePass (main QA area)
  * Preflight - page-level tests grouped by Release Run
  * Site Audit - site-wide crawl (SE Ranking only)
* Projects
  * Projects (list/edit)
  * Add Project
* Utilities
  * PageSpeed
  * Paste Cleaner
* Settings
  * Users (list/edit/add)
  * Preflight Rules
  * Preflight Categories

[Back to top](#table-of-contents)

## ReleasePass Workspace

### Navigation Structure
ReleasePass is the primary QA workspace with two tabs:

- **Preflight**: Page-level tests (Baseline, Performance, Spelling, Browser) organized by Release Run
- **Site Audit**: Site-wide crawl using SE Ranking API, organized by independent test runs (v1.5)

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
Allows listing and adding projects. Add/Edit form includes:
- Name, URL, sitemap, and notes
- **Optional Preflight Rules**: Checkbox list of optional rules that can be enabled for this project. Optional rules are OFF by default globally but can be turned ON per project. When enabled, these rules are included in Page Preflight tests for this project.

[Back to top](#table-of-contents)

## Utilities
Bulk Performance, HTML Cleaner, and Bullshit Tester integrated into the authenticated UI.

[Back to top](#table-of-contents)

**NOTE**: Utilities are not part of MVP scope. Detailed specifications will be added in a future version.

## Settings (Users & Companies)
List, edit and add users and companies.

**Users Tab**: Manage user accounts (name, email, company assignment, role).

**Companies Tab**: Manage company records (name, URL). System companies (e.g., "Unassigned") cannot be deleted. Deleting a company soft-deletes it and reassigns its users and projects to the "Unassigned" company.

[Back to top](#table-of-contents)

## States & Edge Cases
Empty states, no tests yet, partial failures, and manual review indicators are consistently handled.

[Back to top](#table-of-contents)

# Functional Requirements
## General
* The platform must provide a password-protected web interface using Supabase Auth with email+password login. All authenticated users are treated as admins in MVP.
* A single shared data environment is used. Companies are organizational containers but access control is not enforced in MVP (all admins see all data).
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
* **Testing infrastructure**:
  * Vitest for unit and component tests
  * React Testing Library for component testing
  * Tests co-located with source code (*.test.ts, *.test.tsx)
  * See `documentation/installation.md` Testing section for usage
* Utilities rewritten and integrated:
  * Bulk Performance
  * HTML Cleaner
  * Bullshit Tester

[Back to top](#table-of-contents)

## Release Readiness

Release Readiness is computed **per Release Run**, not from "latest tests across time". The key question is: "Is *this release* ready?"

[Back to top](#table-of-contents)

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

* **Pass threshold**: score >= 50 (configurable in `lib/scoring`)
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

### General rules:
* All primary keys are UUID strings stored in an `id` field.
* All tables include `createdAt` and `updatedAt` timestamp fields.
* Foreign key fields reference the `id` of the related entity.
* Date/time fields are stored as ISO-8601 datetimes in the database.

### Tables

* Company
  * id — UUID
  * name — string
  * url — string (nullable; company website URL)
  * isSystem — boolean (default: false; system companies like "Unassigned" cannot be deleted)
  * deletedAt — datetime (nullable; soft delete timestamp)
  * createdAt — datetime
  * updatedAt — datetime

* Project
  * id — UUID
  * companyId — UUID (FK to Company.id; required)
  * name — string
  * siteUrl — string
  * sitemapUrl — string (nullable)
  * notes — text (nullable)
  * authConfig — JSON (nullable; project-level authentication configuration)
  * deletedAt — datetime (nullable; soft delete timestamp)
  * createdAt — datetime
  * updatedAt — datetime
  * → optionalRules — one-to-many relation to ProjectOptionalRule (enabled optional rules for this project)

  **authConfig structure**:
  ```json
  {
    "mode": "NONE | BASIC_AUTH | COOKIE_HEADER",
    "username": "...",
    "password": "...",
    "cookieHeader": "..."
  }
  ```
  * `NONE` (default) — No authentication
  * `BASIC_AUTH` — HTTP Basic Auth; requires username/password
  * `COOKIE_HEADER` — Session cookie passed in Cookie header

  **Auth support by test type**:
  * Screenshots — Playwright passes auth headers/cookies
  * Linkinator — HTTP headers passed for link checking
  * Preflight — Custom rules that fetch URLs use auth headers
  * Spelling — N/A (uses Cheerio on already-fetched HTML)
  * Performance — N/A (PageSpeed API has no auth support; test runs anyway)

* Users
  * id — UUID
  * companyId — UUID (FK to Company.id; required)
  * email — string (unique)
  * firstName — string (nullable)
  * lastName — string (nullable)
  * role — string/enum (MVP: "admin" only)
  * supabaseUserId — UUID or string (links to Supabase Auth user id)
  * createdAt — datetime
  * updatedAt — datetime

  > Passwords are NOT stored in this table. Authentication credentials are managed by Supabase Auth.
  
* ReleaseRun
  * id — UUID
  * projectId — UUID (FK to Project.id)
  * name — string (nullable; optional label, e.g., "v2.1 Launch", "December Release")
  * status — enum (`PENDING`, `READY`, `FAIL`)
  * urls — JSON (frozen array of URLs to test)
  * selectedTests — JSON (array of selected page-level test types)
  * enabledOptionalRules — JSON (frozen array of enabled optional rule codes at time of creation)
  * createdAt — datetime
  * updatedAt — datetime

  ReleaseRun represents a single launch candidate tested as a cohesive unit. URLs are frozen once execution begins and cannot be modified. All TestRuns within a ReleaseRun share the same URL set. The `enabledOptionalRules` field captures a snapshot of which optional rules were enabled for the project at the time the Release Run was created, ensuring consistent test behavior even if project settings change later.

  **status field**: Indicates cancellation state (`FAIL` = cancelled by user). Release readiness (PENDING/READY/FAIL) is derived at runtime from TestRun results and ManualTestStatus, not stored. See [Release Readiness](#release-readiness-1) for computation rules. 

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

  TestRun belongs to a ReleaseRun for page-level tests. Only one TestRun per type exists within a ReleaseRun at any time. Re-running a test deletes the existing TestRun (cascading to UrlResults and ResultItems) and creates a new TestRun with QUEUED status.

  **rawPayload structure**: For multi-provider tests (e.g., PAGE_PREFLIGHT), rawPayload stores structured JSON with provider keys:
  ```json
  {
    "lighthouse": { /* full PageSpeed API response */ },
    "linkinator": { /* full link check results */ }
  }
  ```

* TestRunConfig
  * id — UUID
  * testRunId — UUID (unique FK to TestRun.id)
  * scope — enum (`SINGLE_URL`, `CUSTOM_URLS`, `SITEMAP`)
  * urls — string[] (array of URLs for CUSTOM_URLS scope; empty for SITEMAP)
  * createdAt — datetime
  * updatedAt — datetime

  TestRunConfig stores URL selection configuration for a TestRun. One-to-one relationship with TestRun.

* UrlResult
  * id — UUID
  * testRunId — UUID (FK to TestRun.id)
  * url — string
  * lcp — float (nullable; Largest Contentful Paint in seconds)
  * cls — float (nullable; Cumulative Layout Shift score)
  * inp — float (nullable; Interaction to Next Paint in ms)
  * fcp — float (nullable; First Contentful Paint in seconds)
  * tbt — float (nullable; Total Blocking Time in ms)
  * tti — float (nullable; Time to Interactive in seconds)
  * score — integer (nullable; calculated score 0-100, meaning depends on parent TestRun.type)
  * issueCount — integer (nullable; total issues for this URL)
  * criticalIssues — integer (nullable; count of CRITICAL severity issues)
  * viewport — string (nullable; "mobile" or "desktop" for Performance tests)
  * additionalMetrics — JSON (nullable; provider-specific extras)
  * error — string (nullable; if set, URL failed to process - no ResultItems created)
  * createdAt — datetime
  * updatedAt — datetime
  * → resultItems — one-to-many relation to ResultItem

  UrlResult represents per-URL/test-type metrics for a given TestRun. Fields are sparsely populated depending on the test type (e.g., Performance vs Page Preflight). Each UrlResult contains multiple ResultItems representing individual check results.

  ┌────────────────┬────────────────────────────────────────────────────┐
  │   Test Type    │                 UrlResults per URL                 │
  ├────────────────┼────────────────────────────────────────────────────┤
  │ PERFORMANCE    │ 2 (mobile + desktop)                               │
  ├────────────────┼────────────────────────────────────────────────────┤
  │ PAGE_PREFLIGHT │ 1                                                  │
  ├────────────────┼────────────────────────────────────────────────────┤
  │ SPELLING       │ 1                                                  │
  ├────────────────┼────────────────────────────────────────────────────┤
  │ SCREENSHOTS    │ 1 (screenshots stored separately in ScreenshotSet) │
  └────────────────┴────────────────────────────────────────────────────┘

* ResultItem
  * id — UUID
  * urlResultId — UUID (FK to UrlResult.id)
  * provider — enum (`LIGHTHOUSE`, `LINKINATOR`, `ReleasePass`, `SE_RANKING`, `LANGUAGETOOL`, `INTERNAL`)
  * code — string (rule code, e.g. `document-title`, `BROKEN_INTERNAL_LINK`, `PREFLIGHT_H1_MISSING`)
  * releaseRuleCode — string (nullable; FK to ReleaseRule.code, only set for rules that exist in taxonomy)
  * name — string (human-readable title of the check; fallback if no ReleaseRule)
  * status — enum (`PASS`, `FAIL`, `SKIP`)
  * severity — enum (nullable; only for FAIL status: `INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, `BLOCKER`)
  * meta — JSON (nullable; additional context such as description, selectors, raw audit data)
  * ignored — boolean (default false; user-marked as false positive)
  * createdAt — datetime
  * updatedAt — datetime

  ResultItem stores all check results (both passing and failing) from test providers. Each ResultItem belongs to a UrlResult, representing a single audit/check that was run for that URL. When `releaseRuleCode` is set, the ResultItem links to a ReleaseRule for consistent metadata.

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
  * **INFO** — 0 points (informational, no score penalty)

  **Providers**:
  * `LIGHTHOUSE` — PageSpeed SEO audits
  * `LINKINATOR` — Link checking
  * `ReleasePass` — Custom validation rules defined in ReleaseRule taxonomy
  * `LANGUAGETOOL` — Spelling/grammar checks
  * `SE_RANKING` — Full site crawl (v1.5)
  * `INTERNAL` — System-generated checks

* ReleaseRuleCategory
  * id — UUID
  * name — string (unique; e.g., "Heading Structure", "Canonical", "Links")
  * description — string (nullable; optional description of the category)
  * sortOrder — integer (default 0; display order in UI)
  * isActive — boolean (default true; soft enable/disable)
  * createdAt — datetime
  * updatedAt — datetime

  ReleaseRuleCategory groups related ReleaseRules for display in the UI. Categories can be reordered and disabled without deleting.

* ReleaseRule
  * code — string (primary key; e.g., `PREFLIGHT_H1_MISSING`, `document-title`)
  * provider — enum (`LIGHTHOUSE`, `LINKINATOR`, `ReleasePass`, `SE_RANKING`, `LANGUAGETOOL`, `INTERNAL`)
  * categoryId — UUID (FK to ReleaseRuleCategory.id)
  * name — string (short title, e.g., "Missing H1 Heading")
  * description — string (what the rule checks for)
  * severity — enum (`INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, `BLOCKER`; default severity)
  * impact — string (nullable; why this issue matters)
  * fix — string (nullable; how to fix the issue)
  * docUrl — string (nullable; external documentation link)
  * isActive — boolean (default true; soft enable/disable)
  * isOptional — boolean (default false; optional rules are OFF by default per project)
  * sortOrder — integer (default 0; display order within category)
  * createdAt — datetime
  * updatedAt — datetime

  ReleaseRule defines the taxonomy of all check rules. Each rule has a unique code used as the primary key. ResultItems link to ReleaseRules via `releaseRuleCode` to inherit consistent metadata (name, description, severity, etc.). Rules can be customized per-deployment.

  **Optional Rules**: Rules with `isOptional = true` are disabled by default and must be explicitly enabled per project via the ProjectOptionalRule table. Optional rules address edge cases or project-specific requirements that don't apply universally (e.g., requiring external links to open in new tabs).

* ProjectOptionalRule
  * id — UUID
  * projectId — UUID (FK to Project.id)
  * ruleCode — string (FK to ReleaseRule.code)
  * enabled — boolean (default true)
  * createdAt — datetime
  * updatedAt — datetime

  ProjectOptionalRule tracks which optional rules are enabled for a specific project. Only rules with `ReleaseRule.isOptional = true` should have entries in this table. When a project enables an optional rule, a record is created here.

  **Unique constraint**: One record per (projectId, ruleCode) combination.

* IgnoredRule
  * id — UUID
  * projectId — UUID (FK to Project.id)
  * url — string (the URL this ignore applies to)
  * code — string (the rule code to ignore, e.g., `document-title`)
  * createdAt — datetime

  IgnoredRule tracks which rules have been marked as false positives for specific URLs within a project. When a new test run processes a URL, matching IgnoredRules are auto-applied to set `ResultItem.ignored = true`.

  **Unique constraint**: One ignore per (projectId, url, code) combination.

Release Readiness itself is a derived object computed at runtime **per Release Run** from:
* All TestRuns within the Release Run (score >= 50 = pass), and
* ResultItem severity levels (BLOCKER items heavily penalize score), and
* ManualTestStatus entries for that Release Run.

No dedicated `Readiness` table is required in MVP.

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

  Required additions:
  * Platform
  * Browser (e.g., Chrome, Safari)
  * Capture metadata:
    * Timing info
    * Stabilization flags applied

* ManualTestStatus
  * id — UUID
  * releaseRunId — UUID (FK to ReleaseRun.id)
  * projectId — UUID (FK to Projects.id)
  * testType — enum (`SCREENSHOTS`, `SPELLING`)
  * statusLabel — enum (`PASS`, `REVIEW`, `FAIL`)
  * updatedByUserId — UUID (FK to Users.id)
  * createdAt — datetime
  * updatedAt — datetime

  ManualTestStatus stores user-entered status decisions for tests that do not have a numeric score (Screenshots). These statuses are scoped to a specific Release Run and contribute to that Release Run's readiness status.

* ManualUrlResult
  * Stub - will replace ManualTestStatus

[Back to top](#table-of-contents)

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
- **Tests per URL**: Each URL is tested for both mobile and desktop viewports
- **Field data**: Uses lab metrics only (CrUX field data may not be available for all URLs, especially staging sites)
- **Scoring**: MVP uses **average performance score** across all tested URLs

**Screenshots**:
- **Scope**: Uses frozen URL list from Release Run
- **Configuration**: URLs come from the Release Run's frozen URL list
- **Viewport matrix** (MVP fixed configuration):
  - Desktop / Chrome (13660px width)
  - Desktop / Safari (1366px width)
  - Tablet / iOS Safari (768px width) (v1.1)
  - Mobile / iOS Safari (390px width)
- **Capture mode**: Full-page screenshots
~~- **Authentication**: Not supported in MVP~~

**Spelling/Grammar**:
- **Scope**: Uses frozen URL list from Release Run
- **Configuration**: URLs come from the Release Run's frozen URL list
- **Text extraction**: Uses ~~Playwright~~ Cheerio to render page and extract visible text from final DOM
- **Content filtering**: Extracts text content only; filters out navigation, hidden elements (subject to refinement during implementation)
- **Batching**: Large pages split into batches for LanguageTool API (max batch size TBD based on API limits)
- **JavaScript rendering**: Supported (Playwright waits for page load)
~~- **Authentication**: Not supported in MVP~~

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
* **Optional Rules**: Some custom rules are marked as optional (`isOptional = true` in ReleaseRule). These rules are disabled by default and must be enabled per project via project settings. When creating a Release Run, enabled optional rules are snapshotted to ensure consistent test behavior. Examples include:
  * `PREFLIGHT_EXTERNAL_LINK_TARGET` - External links should open in new tab
  * `PREFLIGHT_INLINE_CSS` - Detect inline style attributes on elements
  * `IMAGE_TITLE_AUTOGENERATED` - Image title appears auto-generated from filename or generic placeholder (detects CMS-generated junk titles)

**Scoring for Page Preflight**:
* Base score: 100 points
* Deductions per failed item (based on severity):
  * BLOCKER: -40 points (e.g., broken internal links, page not crawlable)
  * CRITICAL: -20 points (e.g., missing title, meta description)
  * HIGH: -10 points (e.g., missing canonical)
  * MEDIUM: -5 points (e.g., external broken links)
  * LOW: -2 points (e.g., redirect chains)
* Pass threshold: score >= 50 (configurable in `lib/scoring`)
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
* Purpose: Capture high-fidelity screenshots across tight browser set for rendering verification.
* Part of Release Runs with frozen URL lists
* Manual review required (PASS / REVIEW / FAIL)
* Screenshots contribute to Release Readiness via manual status.
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

#### Screenshot Stabilization  
Stablization required for reliability.
* Disable CSS animations and transitions.  
* Hide cursor and blinking carets.
* Wait for fonts to load (document.fonts.ready where supported).
* Wait for DOM ready \+ network idle (with max timeout).
* Support project-defined selectors to hide dynamic UI:
  * Cookie banners
  * Chat widgets
  * Rotating promos
  * Geo/location banners

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

[Back to top](#table-of-contents)

## Version 1.1

### Asana Integration
* Scope:
  * Preflight: Failure only to Asana based on ResultItem
  * Performance: Low score (mobile or desktop) create Asana ticket
  * Screenshot: Per screenshot (desktop 2x, tablet, mobile)
  * Spelling: Omit?

### Release Readiness Report
* Scope: 1 Page client-facing PDF Release Readiness Report based on all tests

### Screenshots
* Scope: Add Safari Tablet (768)

[Back to top](#table-of-contents)

## Version 1.2

### Visual Quality — Diffs (Visual Regression Testing)

* Purpose: Compare current vs baseline screenshots to detect unintended visual changes.
* Solution Options:
  * Primary: LambdaTest SmartUI (AI/heuristic noise reduction)
  * Secondary: Resemble.js (perceptual tolerance)
* Process: Fetch baseline → capture new → compare → output diff image \+ mismatch %.
* Noise Control: Ignore masks/dynamic regions, threshold tuning.

[Back to top](#table-of-contents)

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

[Back to top](#table-of-contents)
