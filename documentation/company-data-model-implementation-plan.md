# Company Data Model Implementation Plan

## Overview

Implement company data model support with full CRUD operations, soft delete with reassignment, and integration into User and Project entities.

## Phase 1: Database Schema Changes

### 1.1 Prisma Schema Updates

**File:** `prisma/schema.prisma`

```prisma
model Company {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String
  url       String?                    // NEW: Company website URL
  isSystem  Boolean   @default(false)  // NEW: Prevents deletion of system companies

  projects  Project[]
  users     User[]                     // NEW: Relation to users

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?                  // NEW: Soft delete
}

model User {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email          String   @unique
  firstName      String?
  lastName       String?
  role           UserRole @default(ADMIN)
  supabaseUserId String   @unique @db.Uuid
  companyId      String   @db.Uuid     // NEW: Required FK to Company

  company        Company  @relation(fields: [companyId], references: [id])  // NEW

  manualTestStatuses ManualTestStatus[] @relation("ManualStatusUpdatedBy")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Project {
  id         String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId  String  @db.Uuid          // CHANGED: Now required (was nullable)
  name       String
  siteUrl    String
  sitemapUrl String?
  notes      String?

  company    Company @relation(fields: [companyId], references: [id])  // CHANGED: Not optional
  // ... other relations unchanged
}
```

### 1.2 Migration Strategy

Since `companyId` becomes required, migration must:
1. Create the two seed companies first
2. Update existing users/projects to reference "4All Digital"
3. Then alter columns to NOT NULL

**Migration SQL:**
```sql
-- Add new columns (nullable initially)
ALTER TABLE "Company" ADD COLUMN "url" TEXT;
ALTER TABLE "Company" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "companyId" UUID;

-- Seed companies (will be done via seed script after migration)
-- Then update existing records
-- Then make companyId NOT NULL
```

---

## Phase 2: Seed Data

### 2.1 Company Seed Script

**File:** `prisma/seed-companies.ts`

```typescript
const SYSTEM_COMPANIES = [
  {
    name: '4All Digital',
    url: 'https://4all.digital',
    isSystem: false,  // Can be edited/renamed but is the default
  },
  {
    name: 'Unassigned',
    url: null,
    isSystem: true,   // Cannot be deleted, hidden from listings
  },
]
```

### 2.2 Seed Execution Order

1. Run migration (add columns as nullable)
2. Run seed script to create companies
3. Update existing users/projects to "4All Digital" company
4. Run second migration to make `companyId` NOT NULL

---

## Phase 3: Shared URL Validation

### 3.1 Extract URL Validation Utility

**File:** `lib/validation/url.ts` (extend existing)

Add company-specific URL schema:
```typescript
// Company URL validation - simpler than safeUrlSchema (no SSRF concerns for display URLs)
export const companyUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url)
        return ['http:', 'https:'].includes(parsed.protocol)
      } catch {
        return false
      }
    },
    { message: 'URL must use HTTP or HTTPS protocol' }
  )
  .optional()
  .or(z.literal(''))
```

---

## Phase 4: Company API Routes

### 4.1 List & Create Companies

**File:** `app/api/companies/route.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies` | List all non-deleted, non-system companies |
| POST | `/api/companies` | Create new company |

**GET Response:**
```json
[
  {
    "id": "uuid",
    "name": "4All Digital",
    "url": "https://4all.digital",
    "createdAt": "2024-01-01T00:00:00Z",
    "_count": { "users": 5, "projects": 10 }
  }
]
```

### 4.2 Single Company Operations

**File:** `app/api/companies/[id]/route.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies/:id` | Get single company |
| PATCH | `/api/companies/:id` | Update company |
| DELETE | `/api/companies/:id` | Soft delete + reassign |

**DELETE Behavior:**
1. Check if `isSystem` - block deletion if true
2. Find "Unassigned" company ID
3. Update all users with this companyId → Unassigned
4. Update all projects with this companyId → Unassigned
5. Set `deletedAt` timestamp on company

### 4.3 Companies Dropdown Endpoint

**File:** `app/api/companies/dropdown/route.ts`

Returns minimal data for dropdowns (includes Unassigned for edge cases):
```json
[
  { "id": "uuid", "name": "4All Digital" },
  { "id": "uuid", "name": "Unassigned" }
]
```

---

## Phase 5: Company Validation Schema

### 5.1 Create Company Schema

**File:** `lib/validation/company.ts`

```typescript
import { z } from 'zod'
import { companyUrlSchema } from './url'

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  url: companyUrlSchema,
})
```

---

## Phase 6: Company Settings Pages

### 6.1 Navigation Update

**File:** `lib/constants/navigation.ts`

```typescript
export const settingsTabs = [
  { label: 'Preflight Rules', href: '/settings/preflight-rules' },
  { label: 'Preflight Categories', href: '/settings/preflight-categories' },
  { label: 'Companies', href: '/settings/companies' },  // NEW - before Users
  { label: 'Users', href: '/settings/users' },
]
```

### 6.2 Company List Page

**File:** `app/(dashboard)/settings/companies/page.tsx`

**Features:**
- Tab navigation using `settingsTabs`
- Search/filter input by company name
- "Add Company" button
- Table columns: Name, URL (as link), Created, Actions (Edit)
- Excludes system companies from listing

### 6.3 New Company Page

**File:** `app/(dashboard)/settings/companies/new/page.tsx`

**Form Fields:**
- Company Name (required)
- URL (optional, validated)
- Buttons: Create Company, Cancel

### 6.4 Edit Company Page

**File:** `app/(dashboard)/settings/companies/[id]/edit/page.tsx`

