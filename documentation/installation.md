# ReleasePass MVP: Installation Guide

This guide will walk you through setting up the ReleasePass platform from scratch.

---

## Release Run Model Changes (December 2025)

> **Important for existing installations**: If you have an existing database, see the [Migration from Previous Schema](#migration-from-previous-schema) section before proceeding.

The ReleasePass platform now uses a **Release Run model** where tests are grouped into cohesive launch candidates. This introduces several schema changes:

### New Tables

| Table | Purpose |
|-------|---------|
| `ReleaseRun` | Frozen snapshot representing a single launch candidate. Contains URL list, selected tests, and status (PENDING/READY/FAIL). |

### Modified Tables

| Table | Changes |
|-------|---------|
| `TestRun` | Added `releaseRunId` (FK to ReleaseRun, nullable for site-level tests). Updated `type` enum to include `PAGE_PREFLIGHT`. |
| `Issue` | Added `impact` field (enum: `BLOCKER`, `WARNING`, `INFO`) to determine effect on release readiness. |
| `ManualTestStatus` | Added `releaseRunId` (FK to ReleaseRun) to scope manual reviews to specific Release Runs. |
| `IssueProvider` enum | Added `LIGHTHOUSE`, `LINKINATOR`, `CUSTOM_RULE` values for Page Preflight providers. |

### New Enums

| Enum | Values | Purpose |
|------|--------|---------|
| `ReleaseRunStatus` | `PENDING`, `READY`, `FAIL` | Release Run readiness status |
| `IssueImpact` | `BLOCKER`, `WARNING`, `INFO` | Issue effect on release readiness |

### Key Behavioral Changes

- **Release Readiness** is now computed **per Release Run**, not from "latest tests across time"
- **URLs are frozen** once a Release Run begins execution
- **Page-level tests** (Page Preflight, Performance, Screenshots, Spelling) belong to Release Runs
- **Site-level tests** (Site Audit Full Crawl) run independently of Release Runs
- **BLOCKER issues** cause the Release Run status to be FAIL

---

## Migration from Previous Schema

If you have an existing ReleasePass database from before the Release Run model, follow these steps:

### Step 1: Backup Your Database

```bash
# Using pg_dump (replace with your connection details)
pg_dump -h db.your-project-id.supabase.co -U postgres -d postgres > backup_before_release_run.sql
```

### Step 2: Create Migration File

Create a new migration to add the Release Run model:

```bash
npx prisma migrate dev --name add_release_run_model
```

### Step 3: Data Migration Strategy

**Option A: Fresh Start (Recommended for MVP)**
- If you have minimal test data, simply delete existing TestRun records
- New tests will be created within Release Runs going forward

**Option B: Migrate Existing Data**
- Create a ReleaseRun for each unique (projectId, date) combination
- Update TestRun.releaseRunId to point to the corresponding ReleaseRun
- Update ManualTestStatus.releaseRunId similarly
- Set default `impact` values on existing Issues (e.g., map CRITICAL severity to BLOCKER)

```sql
-- Example: Set default impact based on severity for existing issues
UPDATE "Issue"
SET impact = CASE
  WHEN severity = 'CRITICAL' THEN 'BLOCKER'
  WHEN severity = 'HIGH' THEN 'WARNING'
  ELSE 'INFO'
END
WHERE impact IS NULL;
```

### Step 4: Verify Migration

```bash
npx prisma studio
```

Check that:
- ReleaseRun table exists with correct columns
- TestRun has releaseRunId column
- Issue has impact column
- ManualTestStatus has releaseRunId column

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** 18.x or later ([Download](https://nodejs.org/))
- **npm** 9.x or later (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- A **Supabase account** ([Sign up](https://supabase.com/))

---

## Phase 1.1: Project Initialization

### Step 1: Create Next.js Project

```bash
# Create the Next.js application
npx create-next-app@latest 4all-release-pass-qa
```

**When prompted, choose these options:**
- ✅ TypeScript: **Yes**
- ✅ ESLint: **Yes**
- ✅ Tailwind CSS: **Yes**
- ✅ `src/` directory: **No**
- ✅ App Router: **Yes**
- ✅ Import alias (@/*): **Yes**

```bash
# Navigate into the project
cd 4all-release-pass-qa
```

---

### Step 2: Set Up Supabase Project

1. **Go to [supabase.com](https://supabase.com/)** and sign in
2. **Click "New Project"**
3. **Fill in project details:**
   - Project name: `releasepass-qa` (or your choice)
   - Database password: Generate a strong password (save this!)
   - Region: Choose closest to you
   - Pricing plan: Free tier is fine for MVP

4. **Wait for project to initialize** (takes ~2 minutes)

5. **Collect your credentials:**

   **API Keys** (Go to **Project Settings → API**):
   - Copy `Project URL`
   - Copy `anon public` key (may be listed under "Legacy anon, service_role API keys" - this is correct)
   - Copy `service_role` key (click "Reveal" to see it - also under Legacy keys section)

   **Database Connection String** (Go to **Project Settings → Database**):
   - Scroll down to the "Connection String" section
   - Select the **URI** tab (for Node.js/Prisma)
   - Copy the connection string
   - Replace `[YOUR-PASSWORD]` with your database password from step 3

---

### Step 3: Install Core Dependencies

```bash
# Install Prisma (database ORM)
npm install prisma @prisma/client

# Install Supabase client libraries
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

**What this does:**
- Installs Prisma for database management
- Installs Supabase libraries for auth and storage

**Note:** We'll initialize Prisma in the next step after configuring environment variables

---

### Step 4: Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
# In the project root directory
touch .env.local
```

**Open `.env.local` and add:**

```bash
# Supabase (from Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Service Role (from Project Settings → API)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Database (from Project Settings → Database → Connection String)
# Use port 5432 for direct connection OR port 6543 with pgbouncer for connection pooling
# Connection pooling (port 6543) is recommended for production to avoid "MaxClientsInSessionMode" errors
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Email (configure later when needed)
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM=qa-bot@example.com
```

**Replace:**
- `your-project-id` with your actual Supabase project ID
- `your-anon-key-here` with your anon key
- `your-service-role-key-here` with your service role key
- `[YOUR-PASSWORD]` with your database password

---

### Step 5: Update `.gitignore`

Ensure `.env.local` is ignored by Git (Next.js template should already have this):

```bash
# Check if it's already there
cat .gitignore | grep .env.local
```

If not present, add to `.gitignore`:

```
# local env files
.env*.local
.env
```

---

### Step 6: Configure Supabase Database

In the **Supabase Dashboard**, go to **SQL Editor** and run:

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

Click **Run** to execute.

---

### Step 7: Configure Supabase Auth

1. Go to **Authentication → Providers** in Supabase Dashboard
2. **Enable Email provider** (should be enabled by default)
3. Go to **Authentication → URL Configuration**
4. Add these URLs:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: `http://localhost:3000/**`

5. Go to **Authentication → Settings**
6. **Disable "Enable email confirmations"** (for easier MVP testing)
   - Note: Re-enable this in production!

---

### Step 8: Configure Supabase Storage

1. Go to **Storage** in Supabase Dashboard
2. Click **Create bucket**
3. **Bucket name**: `qa-screenshots`
4. **Public bucket**: **Off** (keep it private)
5. Click **Create bucket**

---

## Phase 1.2: Database & Prisma Setup

### Step 1: Initialize Prisma and Copy Schema

First, initialize Prisma (now that we have DATABASE_URL configured):

```bash
npx prisma init
```

This creates the `prisma/` directory with a `schema.prisma` file.

Now open `prisma/schema.prisma` and **replace all contents** with the schema from:

`Documentation/platform-technical-setup.md` (section 3)

> **⚠️ Schema Update Required**: The schema below predates the Release Run model. After applying this base schema, you must also apply the Release Run model updates. See [Release Run Model Changes](#release-run-model-changes-december-2025) at the top of this document for the additional tables and fields required.

> **Note for Windows ARM64 Users:**
> The schema includes `engineType = "binary"` in the generator block for ARM64 Windows compatibility.
> This setting works on all platforms (x64, ARM64, Mac, Linux) with negligible performance impact.
> See the comment in the schema for details on reverting when ARM64 support is no longer needed.

**Base schema** (requires Release Run updates - see note above):

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider   = "prisma-client-js"
  engineType = "binary"  // For Windows ARM64 compatibility - see note above
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
  supabaseUserId  String             @unique @db.Uuid

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

---

### Step 2: Run Initial Migration

```bash
# Create and apply the initial migration
npx prisma migrate dev --name init_core_schema
```

**What this does:**
- Creates migration files in `prisma/migrations/`
- Applies the migration to your Supabase database
- Generates Prisma Client

**Expected output:**
```
✔ Generated Prisma Client
✔ Applied migration init_core_schema
```

**Alternative: If migration fails (non-interactive environment)**

If `prisma migrate dev` fails with a non-interactive error, use:

```bash
# Push schema directly to database (no migration files)
npx prisma db push
```

This achieves the same result but doesn't create migration files. It's simpler and works in all environments.

---

### Step 3: Create Prisma Client Helper

Create `lib/prisma.ts`:

```bash
# Create lib directory
mkdir lib

# Create prisma.ts file
touch lib/prisma.ts
```

**Add this code to `lib/prisma.ts`:**

```typescript
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

---

### Step 4: Verify Database Setup

```bash
# Open Prisma Studio to view your database
npx prisma studio
```

This opens a browser at `http://localhost:5555` where you can see all your tables.

---

## Verification Checklist

Before moving to Phase 1.3, verify:

- [ ] Next.js project created and dependencies installed
- [ ] Supabase project created
- [ ] `.env.local` configured with correct credentials
- [ ] PostgreSQL extension enabled in Supabase
- [ ] Supabase Auth configured (email enabled, URLs set)
- [ ] Supabase Storage bucket created (`qa-screenshots`)
- [ ] Prisma schema copied and migration applied successfully
- [ ] Prisma Studio shows all tables (Company, Project, User, TestRun, etc.)
- [ ] `lib/prisma.ts` helper created

---

## Troubleshooting

### "Error: P1001: Can't reach database server"
- Check your `DATABASE_URL` in `.env.local`
- Verify your database password is correct
- Ensure Supabase project is active

### "Migration failed"
- Make sure you ran `CREATE EXTENSION IF NOT EXISTS "pgcrypto";` in Supabase SQL Editor
- Check for syntax errors in `schema.prisma`

### "Module not found: Can't resolve '@prisma/client'"
- Run `npm install` again
- Run `npx prisma generate`

### Next.js won't start
- Check for errors in `.env.local`
- Run `npm run dev` to see error messages

### "Prisma engines do not seem to be compatible with your system" (Windows ARM64)
- **Error**: `query_engine-windows.dll.node is not a valid Win32 application`
- **Cause**: You're on Windows ARM64, and Prisma doesn't ship native ARM64 binaries
- **Solution**: Already handled! The schema includes `engineType = "binary"` which fixes this
- **If you removed it by accident**:
  1. Add `engineType = "binary"` to the generator block in `prisma/schema.prisma`
  2. Run `npx prisma generate`
  3. Delete `.next` folder: `rm -rf .next`
  4. Restart dev server
- **More info**: https://github.com/prisma/prisma/issues/25206

### "MaxClientsInSessionMode: max clients reached" (Database Connection Pool)
- **Error**: `MaxClientsInSessionMode: max clients reached`
- **Cause**: Using direct database connection (port 5432) which has limited connection slots
- **Solution**: Switch to Supabase connection pooler
  1. Use port `6543` instead of `5432` in DATABASE_URL
  2. Add `?pgbouncer=true` to the connection string
  3. Use the pooler host: `aws-0-[region].pooler.supabase.com`
- **Example**: `postgresql://postgres:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true`

### Worker Issues

#### "Worker loop stopped" message appears
- **Cause**: If using `npm run dev` with nodemon, the worker restarts on file changes
- **Solution for stable testing**: Run with `npx ts-node index.ts` instead of `npm run dev`
- **Note**: Nodemon auto-restart is useful during development but can interrupt test processing

#### Tests fail when run together but work individually
- **Cause**: Multiple workers competing for jobs (local + Railway/Fly.io)
- **Solution**:
  1. Stop the production worker while testing locally, OR
  2. Ensure local and production workers have the same code deployed
  3. Railway/Fly.io worker will claim jobs if it's running with newer/different code

#### Spelling tests fail but other tests work
- **Cause**: LanguageTool service not accessible
- **Solution**:
  1. Verify Docker container is running: `docker ps`
  2. Test LanguageTool directly: `curl.exe http://localhost:8010/v2/check -d "language=en-US" -d "text=Hello wrold"`
  3. Check LANGUAGETOOL_URL in worker/.env matches your setup
  4. For Railway: ensure internal networking is configured correctly

#### PowerShell "curl" command fails with parameter errors (Windows)
- **Cause**: PowerShell aliases `curl` to `Invoke-WebRequest`
- **Solution**: Use `curl.exe` instead of `curl` on Windows
- **Example**: `curl.exe http://localhost:8010/v2/check -d "language=en-US" -d "text=test"`

---

## Phase 1.3: Authentication Setup

### Step 1: Create Supabase Client Utilities

Create `lib/supabase/client.ts` for client-side auth:

```bash
# Create supabase directory
mkdir -p lib/supabase

# Create client utility file
touch lib/supabase/client.ts
```

**Add this code to `lib/supabase/client.ts`:**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

Create `lib/supabase/server.ts` for server-side auth:

```bash
touch lib/supabase/server.ts
```

**Add this code to `lib/supabase/server.ts`:**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - cookies can only be set in Server Actions or Route Handlers
          }
        },
      },
    }
  )
}
```

---

### Step 2: Install Required Dependencies

```bash
npm install @supabase/ssr
```

---

### Step 3: Create Authentication Pages

Create the login page at `app/login/page.tsx`:

```bash
# Create login directory
mkdir -p app/login

# Create login page
touch app/login/page.tsx
```

**Add this code to `app/login/page.tsx`:**

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">Sign in to ReleasePass</h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

---

### Step 4: Create User Upsert API Route

Create an API route to upsert user records at `app/api/auth/user/route.ts`:

```bash
# Create auth API directory
mkdir -p app/api/auth/user

# Create user route
touch app/api/auth/user/route.ts
```

**Add this code to `app/api/auth/user/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Upsert user in our database
    const dbUser = await prisma.user.upsert({
      where: { supabaseUserId: user.id },
      update: {
        email: user.email!,
        updatedAt: new Date(),
      },
      create: {
        supabaseUserId: user.id,
        email: user.email!,
        role: 'ADMIN', // MVP: all users are admins
      },
    })

    return NextResponse.json({ user: dbUser })
  } catch (error: any) {
    console.error('User upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

### Step 5: Create Protected Dashboard Page

Create a simple dashboard at `app/dashboard/page.tsx`:

```bash
# Create dashboard directory
mkdir -p app/dashboard

# Create dashboard page
touch app/dashboard/page.tsx
```

**Add this code to `app/dashboard/page.tsx`:**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Upsert user in database
  const dbUser = await prisma.user.upsert({
    where: { supabaseUserId: user.id },
    update: {
      email: user.email!,
      updatedAt: new Date(),
    },
    create: {
      supabaseUserId: user.id,
      email: user.email!,
      role: 'ADMIN',
    },
  })

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-lg">Welcome, {dbUser.email}</p>
          <p className="text-gray-600 mt-2">Role: {dbUser.role}</p>
          <form action="/api/auth/signout" method="POST" className="mt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

---

### Step 6: Create Sign Out API Route

Create `app/api/auth/signout/route.ts`:

```bash
# Create signout directory
mkdir -p app/api/auth/signout

# Create signout route
touch app/api/auth/signout/route.ts
```

**Add this code to `app/api/auth/signout/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

---

### Step 7: Update Root Page

Update `app/page.tsx` to redirect to dashboard if authenticated:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">ReleasePass QA Platform</h1>
        <p className="text-gray-600 mb-8">Automated pre- and post-deployment QA</p>
        <a
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Sign In
        </a>
      </div>
    </div>
  )
}
```

---

### Step 8: Create Initial Test User

In your **Supabase Dashboard**, create a test user:

1. Go to **Authentication → Users**
2. Click **Add User**
3. Choose **Create new user**
4. Enter email: `admin@example.com`
5. Enter password: Choose a secure password
6. Click **Create User**

---

### Step 9: Test Authentication Flow

```bash
# Start the dev server
npm run dev
```

**Test the flow:**

1. Visit `http://localhost:3000`
2. Click "Sign In" (should redirect to `/login`)
3. Enter the test user credentials you created
4. Click "Sign in"
5. You should be redirected to `/dashboard`
6. Verify your email is displayed
7. Click "Sign Out" to test logout

**Verify database:**

```bash
# Open Prisma Studio
npx prisma studio
```

Check the `User` table - you should see your user record with:
- Email
- Supabase User ID
- Role: ADMIN
- Created/Updated timestamps

---

### Step 10: Add Middleware (Optional)

For automatic auth refresh, create `middleware.ts` in the root:

```bash
touch middleware.ts
```

**Add this code to `middleware.ts`:**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

## Verification Checklist - Phase 1.3

Before moving forward, verify:

- [ ] Supabase client utilities created (`lib/supabase/client.ts` and `server.ts`)
- [ ] `@supabase/ssr` package installed
- [ ] Login page created and functional
- [ ] Dashboard page created with auth protection
- [ ] Sign out functionality working
- [ ] Test user created in Supabase
- [ ] User record automatically created in database on first login
- [ ] Middleware configured for auth refresh
- [ ] Can sign in and see dashboard
- [ ] Can sign out and return to login

---

## Phase 2: Dashboard UI Framework

> See `documentation/mvp-implementation-plan.md` Phase 2 for implementation details.

This phase covers building the core dashboard UI components and pages. Implementation steps will be added here once ready.

---

## Phase 3: Core Data Layer

> See `documentation/mvp-implementation-plan.md` Phase 3 for implementation details.

This phase covers building API routes and data access patterns. Implementation steps will be added here once ready.

---

## Phase 3.5: Schema Updates for Page Preflight

Before implementing the worker service, we need to update the database schema to support Page Preflight providers.

### Step 1: Update Prisma Schema

Edit `prisma/schema.prisma` and update the `IssueProvider` enum:

```prisma
enum IssueProvider {
  SE_RANKING
  LANGUAGETOOL
  LIGHTHOUSE      // ADD THIS - for PageSpeed Lighthouse SEO
  LINKINATOR      // ADD THIS - for link checking
  CUSTOM_RULE     // ADD THIS - for custom rules
  INTERNAL
}
```

### Step 2: Create and Apply Migration

```bash
# From project root
npx prisma migrate dev --name add_page_preflight_providers
```

**Expected output:**
```
✔ Generated Prisma Client
✔ Applied migration add_page_preflight_providers
```

### Step 3: Verify Schema Update

```bash
# Open Prisma Studio to verify
npx prisma studio
```

Check that the `Issue` table's `provider` field now includes the three new enum values: LIGHTHOUSE, LINKINATOR, CUSTOM_RULE.

---

## Phase 3.6: Schema Updates for Release Run Model

This phase adds the Release Run model to the database schema. See [Release Run Model Changes](#release-run-model-changes-december-2025) for context.

> **Important**: This migration adds required fields (`Issue.impact`, `ManualTestStatus.releaseRunId`). If you have existing data, follow the **Fresh Start** approach: delete existing TestRun, Issue, and ManualTestStatus records before applying this migration. For MVP with minimal test data, this is the recommended approach.

### Step 1: Update Prisma Schema with New Enums

Edit `prisma/schema.prisma` and add these new enums:

```prisma
enum ReleaseRunStatus {
  PENDING
  READY
  FAIL
}

enum IssueImpact {
  BLOCKER
  WARNING
  INFO
}
```

Also update the `TestType` enum to include `PAGE_PREFLIGHT`:

```prisma
enum TestType {
  PAGE_PREFLIGHT    // ADD THIS - for Page Preflight tests (page-level)
  SITE_AUDIT        // Keep for Full Site Crawl (site-level, v1.2)
  PERFORMANCE
  SCREENSHOTS
  SPELLING
}
```

### Step 2: Add ReleaseRun Model

Add the new `ReleaseRun` model to `prisma/schema.prisma`:

```prisma
/// A frozen snapshot representing a single launch candidate
model ReleaseRun {
  id            String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId     String            @db.Uuid
  name          String?           // Optional label (e.g., "v2.1 Launch", "December Release")
  status        ReleaseRunStatus  @default(PENDING)
  urls          Json              // Frozen string array: ["https://example.com/page1", "https://example.com/page2"]
  selectedTests Json              // TestType array: ["PAGE_PREFLIGHT", "PERFORMANCE", "SCREENSHOTS", "SPELLING"]

  project        Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  testRuns       TestRun[]
  manualStatuses ManualTestStatus[]

  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@index([projectId, status])
  @@index([createdAt])
}
```

### Step 3: Update Existing Models

**Update `Project` model** - add relation to ReleaseRun:

```prisma
model Project {
  // ... existing fields ...
  releaseRuns  ReleaseRun[]      // ADD THIS
  // ... rest of model ...
}
```

**Update `TestRun` model** - add releaseRunId:

```prisma
model TestRun {
  id            String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  releaseRunId  String?     @db.Uuid    // ADD THIS - nullable for site-level tests
  projectId     String      @db.Uuid
  // ... rest of existing fields ...

  releaseRun    ReleaseRun? @relation(fields: [releaseRunId], references: [id], onDelete: Cascade)  // ADD THIS
  // ... rest of relations ...

  @@index([releaseRunId])    // ADD THIS
  // ... rest of indexes ...
}
```

**Update `Issue` model** - add impact field:

```prisma
model Issue {
  // ... existing fields ...
  severity  IssueSeverity
  impact    IssueImpact       // ADD THIS
  meta      Json?
  // ... rest of model ...
}
```

**Update `ManualTestStatus` model** - add releaseRunId:

```prisma
model ManualTestStatus {
  id              String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  releaseRunId    String           @db.Uuid    // ADD THIS
  projectId       String           @db.Uuid
  // ... rest of existing fields ...

  releaseRun      ReleaseRun       @relation(fields: [releaseRunId], references: [id], onDelete: Cascade)  // ADD THIS
  // ... rest of relations ...

  @@index([releaseRunId])    // ADD THIS
  // ... rest of indexes ...
}
```

### Step 4: Create and Apply Migration

```bash
# From project root
npx prisma migrate dev --name add_release_run_model
```

**Expected output:**
```
✔ Generated Prisma Client
✔ Applied migration add_release_run_model
```

### Step 5: Verify Schema Update

```bash
# Open Prisma Studio to verify
npx prisma studio
```

Check that:
- `ReleaseRun` table exists with name, status, urls, selectedTests columns
- `TestRun` table has `releaseRunId` column
- `Issue` table has `impact` column
- `ManualTestStatus` table has `releaseRunId` column

---

## Phase 4: Deploy Next.js to Vercel (Optional)

Deploying your Next.js app to Vercel early helps validate that your production setup works before building complex features.

### Step 1: Push Code to Git

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - ReleasePass MVP setup"

# Create GitHub repository and push
# (Follow GitHub instructions to create repo and add remote)
git remote add origin https://github.com/your-username/releasepass-qa.git
git branch -M main
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com/) and sign in
2. Click **"Add New Project"**
3. **Import Git Repository**:
   - Select your GitHub repository
   - Click **Import**

### Step 3: Configure Project

**Framework Preset**: Next.js (should auto-detect)

**Root Directory**: `./` (leave as default)

**Build Command**: `npm run build` (default)

**Output Directory**: `.next` (default)

**Install Command**: `npm install` (default)

### Step 4: Add Environment Variables

Click **"Environment Variables"** and add:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Database (use connection pooler URL - port 6543)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Email (if configured)
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM=qa-bot@example.com
```

**Important**:
- Use the **Production** environment variables from your Supabase project, not development.
- Use the connection pooler URL (port 6543 with `?pgbouncer=true`) to avoid connection limit errors.

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait for deployment to complete (~2-3 minutes)
3. Vercel will provide a URL like `https://releasepass-qa.vercel.app`

### Step 6: Update Supabase Redirect URLs

1. Go to Supabase Dashboard → **Authentication → URL Configuration**
2. Add your Vercel URL to **Redirect URLs**:
   - `https://your-app.vercel.app/**`
3. Update **Site URL**: `https://your-app.vercel.app`

### Step 7: Test Production Deployment

1. Visit your Vercel URL
2. Try to sign in with your test user
3. Verify dashboard loads correctly
4. Check that database connection works

### Step 8: Run Migrations in Production

```bash
# Set DATABASE_URL to production database
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.your-project-id.supabase.co:5432/postgres"

# Run migrations
npx prisma migrate deploy
```

**Alternative**: Run migrations automatically on deploy by adding to `package.json`:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

---

## Phase 5: Worker Platform Setup (Optional)

Setting up your worker hosting platform early ensures the deployment works before implementing complex provider logic.

### Platform Comparison

| Feature | Railway | Fly.io |
|---------|---------|--------|
| **Ease of setup** | Easier (GitHub integration) | Medium (CLI-based) |
| **Base fee** | $5/month (Hobby) | $0 (pay-as-you-go) |
| **1GB RAM cost** | ~$10/month | ~$5-6/month |
| **2GB RAM cost** | ~$20/month | ~$10/month |
| **Free tier** | 0.5GB RAM | None for new orgs |
| **Best for** | Quick start, simplicity | Cost optimization |

**Cost Example (Worker + LanguageTool):**
- Railway: ~$15-25/month
- Fly.io: ~$8-15/month (40-50% savings)

Choose based on your priorities:
- **Railway** if you want the simplest setup and don't mind paying a bit more
- **Fly.io** if you want to minimize costs and are comfortable with CLI tools

### Option A: Railway (Recommended)

#### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app/) and sign up
2. Connect your GitHub account

#### Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will detect it's a Node.js app

#### Step 3: Configure Service

1. Click on the deployed service
2. Go to **Settings**
3. **Root Directory**: Set to `worker`
4. **Start Command**: `npm start`
5. **Build Command**: `npm install && npx prisma generate && npm run build`

#### Step 4: Add Environment Variables

Go to **Variables** tab and add:

**⚠️ Important**: Variable names differ from Phase 1 because:
- Next.js uses `NEXT_PUBLIC_` prefix for client-side variables
- Worker is server-side only (no `NEXT_PUBLIC_` prefix needed)
- Worker only needs `SERVICE_ROLE_KEY` (not `ANON_KEY`)

```bash
# Database (use connection pooler URL - same as main app)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Supabase (note: no NEXT_PUBLIC_ prefix for worker)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# PageSpeed API (will add later)
PAGE_SPEED_API_KEY=

# LanguageTool (for Spelling tests - see Phase 6.5)
# For Railway internal networking:
LANGUAGETOOL_URL=http://languagetool.railway.internal:8010/v2

# Worker Configuration
POLL_INTERVAL_MIN=10000
POLL_INTERVAL_MAX=60000
HEARTBEAT_INTERVAL=30000
STUCK_RUN_TIMEOUT=3600000

# Node environment
NODE_ENV=production
```

#### Step 5: Create Minimal Worker for Testing

Before implementing full worker logic, create a minimal worker to validate deployment:

```bash
# From project root
mkdir -p worker
cd worker

# Initialize npm project
npm init -y

# Install dependencies
npm install @prisma/client dotenv

# Create basic index.js
```

Create `worker/index.js`:

```javascript
require('dotenv').config();

console.log('Worker starting...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');

// Keep process alive
setInterval(() => {
  console.log('Worker heartbeat:', new Date().toISOString());
}, 30000);
```

Create `worker/package.json`:

```json
{
  "name": "releasepass-worker",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@prisma/client": "^6.19.1",
    "dotenv": "^16.0.0"
  }
}
```

#### Step 6: Deploy Worker

```bash
# Commit and push
git add worker/
git commit -m "Add minimal worker for platform testing"
git push
```

Railway will automatically detect the change and redeploy.

#### Step 7: Verify Deployment

1. Go to Railway dashboard
2. Click on your worker service
3. Check **Logs** tab
4. You should see: `Worker starting...` and periodic heartbeat messages

#### Step 8: Test Database Connectivity

Update `worker/index.js` to test Prisma connection:

```javascript
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    const projectCount = await prisma.project.count();
    console.log('✅ Database connected! Projects:', projectCount);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

console.log('Worker starting...');
testConnection();

// Keep process alive
setInterval(() => {
  console.log('Worker heartbeat:', new Date().toISOString());
}, 30000);
```

Commit and push to test. Check Railway logs for successful database connection.

---

### Option B: Fly.io (Cost-Effective Alternative)

Fly.io is ~40-50% cheaper than Railway for running the worker and LanguageTool. Setup requires CLI tools but is straightforward.

#### Prerequisites

- A [Fly.io account](https://fly.io/app/sign-up) (credit card required, but no charges until you exceed free allowances)

#### Step 1: Install Fly CLI

**macOS/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell as Administrator):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Verify installation:**
```bash
fly version
```

#### Step 2: Login to Fly.io

```bash
fly auth login
```

This opens a browser window for authentication.

#### Step 3: Create Worker Dockerfile

Fly.io requires a Dockerfile. Create `worker/Dockerfile`:

```dockerfile
FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Run the worker
CMD ["node", "dist/index.js"]
```

#### Step 4: Create fly.toml Configuration

Create `worker/fly.toml`:

```toml
app = "releasepass-worker"
primary_region = "iad"  # Change to region closest to your Supabase database

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  POLL_INTERVAL_MIN = "10000"
  POLL_INTERVAL_MAX = "60000"
  HEARTBEAT_INTERVAL = "30000"
  STUCK_RUN_TIMEOUT = "3600000"

# Worker is a background process, not a web server
# No HTTP services needed
[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

**Region codes** (choose closest to your Supabase database):
- `iad` - Virginia, USA (default)
- `sjc` - San Jose, USA
- `lax` - Los Angeles, USA
- `ord` - Chicago, USA
- `lhr` - London, UK
- `fra` - Frankfurt, Germany
- `syd` - Sydney, Australia

#### Step 5: Initialize Fly App

```bash
cd worker

# Create the app (don't deploy yet)
fly launch --no-deploy
```

When prompted:
- **App name**: `releasepass-worker` (or your preferred name)
- **Organization**: Select your org
- **Region**: Choose closest to your database
- **PostgreSQL**: **No** (we use Supabase)
- **Redis**: **No**

#### Step 6: Set Environment Secrets

```bash
# Database connection (use connection pooler URL - port 6543)
fly secrets set DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase
fly secrets set SUPABASE_URL="https://your-project-id.supabase.co"
fly secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# PageSpeed API
fly secrets set PAGE_SPEED_API_KEY="your-google-api-key"

# LanguageTool (if using cloud API)
# fly secrets set LANGUAGETOOL_API_KEY="your-languagetool-key"
```

**Note:** For LanguageTool, we recommend deploying a self-hosted instance on Fly.io (see Step 9 below).

#### Step 7: Deploy Worker

```bash
fly deploy
```

First deployment takes 2-3 minutes. Subsequent deployments are faster.

#### Step 8: Verify Deployment

```bash
# View logs
fly logs

# Check app status
fly status
```

You should see:
```
Worker starting...
Environment check:
- DATABASE_URL: Set
✅ Database connected!
```

#### Step 9: Deploy LanguageTool on Fly.io (Recommended)

Deploy LanguageTool as a separate Fly app for unlimited spelling checks:

**Step 9a: Create LanguageTool app**
```bash
# From project root (not worker directory)
mkdir -p fly-languagetool
cd fly-languagetool
```

**Step 9b: Create fly.toml for LanguageTool**

Create `fly-languagetool/fly.toml`:

```toml
app = "releasepass-languagetool"
primary_region = "iad"  # Same region as worker

[build]
  image = "erikvl87/languagetool"

[env]
  Java_Xms = "256m"
  Java_Xmx = "1g"

[http_service]
  internal_port = 8010
  force_https = false
  auto_stop_machines = false  # Keep running 24/7
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "1gb"  # 1GB RAM for LanguageTool
  cpu_kind = "shared"
  cpus = 1
```

**Step 9c: Launch LanguageTool**
```bash
fly launch --no-deploy
fly deploy
```

**Step 9d: Get internal URL**
```bash
fly status
```

Note the internal address (e.g., `releasepass-languagetool.internal`).

**Step 9e: Configure worker to use LanguageTool**
```bash
cd ../worker
fly secrets set LANGUAGETOOL_URL="http://releasepass-languagetool.internal:8010/v2"
```

**Step 9f: Redeploy worker**
```bash
fly deploy
```

#### Step 10: Useful Fly.io Commands

```bash
# View logs in real-time
fly logs -a releasepass-worker

# SSH into the container (for debugging)
fly ssh console -a releasepass-worker

# Check resource usage
fly scale show -a releasepass-worker

# Restart the app
fly apps restart releasepass-worker

# View all your apps
fly apps list

# Check costs
fly billing
```

#### Cost Monitoring

Fly.io charges per-second for running machines. Monitor costs:

```bash
# View current billing
fly billing

# View app-specific usage
fly scale show -a releasepass-worker
fly scale show -a releasepass-languagetool
```

**Expected monthly costs:**
- Worker (512MB): ~$3-4/month
- LanguageTool (1GB): ~$5-6/month
- **Total: ~$8-10/month**

---

## Phase 6.1: Worker Infrastructure (Universal)

This phase sets up the core worker service infrastructure that supports all test types. This is the foundation that will run Site Audit (Page Preflight and Full Site Crawl), Performance, Screenshots, and Spelling tests.

### Step 1: Create Worker Directory Structure

```bash
# From project root
mkdir -p worker/lib worker/jobs worker/providers worker/rules
```

**Directory explanation:**
- `worker/lib/` - Shared utilities (Prisma client, retry logic, scoring)
- `worker/jobs/` - Job claiming, execution orchestrator, cleanup
- `worker/providers/` - Test provider implementations (will create subdirectories per provider)
- `worker/rules/` - Custom rules for Page Preflight (extensibility)

### Step 2: Initialize Worker Project

```bash
cd worker

# Initialize npm project
npm init -y

# Install core dependencies
npm install @prisma/client @supabase/supabase-js dotenv

# Install dev dependencies
npm install --save-dev typescript @types/node ts-node nodemon

# Initialize TypeScript
npx tsc --init
```

**Core dependencies:**
- `@prisma/client` - Database access (same schema as main app)
- `@supabase/supabase-js` - Supabase storage for screenshots
- `dotenv` - Environment variable management

### Step 3: Configure Worker TypeScript

Edit `worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 4: Configure Worker Environment Variables

Create `worker/.env`:

```bash
# Database (use connection pooler URL - same as main app)
# Use port 6543 with pgbouncer to avoid "MaxClientsInSessionMode" errors
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Supabase (for storage operations)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# PageSpeed Insights API
# Get key from: https://console.cloud.google.com/apis/credentials
PAGE_SPEED_API_KEY=YOUR_GOOGLE_API_KEY_HERE

# Worker Configuration
POLL_INTERVAL_MIN=10000          # 10 seconds
POLL_INTERVAL_MAX=60000          # 60 seconds
HEARTBEAT_INTERVAL=30000         # 30 seconds
STUCK_RUN_TIMEOUT=3600000        # 60 minutes

# LanguageTool (for Spelling tests)
# Option 1: Self-hosted locally (development)
LANGUAGETOOL_URL=http://localhost:8010/v2
# Option 2: Self-hosted on Railway (production)
# LANGUAGETOOL_URL=http://languagetool.railway.internal:8010/v2
# Option 3: Cloud API (paid tiers only)
# LANGUAGETOOL_API_KEY=your-api-key-here

# Future providers
SE_RANKING_API_KEY=
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM=qa-bot@example.com
```

**Getting a PageSpeed API Key:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **PageSpeed Insights API**:
   - Go to **APIs & Services → Library**
   - Search for "PageSpeed Insights API"
   - Click **Enable**
4. Create credentials:
   - Go to **APIs & Services → Credentials**
   - Click **Create Credentials → API Key**
   - Copy the API key
5. (Optional) Restrict the API key to PageSpeed Insights API only for security

**Free Tier Limits:**
- 25,000 requests per day
- 400 requests per minute

### Step 5: Link Prisma Schema to Worker

```bash
# From worker directory
# Copy schema from main project
cp ../prisma/schema.prisma ./schema.prisma

# OR create a symlink (Unix/Mac/Linux)
ln -s ../prisma/schema.prisma ./schema.prisma

# OR on Windows (run as Administrator)
mklink schema.prisma ..\prisma\schema.prisma
```

Then generate Prisma client:

```bash
# From worker directory
npx prisma generate
```

**Note**: The worker uses the same Prisma schema and database as the main app. Schema migrations were applied in Phase 3.5.

### Step 6: Add Worker Scripts

Edit `worker/package.json` to add these scripts:

```json
{
  "name": "releasepass-worker",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon --exec ts-node index.ts",
    "start": "ts-node index.ts",
    "build": "tsc",
    "test:providers": "ts-node scripts/test-providers.ts"
  }
}
```

### Step 7: Create Prisma Client Helper

Create `worker/lib/prisma.ts`:

```typescript
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

### Step 8: Create Basic Worker Index

Create `worker/index.ts`:

```typescript
import * as dotenv from 'dotenv';
dotenv.config();

console.log('Worker starting...');
console.log('Environment check:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');

// TODO: Add worker loop and provider implementations in Phase 6.2+
console.log('Worker ready (awaiting implementation)');
```

**Note**: This is a minimal worker that validates the infrastructure. Provider implementations will be added in subsequent phases.

### Step 9: Test Worker Setup

```bash
# From worker directory
npm run dev
```

Expected output:
```
Worker starting...
Environment check:
- DATABASE_URL: Set
Worker ready (awaiting implementation)
```

Press Ctrl+C to stop.

### Step 10: Add Worker .gitignore

Create `worker/.gitignore`:

```
node_modules/
dist/
.env
*.log
```

---

## Verification Checklist - Phase 6.1

Before moving to provider integrations, verify:

- [ ] Worker directory structure created
- [ ] Worker npm project initialized
- [ ] Core dependencies installed (@prisma/client, @supabase/supabase-js, dotenv)
- [ ] TypeScript configured (`tsconfig.json`)
- [ ] Worker `.env` configured with DATABASE_URL and SUPABASE credentials
- [ ] Prisma schema linked to worker
- [ ] Prisma client generated in worker
- [ ] Worker scripts added to `package.json`
- [ ] `lib/prisma.ts` created in worker
- [ ] Basic worker `index.ts` created
- [ ] Worker starts without errors (`npm run dev`)
- [ ] Environment variables are detected correctly

**Note**: Provider-specific dependencies (linkinator, zod, playwright, etc.) will be added in subsequent phases.

---

## Phase 6.2: Page Preflight Providers (Site Audit CUSTOM_URLS)

This phase implements the three providers for Page Preflight mode: PageSpeed Lighthouse SEO, Linkinator, and Custom Rules plugin system.

### Step 1: Install Page Preflight Dependencies

```bash
# From worker directory
npm install linkinator zod
```

**What these do:**
- `linkinator` - Google's link checking library for detecting broken links, redirects, and timeouts
- `zod` - TypeScript-first schema validation for validating external API responses and custom rule outputs

### Step 2: Get PageSpeed API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **PageSpeed Insights API**:
   - Go to **APIs & Services → Library**
   - Search for "PageSpeed Insights API"
   - Click **Enable**
4. Create credentials:
   - Go to **APIs & Services → Credentials**
   - Click **Create Credentials → API Key**
   - Copy the API key
5. (Optional) Restrict the API key to PageSpeed Insights API only for security

**Free Tier Limits:**
- 25,000 requests per day
- 400 requests per minute

### Step 3: Add PageSpeed API Key to Environment

Edit `worker/.env` and add:

```bash
# PageSpeed Insights API
PAGE_SPEED_API_KEY=YOUR_GOOGLE_API_KEY_HERE
```

### Step 4: Create Provider Directory Structure

```bash
# From worker directory
mkdir -p providers/pagespeed providers/linkinator providers/custom-rules
```

### Step 5: Implement Page Preflight Providers

> **Implementation Note**: Detailed provider implementation steps will be added in `documentation/mvp-implementation-plan.md` Phase 7 (Provider Integrations).

For now, the infrastructure is ready. Provider implementations include:

1. **PageSpeed Lighthouse SEO** (`providers/pagespeed/`)
   - Client for PageSpeed Insights API v5
   - SEO audit mapper (Lighthouse audits → Issue records)
   - Retry logic with exponential backoff

2. **Linkinator** (`providers/linkinator/`)
   - Link checking logic (internal, external, resources)
   - Result mapper (broken links → Issue records)
   - Configurable timeout and retry

3. **Custom Rules** (`providers/custom-rules/`)
   - Rule loader (scans `rules/` directory)
   - Rule executor (runs rules in parallel)
   - Example rules: meta tags, Open Graph, title length

---

## Phase 6.3: Performance Provider (PageSpeed Core Web Vitals)

> **Status**: To be implemented

This phase will implement the Performance test provider using PageSpeed Insights API for Core Web Vitals (LCP, CLS, INP) and lab metrics.

**Dependencies to add**:
```bash
npm install axios  # For HTTP requests to PageSpeed API
```

**Implementation**: See `documentation/mvp-implementation-plan.md` Phase 7.

---

## Phase 6.4: Screenshots Provider (Playwright)

> **Status**: To be implemented

This phase will implement the Screenshots test provider using Playwright for multi-viewport screenshot capture.

**Dependencies to add**:
```bash
npm install playwright @playwright/test
npx playwright install  # Install browser binaries
```

**Implementation**: See `documentation/mvp-implementation-plan.md` Phase 7.

---

## Phase 6.5: Spelling Provider (Cheerio + LanguageTool) ✅ IMPLEMENTED

This phase implements the Spelling test provider using Cheerio for text extraction and LanguageTool API for grammar/spelling checks.

### Implementation Overview

The spelling provider is located in `worker/providers/spelling/`:

1. **`worker/providers/spelling/languagetool-client.ts`** - LanguageTool API client
   - Supports self-hosted instance (LANGUAGETOOL_URL) or cloud API (LANGUAGETOOL_API_KEY)
   - Auto language detection
   - Configurable disabled rules/categories
   - Retry logic with exponential backoff

2. **`worker/providers/spelling/index.ts`** - Spelling provider
   - Extracts visible text from pages using Cheerio (no Playwright dependency)
   - Filters out nav, header, footer, scripts, cookie notices
   - Skips pages with <10 words
   - Creates ResultItems with severity mapping:
     - Misspelling → HIGH
     - Grammar → CRITICAL
     - Style → MEDIUM
     - Typographical → LOW
   - Stores full sentence and context for error highlighting in UI

### Configuration

Add to `worker/.env`:

```bash
# Option 1: Self-hosted (recommended - unlimited requests)
LANGUAGETOOL_URL=http://languagetool:8010/v2

# Option 2: Cloud API (paid tiers only)
LANGUAGETOOL_API_KEY=your-api-key-here
```

### Self-Hosted Setup (Recommended)

Self-hosting LanguageTool gives you unlimited requests with no API costs.

#### Prerequisites

- **Docker** installed and running
  - Windows: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
  - macOS: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
  - Linux: [Docker Engine](https://docs.docker.com/engine/install/)

#### Option A: Local Development

Run LanguageTool on your local machine for development:

```bash
# Step 1: Verify Docker is running
docker --version

# Step 2: Pull and run LanguageTool container
docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool

# Step 3: Wait ~30 seconds for startup, then verify it's running
curl.exe http://localhost:8010/v2/check -d "language=en-US" -d "text=Hello wrold"
```

**What this does:**
- `-d` runs the container in the background (detached)
- `--name languagetool` names the container for easy management
- `-p 8010:8010` maps port 8010 on your machine to port 8010 in the container
- The container uses ~512MB-1GB RAM by default

**Managing the container:**
```bash
# Stop the container
docker stop languagetool

# Start it again
docker start languagetool

# View logs
docker logs languagetool

# Remove container (to recreate with different settings)
docker rm languagetool
```

**Worker configuration for local development:**
```bash
# In worker/.env
LANGUAGETOOL_URL=http://localhost:8010/v2
```

#### Option B: Production (Fly.io) - Recommended

Fly.io is the most cost-effective option for production. See [Phase 5, Option B, Step 9](#step-9-deploy-languagetool-on-flyio-recommended) for complete instructions.

**Quick summary:**
```bash
# Create directory and fly.toml
mkdir -p fly-languagetool && cd fly-languagetool

# Create fly.toml with erikvl87/languagetool image
# See Phase 5 for full configuration

# Deploy
fly launch --no-deploy
fly deploy

# Configure worker
fly secrets set LANGUAGETOOL_URL="http://releasepass-languagetool.internal:8010/v2" -a releasepass-worker
```

**Cost:** ~$5-6/month for 1GB RAM

#### Option C: Production (Railway)

For production deployment on Railway, add LanguageTool as a separate service in your existing Railway project.

**Step 1: Create a new service in your Railway project**
1. Go to your Railway project dashboard (the same project as your worker)
2. Click **"Create"** → **"Docker Image"**
3. Enter image: `erikvl87/languagetool`
4. Click **"Deploy"**
5. Wait for the deployment to complete (~1-2 minutes)

**Step 2: Configure environment variables for LanguageTool**
Click on **"Variables"** tab and add:
```bash
Java_Xms=512m
Java_Xmx=1g
```
This allocates 512MB-1GB RAM to the Java process.

**Step 3: Generate a public domain (for testing)**
1. Click on the LanguageTool service
2. Go to **"Settings"** tab
3. Scroll down to **"Networking"** section
4. Click **"Generate Domain"** to create a public URL (e.g., `languagetool-production-xxxx.up.railway.app`)
5. Note this URL - you'll need it for local testing

**Step 4: Test from your local machine**
```bash
curl.exe https://languagetool-production-xxxx.up.railway.app/v2/check -d "language=en-US" -d "text=Hello wrold"
```
You should get a JSON response with a spelling match for "wrold" → "world".

**Step 5: Configure worker to use LanguageTool**

You have two URL options:

| URL Type | Use Case | Example |
|----------|----------|---------|
| **Public URL** | Works everywhere (local dev + Railway) | `https://languagetool-production-xxxx.up.railway.app/v2` |
| **Internal URL** | Railway only (faster, no external traffic) | `http://languagetool.railway.internal:8010/v2` |

**Recommended setup:**
- Use the **public URL** in Railway worker Variables - this lets you test locally against Railway's LanguageTool
- Keep `http://localhost:8010/v2` in your local `.env` for offline development with Docker

In your **worker service** on Railway, go to **"Variables"** and add:
```bash
LANGUAGETOOL_URL=https://languagetool-production-xxxx.up.railway.app/v2
```

**Step 6: Redeploy worker**
Railway will automatically redeploy when you add the variable. If not, click **"Redeploy"** on the worker service.

**Step 7: Verify the connection**
1. Click on your **worker service** in the Railway dashboard
2. Go to the **"Logs"** tab (or click "View Logs" on the deployment)
3. Trigger a spelling test from the ReleasePass UI
4. Watch for successful LanguageTool calls without connection errors

**Testing Railway LanguageTool from local:**
To test your local worker against Railway's LanguageTool:
1. Update your local `worker/.env`:
   ```bash
   LANGUAGETOOL_URL=https://languagetool-production-xxxx.up.railway.app/v2
   ```
2. Run `npm run dev` in the worker directory
3. Trigger a spelling test from the UI

**Troubleshooting Railway LanguageTool:**
- **Service not starting**: Check Railway logs for Java memory errors. Increase `Java_Xmx` if needed.
- **Worker can't connect**: Ensure both services are in the same Railway project if using internal URL.
- **Timeout errors**: LanguageTool takes ~30 seconds to start. Wait for "LanguageTool server is ready" in logs before testing.
- **Local testing fails**: Make sure you're using the public URL (https://...up.railway.app), not the internal URL.

**Cost:** ~$10-12/month for 1GB RAM

#### Option D: Production (Docker Compose / Self-Managed Server)

For self-managed production servers (VPS, cloud VM), use Docker Compose:

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  worker:
    build: ./worker
    environment:
      - LANGUAGETOOL_URL=http://languagetool:8010/v2
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - languagetool

  languagetool:
    image: erikvl87/languagetool
    ports:
      - "8010:8010"
    environment:
      - Java_Xms=512m
      - Java_Xmx=2g
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

#### Resource Requirements

| Configuration | RAM | Startup Time | Best For |
|--------------|-----|--------------|----------|
| Default | 512MB-1GB | ~30 seconds | Development |
| Production | 2GB+ | ~30 seconds | Production workloads |
| With n-gram data | 4GB+ | ~2 minutes | Maximum accuracy |

**Note:** The n-gram data improves detection of commonly confused words (their/there, its/it's) but requires ~15GB disk space and slower startup. For MVP, the default configuration is sufficient.

### Cloud API Setup (Alternative)

If using the cloud API:

1. Go to [LanguageTool Proofreading API](https://languagetool.org/proofreading-api/)
2. Choose a paid tier (no free tier for API access)
3. Get your API key
4. Set `LANGUAGETOOL_API_KEY` in your environment

### Dependencies

The spelling provider uses existing dependencies:
- `cheerio` - Already installed for custom-rules
- No additional npm packages required

**Implementation**: See `worker/providers/spelling/languagetool-client.ts` and `worker/providers/spelling/index.ts`

### Reducing False Positives

LanguageTool can be configured to reduce false positives (e.g., proper nouns, brand names) using environment variables.

#### Configuration Variables

Add to `worker/.env` (and Railway worker Variables):

```bash
# Level: 'default' or 'picky' (picky enables stricter rules)
LANGUAGETOOL_LEVEL=default

# Disable entire categories (comma-separated)
LANGUAGETOOL_DISABLED_CATEGORIES=CASING

# Disable specific rules (comma-separated)
LANGUAGETOOL_DISABLED_RULES=UPPERCASE_SENTENCE_START
```

#### Available Categories

| Category ID | Description |
|-------------|-------------|
| `CASING` | Uppercase/lowercase issues |
| `TYPOS` | Spelling mistakes |
| `GRAMMAR` | Grammar rules |
| `PUNCTUATION` | Punctuation errors |
| `TYPOGRAPHY` | Typographical issues |
| `STYLE` | Style suggestions |
| `REDUNDANCY` | Redundant words/phrases |
| `CONFUSED_WORDS` | Commonly confused words (there/their) |
| `COMPOUNDING` | Compound word issues |
| `COLLOQUIALISMS` | Informal language |
| `REPETITIONS` | Repeated words |
| `REPETITIONS_STYLE` | Stylistic repetitions |
| `SEMANTICS` | Semantic issues |
| `GENDER_NEUTRALITY` | Gender-neutral language |
| `FALSE_FRIENDS` | False cognates between languages |
| `PLAIN_ENGLISH` | Plain language suggestions |
| `REGIONALISMS` | Regional language variants |
| `MISC` | Miscellaneous |
| `WIKIPEDIA` | Wikipedia-specific rules |

#### Browse All Rules

To find specific rule IDs to disable, browse the complete list of 6,146 English rules:
https://community.languagetool.org/rule/list?lang=en

#### Recommended Configuration

For web content with brand names and proper nouns:

```bash
LANGUAGETOOL_LEVEL=default
LANGUAGETOOL_DISABLED_CATEGORIES=CASING
```

---

## Phase 6.6: Full Site Crawl Provider (SE Ranking) - v1.2

> **Status**: Deferred to v1.2

This phase will implement the Site Audit Full Site Crawl mode using SE Ranking API for comprehensive site-wide audits.

**Dependencies to add**:
```bash
npm install axios  # For HTTP requests to SE Ranking API
```

**Implementation**: See `documentation/mvp-implementation-plan.md` for v1.2 roadmap.

---

## Next Steps

Once Phase 6.1 infrastructure is complete, you're ready for:

**Phase 6.2**: Implement Page Preflight Providers (Lighthouse + Linkinator + Custom Rules)

See `documentation/mvp-implementation-plan.md` Phase 7 for detailed provider implementation steps.

---

## Quick Reference Commands

```bash
# Start development server
npm run dev

# View database
npx prisma studio

# Generate Prisma Client (after schema changes)
npx prisma generate

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Reset database (careful! deletes all data)
npx prisma migrate reset

# Format Prisma schema
npx prisma format
```

---

## Need Help?

- **Prisma Docs**: https://www.prisma.io/docs
- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs

Refer to `Documentation/mvp-implementation-plan.md` for the complete implementation roadmap.