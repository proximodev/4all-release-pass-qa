# QA Platform – Supabase & Prisma Technical Setup

This guide takes you from a blank Supabase project to a working schema and integration for the QA Platform, aligned with the functional specification and agreed technical stack.

---

## 0. High-Level Architecture & Responsibilities

- **Next.js app (Vercel)**
  - Admin UI
  - API routes (`app/api/...`)
  - Handles Supabase Auth + sessions
  - Reads/writes via Prisma

- **Supabase**
  - Postgres (primary DB)
  - Auth (email + password)
  - Storage (screenshots bucket)

- **Worker service (Node + TS)**
  - Connects to same Supabase Postgres via Prisma
  - Claims `TestRun` jobs and updates status (`QUEUED → RUNNING → SUCCESS / FAILED / PARTIAL`)
  - Calls external providers (SE Ranking, PageSpeed, Playwright stack, LanguageTool in scope)
  - Enforces retention rules and sends email notifications

- **Data model**
  - UUID primary keys in `id` for all entities
  - `createdAt` / `updatedAt` timestamps on all tables
  - Schema: `Company`, `Project`, `User`, `TestRun`, `UrlResult`, `Issue`, `ScreenshotSet`, `ManualTestStatus`

---

## 1. Supabase Project Setup

### 1.1 Create Supabase Project

1. Go to Supabase, create a new project.
2. Capture and store securely:
   - **Project URL**
   - **Anon key**
   - **Service role key**
   - **Database connection string (Node / URI)**

You’ll use the DB connection string as `DATABASE_URL` for Prisma.

### 1.2 Database Extensions & UUID Defaults

We want **UUID** primary keys with server-side generation (`gen_random_uuid()`).

In the Supabase SQL editor, run:

```sql
-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

Prisma will use `dbgenerated("gen_random_uuid()")` for defaults, which maps cleanly to this.

### 1.3 Auth Configuration

The MVP uses **email + password** for internal admins. All authenticated users are effectively admins and can see all data.

In the Supabase dashboard:

1. Enable **Email + Password** in Authentication → Providers.
2. Set redirect URLs for:
   - Local: `http://localhost:3000`
   - Production: your Vercel domain(s)
3. **Disable open signups**.
   - Use admin invitations only, or manually create users in Supabase Auth.
4. Note that:
   - Supabase owns `auth.users`.
   - Our app owns a `User` table linked via `supabaseUserId` (UUID string referencing `auth.users.id`).

### 1.4 Storage Configuration (Screenshots)

1. In Storage, create a bucket: **`qa-screenshots`**.
2. Set bucket to **private**.
3. Plan of use:
   - **Worker** uploads screenshots to this bucket and sets a `storageKey` in `ScreenshotSet`.
   - **App** retrieves signed URLs via Supabase client for UI display.

Keep this bucket strictly screenshots; other assets can use separate buckets later.

### 1.5 Environment Variables

In your Next.js project, create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...        # From Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # From Supabase

SUPABASE_SERVICE_ROLE_KEY=...       # For backend-only usage (NEVER expose client-side)
DATABASE_URL=postgres://...
# e.g. postgres://postgres:password@db.hash.supabase.co:5432/postgres

# Email provider (example)
EMAIL_PROVIDER_API_KEY=...
EMAIL_FROM=qa-bot@example.com
```

For the **worker service**, create `.env` (or similar):

```bash
DATABASE_URL=postgres://...         # Same DB, but separate process
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_URL=...
PAGE_SPEED_API_KEY=...
SE_RANKING_API_KEY=...
LANGUAGETOOL_API_KEY=...
LAMBDA_TEST_API_KEY=...
EMAIL_PROVIDER_API_KEY=...
EMAIL_FROM=qa-bot@example.com
```

---

## 2. Next.js + Prisma Base Setup

### 2.1 Create Next.js App (App Router)

```bash
npx create-next-app@latest qa-platform
```

Choose:

- TypeScript: **Yes**
- App Router: **Yes**
- Tailwind: **Yes**

### 2.2 Install Prisma + Supabase Client

```bash
cd qa-platform

