# Page Preflight – Results UI Model

This document defines the recommended UI model for **Page Preflight** results.  
Page Preflight is designed for validating **a single page or a small list of pages** prior to launch, using fast, deterministic checks.

Page Preflight intentionally differs from full site audits:
- It prioritizes **clarity and actionability**
- It avoids crawl-level noise
- It surfaces only issues relevant to launch readiness

---

## 1. Data Sources & Mental Model

Page Preflight aggregates results from three providers, each with a distinct data shape and UX treatment:

| Provider | Purpose | Data Shape | UI Pattern |
|--------|--------|-----------|-----------|
| Lighthouse (SEO) | Validation checks | Binary pass/fail (ResultItems) | Checklist |
| Linkinator | Link health | Itemized failures (ResultItems) | Table / issue list |
| Custom Rules | Extensible validation | Itemized results (ResultItems) | Table / grouped list |

The UI **must respect these differences**. Attempting to present all results as a single "issue list" will reduce clarity and trust.

**Data Model**: All check results are stored as `ResultItem` records linked to `UrlResult`. Each ResultItem has a `status` (PASS/FAIL/SKIP) and, for failures, a `severity` field (BLOCKER, CRITICAL, HIGH, MEDIUM, LOW) that determines score penalties.

---

## 2. Page Preflight Summary (Top of Results View)

Displayed at the top of the results page.

### Elements
- **Preflight Score (0–100)**
- URL count (e.g. “3 URLs tested”)
- Provider summary badges:
    - Lighthouse: `X / Y checks passed`
    - Links: `N broken links`
    - Custom Rules: `K issues`

### Purpose
- Provide an at-a-glance readiness signal
- Feed into Release Readiness calculations
- Allow fast comparison between runs

---
R
## 3. URL Selector (Primary Navigation)

Because Page Preflight may run against multiple URLs, results must be navigated **per URL**.

### Behavior
- Default to first URL in run
- Switching URLs updates:
    - Lighthouse checks
    - Linkinator results
    - Custom rule issues
- The Preflight Score remains run-level but may show per-URL contribution visually

### UI Pattern
- Dropdown or left-side list
- Clear indication of active URL
- Optional per-URL status indicator (pass / warning / fail)

---

## 4. Lighthouse SEO Results (Checklist UI)

### Presentation Rules
- Lighthouse SEO results are **binary validation checks**
- They should be presented as a **checklist**, not as issues

### Example Checks
- Page has a title tag
- Page has a meta description
- Page is crawlable
- Page has a valid canonical
- Images have alt attributes
- Links have descriptive text

### UI Pattern
- List or table with:
    - Pass / Fail icon
    - Check name
    - Short description (tooltip or inline)

### Explicit Constraints
- Do **not** attempt to show:
    - DOM selectors
    - Counts of offending elements
    - Lists of images or links
- Lighthouse does not provide this data reliably and the UI should not imply it does

---

## 5. Linkinator Results (Actionable Issues Table)

### Purpose
Surface broken or problematic links that must be fixed before launch.

### Issue Types
- Broken internal links (4XX / 5XX)
- Broken external links
- Missing resources (images, CSS, JS)
- Redirect chains
- Redirect loops

### UI Pattern
- Table with filtering and sorting
- Each row represents a single failing link

### Recommended Columns
- Link URL
- Source page (current URL)
- Status code
- Link type (internal / external / resource)
- Severity

### Interaction
- Filter by severity or link type
- Expand row for redirect chain details (if applicable)

---

## 6. Custom Rules Results (Extensible Issue List)

Custom rules allow project-specific or future checks without redesigning the UI.

### Examples
- Title length exceeds recommended limits
- Missing Open Graph tags
- Missing Twitter Card tags

### UI Pattern
- Same visual language as Linkinator issues
- Grouped by rule name or category
- Each issue includes:
    - Summary
    - Severity
    - Optional metadata (e.g. selector, tag name)

### Provider Labeling
- Clearly marked as `Custom Rule`
- Avoid mixing with Lighthouse checks

---

## 7. Severity & Scoring Visibility

### Severity Levels
- **BLOCKER** — -40 points (e.g., broken internal links, page not crawlable)
- **CRITICAL** — -20 points (e.g., missing title, meta description)
- **HIGH** — -10 points (e.g., missing canonical)
- **MEDIUM** — -5 points (e.g., external broken links)
- **LOW** — -2 points (e.g., redirect chains)

Severity determines:
- Score penalties (deducted from base score of 100)
- Visual prioritization of fixes
- Pass/fail status (score >= 50 = pass)

### UX Guidance
- Severity should be visually distinct
- Avoid excessive color usage; rely on consistent badges/icons

---

## 8. Design Principles (Non-Negotiable)

1. **Do not blur provider boundaries**
    - Lighthouse ≠ Issues
    - Linkinator ≠ SEO heuristics

2. **Prefer clarity over completeness**
    - Page Preflight is a launch gate, not an SEO encyclopedia

3. **Actionable beats exhaustive**
    - If a result cannot be acted on, it should not dominate the UI

4. **One URL at a time**
    - Multi-URL support exists, but focus is per-page validation

---

## 9. Future Compatibility

This UI model intentionally aligns with:
- SE Ranking full-site audits (future)
- Accessibility scans (axe-core)
- Analytics / JSON-LD validation

Future providers should plug into:
- Checklist-style validation
- Itemized issue tables
  without requiring a structural UI rewrite.
