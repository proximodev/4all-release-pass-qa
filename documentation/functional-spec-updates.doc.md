## **COMPLETE LIST OF RECOMMENDED UPDATES **

### **1\. Provider Status Must Reflect Reality (Do Not Regress This)**

Update the roadmap and provider sections so they clearly reflect:

Already implemented (v1 MVP, built):
* Page Preflight (Linkinator \+ Custom Rules \+ Lighthouse SEO)
* Performance (PageSpeed)
* Spelling & Grammar (LanguageTool \+ Cheerio extraction)

Planned but not implemented yet:
* Browser Screenshots (Playwright capture \+ manual review)

Explicitly deferred:
* SE Ranking Site Audit
  * Site-level only
  * Not part of Release Runs
  * Does not affect Release Readiness in v1

This status must be consistent everywhere in the document (overview, roadmap, QA tests, providers).

---

### **2\. Add Project-Level Authentication Support (Critical)**

Current problem:
* Spec assumes public URLs.
* Real pre-launch environments are almost always gated.

Required update:
* Add project-level authentication configuration.
* Supported auth modes:
  * NONE
  * BASIC\_AUTH (username/password)
  * COOKIE\_HEADER (session cookie)

Where it applies:
* Must be supported for all Playwright-based tests:
  * Screenshots
  * Spelling/Grammar
* Linkinator should pass headers where possible.
* PageSpeed/Lighthouse may not support auth; UI must clearly warn when a URL requires auth that PSI cannot access.

Data model impact:
* Add `authConfig` JSON field to Projects.

---

### **3\. Freeze Configuration, Not Just URLs, in Release Runs**

Current problem:
* URLs are frozen, but config drift can change results later.

Required update:
* ReleaseRun must store an immutable configuration snapshot at creation time.
* This snapshot includes:
  * Thresholds
  * Viewport/browser matrix
  * Provider timeouts
  * Rule-set version
  * Spelling extraction settings

Behavior:
* URLs \+ config become immutable once execution starts.
* Re-running tests uses the same snapshot.

Data model impact:
* Add `configSnapshot` JSON field to ReleaseRun.

NOTE: This is current state. Nothing can be changed with a re-run but with screenshots we will need to store configurations (when we provide a choice).

---

### **4\. Clarify "Current TestRun" Selection Rules**

Current problem:
* "Latest TestRun" is ambiguous and unsafe with retries.

Required rule:
* For each test type within a Release Run:
  * The most recent SUCCESS or PARTIAL run is considered current.
  * FAILED runs do not replace a previous successful run.
  * A RUNNING run temporarily supersedes prior runs in the UI.

This prevents flaky retries from wiping out valid results.

---

### **5\. Separate Execution Status from Quality Assessment (Reinforce)**

This concept exists but must be enforced consistently.

Clarification:
* TestRun.status reflects operational execution only.
* Quality is determined by:
  * Numeric scores
  * Severity penalties
  * Manual review status

This distinction must be preserved everywhere readiness is discussed.

---

### **6\. Add Per-URL Manual Review Overrides (Not Optional)**

Current problem:
* ManualTestStatus is per Release Run per test type.
* One bad page can block everything with no nuance.

Required update:
* Keep existing ManualTestStatus as the overall status.
* Add optional per-URL overrides for:
  * Screenshots
  * Spelling/Grammar

Behavior:
* Any URL-level FAIL causes Release Run to FAIL (unless you later add an explicit override mechanism).
* REVIEW keeps Release Run in PENDING.

Data model impact:
* Add ManualUrlStatus table:
  * releaseRunId
  * projectId
  * testType
  * url
  * status (PASS / REVIEW / FAIL)
  * updatedByUserId

---

### **7\. Screenshot Feature Must Be Framed as Visual QA, Not a Gallery**

Reason:
* Vendors are de-emphasizing screenshot utilities because raw capture is noisy and low trust.

Required changes:
* Screenshots must be explicitly treated as a visual QA workflow.
* Manual review is mandatory.
* Screenshots contribute to Release Readiness via manual status.

---

### **8\. Screenshot Stabilization Is Mandatory (Non-Negotiable)**

Without this, screenshots will be unreliable and ignored.

Required stabilization steps before capture:
* Disable CSS animations and transitions.
* Hide cursor and blinking carets.
* Wait for fonts to load (document.fonts.ready where supported).
* Wait for DOM ready \+ network idle (with max timeout).
* Support project-defined selectors to hide dynamic UI:
  * Cookie banners
  * Chat widgets
  * Rotating promos
  * Geo/location banners

If this is not implemented, screenshot results should be considered unreliable.

---

### **9\. Screenshot Metadata Must Be Extended**

Current ScreenshotSet is insufficient for debugging.

Required additions:
* Browser (e.g., Chrome, Safari)
* Capture metadata:
  * Timing info
  * Viewport dimensions
  * Stabilization flags applied

These fields are necessary for auditability and future diffing.

---

### **10\. Add Failure Evidence Artifacts (Debuggability)**

Current problem:
* A failure without evidence is a time sink.

Required update:
* On FAILED or PARTIAL TestRuns, store artifacts:
  * Console errors
  * Network failure summary
  * Final resolved URL \+ redirect chain
  * Failure screenshot or Playwright trace

Data model impact:
* Add optional debugArtifacts field to TestRun with storage keys.

---

### **11\. Enforce Idempotency for All Worker Outputs**

Current risk:
* Retries can create duplicate screenshots, URL results, or issues.

Required behavior:
* All worker writes must be idempotent using deterministic keys.

Examples:
* Screenshots: (testRunId, url, viewport, browser)
* UrlResult: (testRunId, url)
* ResultItem: (urlResultId, provider, code)

Workers must upsert, not blindly insert.

---

### **12\. Explicitly Define Release Readiness Computation (Central Rule Set)**

Release Readiness must be computed per Release Run only.

States:
* PENDING:
  * Any required test still running
  * Any manual review marked REVIEW
* READY:
  * All required tests complete
  * All scores meet thresholds
  * All manual reviews PASS
* FAIL:
  * Any score below threshold
  * Any BLOCKER severity ResultItem
  * Any manual FAIL (overall or URL-level)

Readiness must be derived dynamically, not stored.

---

### **13\. Severity-Based Scoring Must Remain Consistent**

Confirm and preserve:
* BLOCKER: \-40
* CRITICAL: \-20
* HIGH: \-10
* MEDIUM: \-5
* LOW: \-2

Score starts at 100\.
Pass threshold defaults to 50 (configurable).

---

### **14\. SE Ranking Site Audit Must Be Explicitly Isolated**

Clarify everywhere:
* Site Audit is site-level only.
* Not part of Release Runs.
* Does not block Release Readiness in v1.
* Deferred to v1.2+.

This avoids scope creep and conceptual confusion.

---

### **15\. Merge Checklist (Do Not Ship If Any Are Missing)**

Before considering the spec "merged" or implementation complete, verify:
* MVP providers already built are preserved and marked implemented.
* Screenshots are clearly marked v1 pending.
* Project-level auth exists and is wired into Playwright.
* ReleaseRun freezes config as well as URLs.
* Manual per-URL overrides exist.
* "Current TestRun" selection rule is defined.
* Idempotent worker writes are enforced.
* Failure evidence artifacts are stored.
* Screenshot stabilization is defined.
* Release Readiness logic is centralized and unambiguous.
* SE Ranking is isolated and deferred.