npm install prisma @prisma/client @supabase/supabase-js
npx prisma init
```

Update `prisma/schema.prisma` datasource + generator:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

---

## 3. Prisma Data Model

This is the canonical schema that implements the functional spec’s entities, enums, and rules.

> All IDs are `String` in Prisma, stored as `UUID` in Postgres with `gen_random_uuid()` defaults.

Replace the contents of `prisma/schema.prisma` with:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

/// ---- ENUMS ----

enum UserRole {
  ADMIN
}

enum TestType {
  SITE_AUDIT
  PERFORMANCE
  SCREENSHOTS
  SPELLING
}

enum TestStatus {
  QUEUED
  RUNNING
  SUCCESS
  FAILED
  PARTIAL
}

enum TestScope {
  SINGLE_URL
  CUSTOM_URLS
  SITEMAP
}

enum IssueProvider {
  SE_RANKING
  LANGUAGETOOL
  INTERNAL
}

enum IssueSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ScreenshotRole {
  CURRENT
  PREVIOUS
  BASELINE
}

enum ManualTestType {
  SCREENSHOTS
  SPELLING
}

enum ManualStatusLabel {
  PASS
  REVIEW
  FAIL
}

/// ---- CORE ENTITIES ----

model Company {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String

  projects  Project[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Project {
  id           String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId    String?            @db.Uuid
  name         String
  siteUrl      String
  sitemapUrl   String?
  notes        String?

  company      Company?           @relation(fields: [companyId], references: [id])
  testRuns     TestRun[]
  screenshotSets ScreenshotSet[]
  manualStatuses ManualTestStatus[]

  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  @@index([companyId])
  @@index([siteUrl])
}

model User {
  id              String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email           String             @unique
  firstName       String?
  lastName        String?
  role            UserRole           @default(ADMIN)
  supabaseUserId  String             @db.Uuid

  manualTestStatuses ManualTestStatus[] @relation("ManualStatusUpdatedBy")

  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  @@index([supabaseUserId])
}

model TestRun {
  id            String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId     String      @db.Uuid
  type          TestType
  status        TestStatus  @default(QUEUED)
  score         Int?        // 0-100 for Site Audit & Performance, null for Screenshots/Spelling
  startedAt     DateTime?
  finishedAt    DateTime?
  lastHeartbeat DateTime?   // Worker updates every 30s to detect stuck runs
  rawPayload    Json?
  error         String?

  project        Project          @relation(fields: [projectId], references: [id])
  urlResults     UrlResult[]
  issues         Issue[]
  screenshotSets ScreenshotSet[]
  config         TestRunConfig?

  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  @@index([projectId, type, createdAt])
  @@index([status, createdAt])
}

model TestRunConfig {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  testRunId   String    @unique @db.Uuid
  scope       TestScope
  urls        String[]  // Array of URLs for CUSTOM_URLS, empty for SITEMAP

  testRun     TestRun   @relation(fields: [testRunId], references: [id], onDelete: Cascade)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([testRunId])
}

model UrlResult {
  id                 String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  testRunId          String     @db.Uuid
  url                String

  // Core Web Vitals (Performance only)
  lcp                Float?     // Largest Contentful Paint (seconds)
  cls                Float?     // Cumulative Layout Shift (score)
  inp                Float?     // Interaction to Next Paint (ms)
  fcp                Float?     // First Contentful Paint (seconds)
  tbt                Float?     // Total Blocking Time (ms)
  tti                Float?     // Time to Interactive (seconds)

  // Scores
  performanceScore   Int?       // PageSpeed performance score (0-100)
  accessibilityScore Int?       // Lighthouse accessibility score (0-100)

  // Site Audit specific
  issueCount         Int?       // Total issues for this URL
  criticalIssues     Int?       // Count of CRITICAL severity issues

  // Viewport/device (for Performance tests)
  viewport           String?    // "mobile" or "desktop"

  // Raw data
  additionalMetrics  Json?      // Provider-specific extras

  testRun            TestRun    @relation(fields: [testRunId], references: [id], onDelete: Cascade)

  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  @@index([testRunId])
  @@index([url])
  @@index([performanceScore])
}

model Issue {
  id        String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  testRunId String         @db.Uuid
  url       String
  provider  IssueProvider
  code      String
  summary   String
  severity  IssueSeverity
  meta      Json?

  testRun   TestRun        @relation(fields: [testRunId], references: [id], onDelete: Cascade)

  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  @@index([testRunId])
  @@index([provider])
  @@index([severity])
  @@index([url])
}

model ScreenshotSet {
  id         String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  testRunId  String         @db.Uuid
  projectId  String         @db.Uuid
  url        String
  viewport   String
  storageKey String
  role       ScreenshotRole

  testRun    TestRun        @relation(fields: [testRunId], references: [id], onDelete: Cascade)
  project    Project        @relation(fields: [projectId], references: [id])

  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  @@index([projectId])
  @@index([testRunId])
  @@index([url])
  @@index([role])
}

model ManualTestStatus {
  id              String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId       String           @db.Uuid
  testType        ManualTestType
  statusLabel     ManualStatusLabel
  updatedByUserId String           @db.Uuid

  project         Project          @relation(fields: [projectId], references: [id])
  updatedBy       User             @relation("ManualStatusUpdatedBy", fields: [updatedByUserId], references: [id])

  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([projectId, testType])
  @@index([updatedByUserId])
}
```

