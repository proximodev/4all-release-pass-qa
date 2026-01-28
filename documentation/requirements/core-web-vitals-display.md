# Core Web Vitals Display Implementation Plan

## Overview

Add Core Web Vitals display to the Performance results page, showing lab metrics for both Mobile and Desktop viewports side-by-side with Google PageSpeed-style color thresholds.

## Current State

- Core Web Vitals are already stored in `UrlResult` table: `lcp`, `cls`, `inp`, `fcp`, `tbt`, `tti`
- Field data (CrUX) stored in `additionalMetrics` JSON: `fieldLcp`, `fieldCls`, `fieldInp`, `hasFieldData`
- Data is collected by worker via PageSpeed API but not displayed in UI
- `PerformanceResults.tsx` is a stub component with placeholder Mobile/Desktop headers

## Changes Required

### 1. API Update
**File:** `app/api/release-runs/[id]/route.ts`

Add CWV fields to urlResults select (lines 45-56):
```typescript
urlResults: {
  select: {
    id: true,
    url: true,
    viewport: true,
    issueCount: true,
    score: true,
    additionalMetrics: true,
    // Add Core Web Vitals
    lcp: true,
    cls: true,
    inp: true,
    fcp: true,
    tbt: true,
    tti: true,
    _count: {
      select: { resultItems: true },
    },
  },
},
```

### 2. Type Update
**File:** `lib/types/releasepass.ts`

Add CWV fields to `UrlResultData` interface:
```typescript
export interface UrlResultData {
  id: string
  url: string
  viewport?: string | null
  issueCount?: number
  additionalMetrics?: Record<string, any>
  resultItems?: ResultItem[]
  score?: number | null
  // Core Web Vitals
  lcp?: number | null
  cls?: number | null
  inp?: number | null
  fcp?: number | null
  tbt?: number | null
  tti?: number | null
}
```

### 3. Threshold Constants (New File)
**File:** `lib/constants/webVitals.ts`

```typescript
export const WEB_VITALS_THRESHOLDS = {
  lcp: { good: 2.5, needsImprovement: 4.0, unit: 's', label: 'Largest Contentful Paint' },
  fcp: { good: 1.8, needsImprovement: 3.0, unit: 's', label: 'First Contentful Paint' },
  cls: { good: 0.1, needsImprovement: 0.25, unit: '', label: 'Cumulative Layout Shift' },
  tbt: { good: 200, needsImprovement: 600, unit: 'ms', label: 'Total Blocking Time' },
  tti: { good: 3.8, needsImprovement: 7.3, unit: 's', label: 'Time to Interactive' },
  inp: { good: 200, needsImprovement: 500, unit: 'ms', label: 'Interaction to Next Paint' },
}

export function getVitalRating(metric: keyof typeof WEB_VITALS_THRESHOLDS, value: number): 'good' | 'needs-improvement' | 'poor'
export function getVitalColorClass(rating: 'good' | 'needs-improvement' | 'poor'): string
```

### 4. Props Update
**File:** `components/releasepass/results/types.ts`

Add optional `urlResults` prop:
```typescript
export interface ResultsProps {
  // ... existing props
  urlResults?: UrlResultData[]  // For Performance - contains CWV data
  currentUrl?: string           // Current URL being viewed
}
```

### 5. Parent Component Update
**File:** `components/releasepass/TestResultDetail.tsx`

Pass `urlResults` and current URL to PerformanceResults:
```typescript
{testType === 'PERFORMANCE' && (
  <PerformanceResults
    resultItems={resultItems}
    failedItems={failedItems}
    passedItemsByCategory={passedItemsByCategory}
    expandedItemId={expandedItemId}
    setExpandedItemId={setExpandedItemId}
    loadingItems={loadingItems}
    urlResults={urlResults}
    currentUrl={urlResult?.url}
  />
)}
```

### 6. PerformanceResults Component
**File:** `components/releasepass/results/PerformanceResults.tsx`

Implement Core Web Vitals display:
- Side-by-side Mobile/Desktop columns
- Score badge for each viewport (using existing `getScoreBadgeClasses`)
- Lab metrics table: LCP, FCP, CLS, TBT, TTI
- Each metric shows value with unit and color-coded indicator
- Field data section (when `hasFieldData` is true in additionalMetrics)

## UI Layout

```
+---------------------------+---------------------------+
|         Mobile            |         Desktop           |
+---------------------------+---------------------------+
| Score: [85]               | Score: [92]               |
+---------------------------+---------------------------+
| Lab Data                  | Lab Data                  |
| LCP    2.1s    [green]    | LCP    1.8s    [green]    |
| FCP    1.2s    [green]    | FCP    0.9s    [green]    |
| CLS    0.05    [green]    | CLS    0.02    [green]    |
| TBT    150ms   [green]    | TBT    80ms    [green]    |
| TTI    3.2s    [green]    | TTI    2.8s    [green]    |
+---------------------------+---------------------------+
| Field Data (if available) | Field Data (if available) |
| LCP    2.3s    [green]    | LCP    1.9s    [green]    |
| CLS    0.08    [green]    | CLS    0.03    [green]    |
| INP    180ms   [green]    | INP    120ms   [green]    |
+---------------------------+---------------------------+
```

## Metrics Reference

| Metric | Unit | Good (green) | Needs Improvement (yellow) | Poor (red) |
|--------|------|--------------|---------------------------|------------|
| LCP | seconds | ≤2.5 | ≤4.0 | >4.0 |
| FCP | seconds | ≤1.8 | ≤3.0 | >3.0 |
| CLS | score | ≤0.1 | ≤0.25 | >0.25 |
| TBT | ms | ≤200 | ≤600 | >600 |
| TTI | seconds | ≤3.8 | ≤7.3 | >7.3 |
| INP | ms | ≤200 | ≤500 | >500 |

## Notes

- INP is only available as field data (CrUX) - there is no lab equivalent
- Field data may not be available for all URLs (depends on CrUX coverage)
- Color classes should use existing Tailwind utilities or scoring classes from `lib/scoring`
- Layout should be responsive - stack vertically on mobile screens