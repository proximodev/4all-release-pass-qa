# ReleasePass MVP: Installation Guide

This guide will walk you through setting up the ReleasePass platform from scratch.

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

### Step 2: Install Core Dependencies

```bash
# Install Prisma (database ORM)
npm install prisma @prisma/client

# Install Supabase client libraries
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs

# Initialize Prisma
npx prisma init
```

**What this does:**
- Installs Prisma for database management
- Installs Supabase libraries for auth and storage
- Creates `prisma/schema.prisma` and `.env` files

---

### Step 3: Set Up Supabase Project

1. **Go to [supabase.com](https://supabase.com/)** and sign in
2. **Click "New Project"**
3. **Fill in project details:**
   - Project name: `releasepass-qa` (or your choice)
   - Database password: Generate a strong password (save this!)
   - Region: Choose closest to you
   - Pricing plan: Free tier is fine for MVP

4. **Wait for project to initialize** (takes ~2 minutes)

5. **Collect your credentials:**
   - Go to **Project Settings → API**
   - Copy these values:
     - `Project URL`
     - `anon public` key
     - `service_role` key (click "Reveal" to see it)
   - Go to **Project Settings → Database → Connection String**
     - Copy the `URI` (Node.js format)
     - Replace `[YOUR-PASSWORD]` with your database password

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
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres

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

### Step 1: Copy Prisma Schema

Open `prisma/schema.prisma` and **replace all contents** with the schema from:

`Documentation/platform-technical-setup.md` (section 3)

Or copy from here:

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

---

## Next Steps

Once Phase 1.1 and 1.2 are complete, you're ready for:

**Phase 1.3: Authentication Setup**

See `Documentation/mvp-implementation-plan.md` for the next steps.

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