# Technical Stack

## Overview

The QA Platform will be built as a modern web application using **Next.js** for the frontend and API layer, with **Supabase** providing the managed PostgreSQL database, authentication, and object storage. **Prisma** will be used as the ORM and schema layer on top of Supabase’s PostgreSQL. A separate background **worker service** will handle long-running test orchestration and external API calls.

The stack is designed to:

* Ship an MVP quickly
* Maintain a clean, versioned data model
* Handle background work safely (job locking, retries, dead letters)
* Provide basic observability from day one
* Stay flexible for future scaling and feature expansion

## Frontend & API Application

* **Framework:** Next.js (App Router)
* **Language:** TypeScript (project-wide), with relaxed strictness initially to ease development
* **Deployment:** Vercel
* **Styling:**
    * Tailwind CSS \+ PostCSS
    * Aligns with the existing marketing site (Astro \+ Tailwind)

**Responsibilities:**

* Admin UI for:
    * Managing projects
    * Triggering tests
    * Viewing test run history and issues
    * Accessing rewritten utilities (Bulk Performance, HTML Cleaner, “Bullshit Tester”)

* API layer via Next.js Route Handlers:
    * CRUD endpoints for core entities (Projects, TestRuns, Issues, ScreenshotSets)
    * Endpoints to enqueue new test runs
    * Endpoints to fetch normalized test results for the UI

The app will use shared TypeScript types for core domain entities (e.g., Project, TestRun, Issue, ScreenshotSet) but will not enforce fully strict typing at MVP, to reduce friction while still gaining type safety benefits.

## Database & ORM

* **Database Provider:** Supabase (managed **PostgreSQL**)
* **ORM / Schema:** **Prisma**

**Key points:**

* A central `schema.prisma` file will define:
    * Users
    * Projects
    * TestRuns
    * UrlResults
    * Issues
    * ScreenshotSets
    * Any future entities (e.g., Companies, Environments)

* **Prisma Migrate** will manage schema changes and keep development, staging, and production synchronized.

* **Prisma Client** will be used in both:
    * The Next.js application (API routes)
    * The worker service (test orchestration and persistence)

This ensures a single, versioned source of truth for the data model and consistent database access across the system.

## Authentication & Authorization

* **Auth Provider:** Supabase Auth
* **MVP Login Flow:**
    * Email \+ password for internal admin users

* **Role Model (MVP):**
    * All authenticated users are treated as admins with access to all projects and test runs (single “bucket” of data)

* **Future Extensions:**
    * Additional roles (e.g., read-only)
    * Company → Project → User relationships for multi-tenant client access

The application will maintain its own `User` table linked to Supabase Auth users, including a `role` field for future authorization logic.

## File Storage (Screenshots & Assets)

* **Provider:** Supabase Storage (S3-compatible)
* **Usage:**
    * Store screenshots captured during visual QA tests
    * Organize assets by project, test run, viewport/device, and URL

* **Retention Rules (MVP):**
    * Only **current** and **previous** screenshot sets per project are retained
    * Older screenshot objects are cleaned up by the worker as part of test completion

Database records will store the storage keys/paths for screenshots, and the app will use signed URLs or public paths (depending on configuration) to render images in the UI.

## Background Worker & Job Processing

**Worker Service:**

* Separate Node.js \+ TypeScript application
* Deployed on a container-friendly platform (e.g., Railway, Fly.io, Render)
* Uses Prisma to connect to the same Supabase PostgreSQL database

**Job Model & Locking:**

* Test runs are represented as rows in the `TestRun` table with a `status` field (e.g., `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `PARTIAL`).

* The worker **atomically claims jobs** using row-level locking or transactional updates:
    * Selects the next `QUEUED` test run
    * Updates its status to `RUNNING` in a single atomic operation
    * Ensures that only one worker can process a given job (proper job locking)

* If a test run exceeds a defined time window or encounters repeated failures, it is:
    * Marked as `FAILED`
    * Optionally moved into a “dead letter” state (e.g., via a retry counter) for diagnosis

**Responsibilities:**

* Orchestrate external test providers:
    * Site Audit (e.g., SE Ranking)
    * Performance (PageSpeed API)
    * Screenshots (LambdaTest / Playwright API)
    * Spelling/grammar (LanguageTool, in a later version)

* Normalize external results into:
    * URL-level metrics (UrlResults)
    * Issue records (Issues)
    * Screenshot metadata (ScreenshotSets)

* Store a **small raw JSON payload** per test run for debugging (e.g., latest vendor response)

* Enforce retention policies for:
    * Test history (current \+ previous run per project for MVP)
    * Screenshot assets (current \+ previous only)

## Handling External API Failures

External APIs are treated as independent providers within a test run. For each provider:

* **Retry Policy**
    * Transient errors (e.g., network errors, 5xx responses) are retried a limited number of times with backoff.
    * Hard errors (e.g., 4xx auth issues, invalid input, exhausted quotas) fail immediately with a clear error reason.

* **TestRun Status Semantics:**
    * If all providers succeed → `status = SUCCESS`
    * If some providers succeed and some fail → `status = PARTIAL`
    * If all providers fail → `status = FAILED`

* **User-facing Behavior:**
    * The UI will display per-provider status within a test run (success, error, skipped) so internal users can see what worked and what failed.
    * The raw error context (status codes, messages) is captured for debugging but surfaced in a simplified way to the user.

This approach avoids throwing away successful work and provides clear visibility into partial results.

## Logging

Basic observability will be implemented from the beginning to support debugging and operations.

* **Error Tracking:**
    * Use a hosted error tracking service (e.g., Sentry) on a free plan, configured for:
        * Next.js application errors
        * Worker service errors

* **Logging:**
    * Structured console logs from both app and worker, including key fields such as:
        * `projectId`
        * `testRunId`
        * `provider` (e.g., `audit`, `performance`, `screenshots`)
        * `status` and `duration`
    * Rely on platform log views (Vercel, worker host) initially; a dedicated log aggregator can be added later if needed.

* **Timeouts & Safeguards:**
    * Worker will enforce a maximum allowed processing time per test run, and mark overdue runs as `FAILED` with a timeout error.

This level of observability is intentionally lightweight for MVP but establishes patterns that can be extended with dashboards and metrics in later versions.

## Email Notifications

* **Provider:** Transactional email service (e.g., Resend or Postmark) on a free or low-cost plan.

* **Trigger:** The background worker sends an email when a `TestRun` transitions to a terminal state:
    * `SUCCESS`
    * `PARTIAL`
    * `FAILED`

* **Recipients (MVP):**
    * All admin users, or a configurable internal list (e.g., a QA team alias).

* **Content:**
    * Project name and domain
    * Test type(s) included in the run (Audit, Performance, Screenshots)
    * Overall status (Success / Partial / Failed)

    * High-level summary (e.g., “3 providers succeeded, 1 failed: SE Ranking API error”)
    * A direct link to the Test Run detail page in the app

* **Implementation:**
    * Worker calls the email provider’s API after updating the `TestRun` status.
    * Failures to send notifications are logged but do not affect the test result itself.
