# Preflight Improvements Implementation Plan

## Summary of Requirements

### A. General Requirements
Use ReleaseRule for all preflight providers (Custom, Linkinator, Lighthouse):
1. ReleaseRule.severity (some rules currently hardcoded)
2. ReleaseRule.description
3. ReleaseRule.impact
4. ReleaseRule.fix
5. ReleaseRule.docUrl

### B. Name/Description Display Changes
- **Pass tests**: `[ReleaseRule.name] - [ReleaseRule.description]` (current behavior)
- **Failed tests**: `[ResultItem.name]` only (no description)

### C. Test Details Changes
1. Reorder: Impact first, Fix second, URL third
2. Add "Error Details" section for failed tests showing ResultItem.meta (LINKINATOR and ReleasePass only)

---

## Current State Analysis

### Worker (`preflight/index.ts`)
- ReleaseRule cache exists but only loads `severity`
- Lighthouse: Uses hardcoded `mapSeoAuditSeverity()` - not using ReleaseRule
- Linkinator: Uses hardcoded `mapLinkSeverity()` - codes are set but no releaseRuleCode lookup
- Custom rules: Uses hardcoded severity in `createFail()`

### UI (`PreflightResults.tsx`)
- Both pass/fail show: `rule.name + rule.description` or fallback to `item.name`
- Details order: Fix, Impact, URL
- No Error Details section

---

## Implementation Plan

### Phase 1: Worker - Expand ReleaseRule Cache & Use for Severity

**File: `worker/providers/preflight/index.ts`**

1. Expand `ReleaseRuleCache` interface to include all needed fields:
```typescript
interface ReleaseRuleCache {
  severity: IssueSeverity;
  name: string;
  description: string;
  impact: string | null;
  fix: string | null;
  docUrl: string | null;
}
```

2. Update `loadReleaseRules()` to select all fields:
```typescript
const rules = await prisma.releaseRule.findMany({
  where: { isActive: true },
  select: {
    code: true,
    severity: true,
    name: true,
    description: true,
    impact: true,
    fix: true,
    docUrl: true,
  },
});
```

3. Pass `rulesMap` to provider functions and use for severity lookup with hardcoded fallback:
   - `runLighthouseSeo(url, rulesMap)` - lookup by `audit.id`
   - `runLinkinator(url, rulesMap)` - lookup by code (BROKEN_INTERNAL_LINK, etc.)
   - `runCustomRulesWithErrorHandling(url, rulesMap)` - pass to custom-rules.ts

4. Update `mapSeoAuditSeverity()` to accept rulesMap and use it with fallback:
```typescript
function getSeverityFromRule(code: string, rulesMap: ReleaseRulesMap, fallbackFn: () => IssueSeverity): IssueSeverity {
  const rule = rulesMap.get(code);
  return rule?.severity ?? fallbackFn();
}
```

**File: `worker/providers/preflight/custom-rules.ts`**

5. Update `runCustomRules()` signature to accept rulesMap
6. Update `createFail()` to lookup severity from rulesMap with hardcoded fallback

### Phase 2: Worker - Add releaseRuleCode to Linkinator Results

**File: `worker/providers/preflight/index.ts`**

The `releaseRuleCode` is already being set at line 247:
```typescript
releaseRuleCode: item.code,
```

Linkinator codes are already correct:
- `BROKEN_INTERNAL_LINK`
- `BROKEN_EXTERNAL_LINK`
- `REDIRECT_CHAIN`
- `LINK_CHECK_PASSED`

**Action**: Verify these codes exist in ReleaseRule table. If not, add seed data.

### Phase 3: UI - Update Display Logic

**File: `components/releasepass/results/PreflightResults.tsx`**

1. **Failed tests row** (line 77-79): Change to show only `item.name`:
```typescript
// Before:
const testName = rule
  ? `${rule.name}${rule.description ? ` - ${rule.description}` : ''}`
  : item.name

// After:
const testName = item.name  // Always use ResultItem.name for failed tests
```

2. **Passed tests row** (line 181-183): Keep current behavior (already correct)

3. **Reorder details** (lines 131-154 and 204-228):
```typescript
// Before: Fix, Impact, URL
// After: Impact, Fix, URL

{rule?.impact && (
  <div className="mb-2">
    <span className="font-medium">Impact: </span>
    <span className="text-black/80">{rule.impact}</span>
  </div>
)}
{rule?.fix && (
  <div className="mb-2">
    <span className="font-medium">Fix: </span>
    <span className="text-black/80">{rule.fix}</span>
  </div>
)}
{rule?.docUrl && (
  <div>
    <a href={rule.docUrl} ...>Learn More</a>
  </div>
)}
```

### Phase 4: UI - Add Error Details Section

**File: `components/releasepass/results/PreflightResults.tsx`**

Add Error Details section for failed items (LINKINATOR and ReleasePass providers only):

```typescript
{/* Error Details - only for LINKINATOR and ReleasePass failed items */}
{item.status === 'FAIL' &&
 (item.provider === 'LINKINATOR' || item.provider === 'ReleasePass') &&
 item.meta && Object.keys(item.meta).length > 0 && (
  <div className="mt-3 pt-3 border-t border-dark-gray/20">
    <span className="font-medium">Error Details:</span>
    <ul className="mt-1 ml-4 list-disc text-black/80">
      {renderMetaFields(item.meta)}
    </ul>
  </div>
)}
```

Add helper function to render meta as nested ul/li:
```typescript
function renderMetaFields(meta: Record<string, any>, depth = 0): React.ReactNode[] {
  return Object.entries(meta).map(([key, value]) => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <li key={key}>
          <span className="font-medium">{key}:</span>
          <ul className="ml-4 list-disc">
            {renderMetaFields(value, depth + 1)}
          </ul>
        </li>
      );
    }

    if (Array.isArray(value)) {
      return (
        <li key={key}>
          <span className="font-medium">{key}:</span>
          <ul className="ml-4 list-disc">
            {value.map((item, i) => (
              <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
            ))}
          </ul>
        </li>
      );
    }

    return (
      <li key={key}>
        <span className="font-medium">{key}:</span> {String(value)}
      </li>
    );
  }).filter(Boolean);
}
```

---

## Files to Modify

| Phase | File | Changes |
|-------|------|---------|
| 1 | `worker/providers/preflight/index.ts` | Expand cache, pass rulesMap to providers, use for severity |
| 1 | `worker/providers/preflight/custom-rules.ts` | Accept rulesMap, lookup severity with fallback |
| 2 | (verify seed data) | Ensure Linkinator codes exist in ReleaseRule |
| 3,4 | `components/releasepass/results/PreflightResults.tsx` | Display changes, Error Details section |

---

## Decisions from Q&A

| Decision | Value |
|----------|-------|
| Severity lookup strategy | Batch cache with hardcoded fallback |
| Scope | Preflight only (not Spelling/Performance) |
| Meta display | Display as-is |
| Linkinator releaseRuleCode | Add codes: BROKEN_INTERNAL_LINK, BROKEN_EXTERNAL_LINK, REDIRECT_CHAIN, LINK_CHECK_PASSED |
| ResultItem.name for failed | Use dynamic messages (Lighthouse excluded from Error Details) |
| Lighthouse names | Keep as-is from API |