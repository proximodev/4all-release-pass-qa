# ReleasePass Documentation Updates – Release Run & Page Preflight Model

This document outlines the required documentation updates following the introduction of **Release Runs** (Run Groups) and the refined **Page Preflight** model.

The goal is to align all product, functional, and technical documentation with the new mental model:
> A Release Run represents a single launch candidate, tested as a cohesive unit.

---

## A. Conceptual Model Updates (High Priority)

### New First-Class Concept: Release Run
Documentation must introduce and consistently reference a **Release Run** as:
- A frozen snapshot of:
    - URL list
    - selected page-level tests
- A container for multiple test runs
- The unit of scoring and readiness evaluation

**Key points to document:**
- Release Runs are project-scoped
- URLs are immutable once execution begins
- Page-level tests only (no site-level tests)
- Default test set is all page-level tests
- Each Release Run has a single status: `PENDING`, `READY`, or `FAIL`

---

## B. Scoring & Readiness Logic (High Priority)

### Replace “Latest Test Results” Logic
Any documentation that implies:
- readiness is computed from the *latest test of each type across time*

Must be updated to:
- readiness is computed **per Release Run**

### Release Run Status Definitions
Documentation must clearly define:

- **PENDING**
    - One or more selected tests not yet completed
    - Manual review tests not marked PASS
- **FAIL**
    - One or more blockers present
    - Manual review marked FAIL
- **READY**
    - All selected tests completed
    - No blockers
    - Manual review tests marked PASS

---

## C. Test Execution Model Updates (High Priority)

### TestRun Relationship
Documentation must reflect:
- TestRuns belong to a Release Run
- Multiple TestRuns of the same type may exist, but only the latest per type is “current” within the Release Run
- Re-running a test replaces its result *within the same Release Run*

---

## D. Page Preflight Test Updates (High Priority)

### Lighthouse SEO
Documentation must clarify:
- Lighthouse SEO is used for **binary validation checks only**
- All checks are pass/fail
- No element counts, selectors, or granular diagnostics
- Results are presented as a checklist

### Custom Rules
Documentation must define:
- Custom rules exist to cover launch-critical gaps not handled by Lighthouse
- Emphasis on **hard blockers** (e.g. noindex, canonical intent, H1 errors)

### Linkinator
Documentation must clarify:
- Linkinator handles link and resource health only
- Results are itemized, actionable issues
- No SEO heuristics or anchor analysis

---

## E. Issue Model & Metadata (Medium Priority)

Documentation should introduce or clarify:
- `Issue.impact` (BLOCKER | WARNING | INFO)
- Distinction between:
    - provider (source)
    - impact (release relevance)
- How impact affects scoring and release readiness

---

## F. UI / UX Documentation Updates (Medium Priority)

### Release-Centric UX
Documentation should reflect:
- Primary navigation around Release Runs
- Project as a container, not the execution unit
- Release Run detail view as the primary results workspace

### Page Preflight Results UI
Documentation must reflect:
- URL selector per Release Run
- Lighthouse checklist
- Issue tables for Linkinator and Custom Rules
- Per-test rerun actions

---

## G. Out-of-Scope Clarifications (Low Priority but Important)

Documentation should explicitly state:
- Site-level audits (SE Ranking) are not part of Release Runs
- URL presets are not supported in MVP
- Environments, versioning, and Git integration are future considerations

---

## H. Terminology Cleanup (Critical)

Ensure consistent usage of:
- “Release Run” (preferred)
- Avoid ambiguous terms like:
    - “latest run”
    - “current state” (without context)
    - “overall readiness” (unless tied to a Release Run)

---

## Summary
After these updates:
- Documentation should answer: “Is *this release* ready?”
- Not: “What do our latest tests say?”
