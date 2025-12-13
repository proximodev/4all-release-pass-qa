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

### Step 1: Initialize Prisma and Copy Schema

First, initialize Prisma (now that we have DATABASE_URL configured):

```bash
npx prisma init
```

This creates the `prisma/` directory with a `schema.prisma` file.

Now open `prisma/schema.prisma` and **replace all contents** with the schema from:

`Documentation/platform-technical-setup.md` (section 3)

> **Note for Windows ARM64 Users:**
> The schema includes `engineType = "binary"` in the generator block for ARM64 Windows compatibility.
> This setting works on all platforms (x64, ARM64, Mac, Linux) with negligible performance impact.
> See the comment in the schema for details on reverting when ARM64 support is no longer needed.

Or copy from here:

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

## Next Steps

Once Phase 1.1, 1.2, and 1.3 are complete, you're ready for:

**Phase 2.1: Project Management UI**

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