### 3.1 Run Initial Migration

From the project root:

```bash
npx prisma migrate dev --name init_core_schema
```

For CI/production:

```bash
npx prisma migrate deploy
```

---

## 4. Prisma Client Helper (Next.js)

Create `lib/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

Usage in route handlers (e.g., `app/api/test-db/route.ts`):

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const projects = await prisma.project.findMany();
  return NextResponse.json({ ok: true, count: projects.length });
}
```

---

## 5. Supabase Auth + User Sync

The app uses **Supabase Auth** for login and a **Prisma `User` record** to store metadata/roles.

### 5.1 Install Auth Helpers

```bash
npm install @supabase/auth-helpers-nextjs
```

Set up a Supabase client in `lib/supabaseClient.ts` (server-safe usage per auth-helpers docs).

### 5.2 Login Flow

1. User logs in via Supabase (e.g., `/login` form calling Supabase Auth).
2. On successful session, call an internal API route that:
   - Reads `user.id` and `user.email` from Supabase.
   - Upserts a `User` record:

```ts
import { prisma } from '@/lib/prisma';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  await prisma.user.upsert({
    where: { supabaseUserId: user.id },
    update: {
      email: user.email ?? '',
    },
    create: {
      email: user.email ?? '',
      supabaseUserId: user.id,
      role: 'ADMIN', // MVP: everyone is admin
    },
  });

  return new Response('ok');
}
```

In MVP, **role checks are trivial**: if you’re logged in, you’re an admin.

---

## 6. Test Lifecycle & Retention Rules

The functional spec defines:

- Test lifecycle: `QUEUED → RUNNING → SUCCESS / FAILED / PARTIAL`
- Retention:
  - Test history: current + previous run per test type
  - Screenshots: current + previous only
  - Raw API payloads: two most recent per test type

We implement these as **worker responsibilities**, not extra tables.

### 6.1 TestRun Lifecycle

- **Create**: UI enqueues a new test by creating a `TestRun` with:
  - `status = QUEUED`
  - `projectId`, `type`, timestamps null

- **Worker processing:**
  - Claims a job atomically.
  - Sets `status = RUNNING`, `startedAt = now()`.
  - Runs providers (Site Audit / Performance / Screenshots / Spelling).
  - On completion:
    - Sets `status` to `SUCCESS`, `FAILED`, or `PARTIAL`.
    - Sets `finishedAt = now()`.
    - Stores a small `rawPayload` JSON (or provider-specific subset) on the latest runs only.

### 6.2 Retention Strategy (Worker)

For each `(projectId, type)`:

1. **Test history**
   - Keep the **two most recent** `TestRun` rows (by `createdAt`).
   - Delete older `TestRun`s and all related `UrlResult`, `Issue`, `ScreenshotSet` rows.

2. **Screenshots**
   - For the two newest runs, keep `ScreenshotSet` rows with `role = CURRENT` and `PREVIOUS`.
   - Delete screenshot DB rows and storage objects for older runs / roles.

3. **Raw payloads**
   - Only the two most recent runs per type keep `rawPayload` populated.
   - For older runs, the worker should null out `rawPayload` if the run is retained for some reason.

---

## 7. Worker Service & Atomic Job Locking

The worker is a separate Node + TypeScript app that uses **the same Prisma schema**.

### 7.1 Worker Project Skeleton

```bash
mkdir qa-worker
cd qa-worker
npm init -y
npm install typescript ts-node prisma @prisma/client
npx prisma init
```

Copy or share the **same** `schema.prisma` (via a shared package or manual sync). Set `DATABASE_URL` in worker `.env`.

Generate client:

```bash
npx prisma generate
```

### 7.2 Atomic Job Claiming

The core pattern (simplified):

```ts
import { PrismaClient, TestStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function claimNextQueuedRun() {
  return prisma.$transaction(async (tx) => {
    const run = await tx.testRun.findFirst({
      where: { status: TestStatus.QUEUED },
      orderBy: { createdAt: 'asc' },
      lock: { mode: 'update' }, // if supported; otherwise emulate with compare-and-set
    });

    if (!run) return null;

    const updated = await tx.testRun.update({
      where: { id: run.id },
      data: {
        status: TestStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    return updated;
  });
}
```

If row-level locking via Prisma isn’t available in your version, you can emulate with a “compare-and-set” update (`where: { id, status: QUEUED }` and check `count`).