**Form Fields:**
- Company Name (required)
- URL (optional, validated)
- Buttons: Save, Cancel, Delete

**Delete Behavior:**
- Confirmation modal with count of affected users/projects
- Message: "This will reassign X users and Y projects to 'Unassigned'"

---

## Phase 7: User Page Updates

### 7.1 Update User Schema

**File:** `lib/validation/user.ts`

```typescript
export const userSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['ADMIN', 'USER']),
  companyId: z.string().uuid('Company is required'),  // NEW
})
```

### 7.2 Update New User Form

**File:** `app/(dashboard)/settings/users/new/page.tsx`

- Add Company dropdown (required)
- Fetch companies from `/api/companies/dropdown`
- Default to first company in list (or user's company if available)

### 7.3 Update Edit User Form

**File:** `app/(dashboard)/settings/users/[id]/edit/page.tsx`

- Add Company dropdown (required)
- Pre-select current company

### 7.4 Update User API Routes

**Files:**
- `app/api/users/route.ts` - Include companyId in POST
- `app/api/users/[id]/route.ts` - Include companyId in PATCH, return company in GET

---

## Phase 8: Project Page Updates

### 8.1 Update Project Schema

**File:** `lib/validation/project.ts`

```typescript
export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  siteUrl: z.string().url('Site URL must be a valid URL'),
  sitemapUrl: z.string().url('Sitemap URL must be a valid URL').optional().or(z.literal('')),
  notes: z.string().optional(),
  companyId: z.string().uuid('Company is required'),  // NEW
})
```

### 8.2 Update New Project Form

**File:** `app/(dashboard)/projects/new/page.tsx`

- Add Company dropdown (required)
- Default to current user's companyId
- Fetch companies from `/api/companies/dropdown`

### 8.3 Update Edit Project Form

**File:** `app/(dashboard)/projects/[id]/edit/page.tsx`

- Add Company dropdown (required)
- Pre-select current company

### 8.4 Update Project API Routes

**Files:**
- `app/api/projects/route.ts` - Include companyId in POST (remove `companyId: null`)
- `app/api/projects/[id]/route.ts` - Include companyId in PATCH, return company in GET

### 8.5 Get Current User's Company

Need endpoint or helper to get current authenticated user's companyId for defaulting:

**Option A:** Include in session/auth context
**Option B:** Fetch from `/api/users/me` endpoint

---

## Phase 9: User List Display Updates

### 9.1 Users List Table

**File:** `app/(dashboard)/settings/users/page.tsx`

Add Company column to table:
| Name | Email | Company | Role | Created | Actions |

---

## Implementation Order

1. **Schema & Migration** (Phase 1)
   - Update Prisma schema
   - Create migration (nullable first)

2. **Seed Script** (Phase 2)
   - Create seed-companies.ts
   - Run seed
   - Update existing records
   - Create NOT NULL migration

3. **Shared Validation** (Phase 3, 5)
   - Add companyUrlSchema to lib/validation/url.ts
   - Create lib/validation/company.ts

4. **Company API** (Phase 4)
   - /api/companies route
   - /api/companies/[id] route
   - /api/companies/dropdown route

5. **Company Pages** (Phase 6)
   - Update navigation
   - List page
   - New page
   - Edit page

6. **User Updates** (Phase 7, 9)
   - Update validation schema
   - Update API routes
   - Update new/edit forms
   - Update list display

7. **Project Updates** (Phase 8)
   - Update validation schema
   - Update API routes
   - Update new/edit forms
   - Add current user company fetch

---

## Files to Create

| File | Description |
|------|-------------|
| `prisma/seed-companies.ts` | Seed 4All Digital + Unassigned companies |
| `lib/validation/company.ts` | Company Zod schema |
| `app/api/companies/route.ts` | List & create companies |
| `app/api/companies/[id]/route.ts` | Get, update, delete company |
| `app/api/companies/dropdown/route.ts` | Minimal dropdown data |
| `app/(dashboard)/settings/companies/page.tsx` | Company list |
| `app/(dashboard)/settings/companies/new/page.tsx` | New company form |
| `app/(dashboard)/settings/companies/[id]/edit/page.tsx` | Edit company form |

## Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add url, isSystem, deletedAt to Company; add companyId to User |
| `lib/validation/url.ts` | Add companyUrlSchema |
| `lib/validation/user.ts` | Add companyId field |
| `lib/validation/project.ts` | Add companyId field |
| `lib/constants/navigation.ts` | Add Companies tab |
| `app/api/users/route.ts` | Handle companyId |
| `app/api/users/[id]/route.ts` | Handle companyId |
| `app/api/projects/route.ts` | Handle companyId (required) |
| `app/api/projects/[id]/route.ts` | Handle companyId |
| `app/(dashboard)/settings/users/page.tsx` | Add Company column |
| `app/(dashboard)/settings/users/new/page.tsx` | Add Company dropdown |
| `app/(dashboard)/settings/users/[id]/edit/page.tsx` | Add Company dropdown |
| `app/(dashboard)/projects/new/page.tsx` | Add Company dropdown |
| `app/(dashboard)/projects/[id]/edit/page.tsx` | Add Company dropdown |

---

## Testing Checklist

- [ ] Create new company with valid URL
- [ ] Create new company without URL
- [ ] Edit company name and URL
- [ ] Delete company - verify users/projects reassigned to Unassigned
- [ ] Attempt to delete Unassigned company - should be blocked
- [ ] Create user with company selection
- [ ] Create project with company defaulting to user's company
- [ ] Verify company filter/search works on list page
- [ ] Verify existing users/projects migrated to 4All Digital