### 7.3 Provider Orchestration & Status

For each `TestRun`:

- Run providers for the `type`:
  - `SITE_AUDIT` → SE Ranking
  - `PERFORMANCE` → PageSpeed
  - `SCREENSHOTS` → Playwright/LambdaTest
  - `SPELLING` → LanguageTool
- Evaluate provider results:
  - All succeed → `SUCCESS`
  - Some succeed, some fail → `PARTIAL`
  - All fail → `FAILED`

Write metrics and issues to:

- `UrlResult` (per URL metrics)
- `Issue` (normalized issues)
- `ScreenshotSet` (screenshot metadata)

Finally, enforce **retention**, update `finishedAt`, and trigger email notifications.

---

## 8. Release Readiness Computation (Derived, Not Stored)

Release Readiness is computed at runtime, not stored in a table.

### 8.1 Inputs

For a given `projectId`:

1. Latest completed `TestRun` per `TestType` (ignore `QUEUED`/`RUNNING`).
2. `ManualTestStatus` entries for:
   - `SCREENSHOTS`
   - `SPELLING`

### 8.2 Example Query Shape (Server-Side)

```ts
import { prisma } from '@/lib/prisma';
import { TestType, TestStatus, ManualTestType } from '@prisma/client';

export async function getReleaseReadiness(projectId: string) {
  const runs = await prisma.testRun.groupBy({
    by: ['type'],
    where: {
      projectId,
      status: { in: [TestStatus.SUCCESS, TestStatus.FAILED, TestStatus.PARTIAL] },
    },
    _max: { createdAt: true },
  });

  const latestRuns = await prisma.testRun.findMany({
    where: {
      projectId,
      OR: runs.map((r) => ({
        type: r.type,
        createdAt: r._max.createdAt!,
      })),
    },
    include: {
      urlResults: true,
      issues: true,
    },
  });

  const manualStatuses = await prisma.manualTestStatus.findMany({
    where: {
      projectId,
      testType: { in: [ManualTestType.SCREENSHOTS, ManualTestType.SPELLING] },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Map to your readiness model (numeric scores + manual labels + colors)
  return buildReadinessObject(latestRuns, manualStatuses);
}
```

Key rule: you never persist Release Readiness; you recompute it whenever the UI needs it or a test completes.

---

## 9. Basic App Flows with Prisma

### 9.1 Create & List Projects

- `/projects` → list all `Project`s.
- `/projects/add` → create new project (name, `siteUrl`, `sitemapUrl`, `notes`).

Route handler example:

```ts
// app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const body = await request.json();
  const project = await prisma.project.create({
    data: {
      name: body.name,
      siteUrl: body.siteUrl,
      sitemapUrl: body.sitemapUrl || null,
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ project });
}
```

### 9.2 Enqueue a Test Run

When the user hits “Start Test” in the UI for a project + test type:

```ts
// app/api/projects/[projectId]/test-runs/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TestType, TestStatus } from '@prisma/client';

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const body = await request.json();
  const { type } = body as { type: TestType };

  const run = await prisma.testRun.create({
    data: {
      projectId: params.projectId,
      type,
      status: TestStatus.QUEUED,
    },
  });

  return NextResponse.json({ run });
}
```

The worker periodically polls for `QUEUED` runs and processes them.

---

## 10. Deployment Notes

### 10.1 Next.js App (Vercel)

- Set environment variables in Vercel’s dashboard:
  - `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.
- On build:
  - `npx prisma generate` runs automatically via `@prisma/client`.
- On deploy:
  - Run `npx prisma migrate deploy` as part of a CI step or a post-deploy step targeting the Supabase DB.

### 10.2 Worker Service

- Deploy to a container hosting platform (Railway, Fly.io, Render, etc.).
- Set the same `DATABASE_URL` and Supabase/API keys.
- CI flow:
  - Run `npx prisma generate`.
  - Run `npx prisma migrate deploy` (once per environment) **before** starting the worker.
- Worker process:
  - A simple loop with backoff:
    - Claim job → process → sleep → repeat.

---

## 11. Scope & Next Docs

This guide covers:

- Supabase project, auth, storage setup
- Environment variables for app + worker
- Full Prisma schema aligned with the functional spec
- Test lifecycle, retention logic, and Release Readiness strategy (derived, not stored)
- Worker architecture (atomic job locking, provider orchestration)
- Basic flows for projects and test runs

Recommended next docs (separate files):

- Provider-specific integration guides (SE Ranking, PageSpeed, Playwright/LambdaTest, LanguageTool)
- Email notification formatting + config
- Detailed Release Readiness scoring rules (numeric thresholds, color mapping) layered on top of this schema
