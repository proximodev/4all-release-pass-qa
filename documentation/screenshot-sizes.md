## **Recommended Screenshot v1 Baseline (3 shots per URL)**

### **1\) Desktop – Chrome (primary workhorse)**

* Engine: Chromium

* OS (emulated): Windows

* Viewport: **1366 × 768**

* DPR: 1

Why:

* 1366×768 is still one of the most common laptop resolutions.

* This catches:

    * breakpoint bugs

    * nav wrapping

    * sticky header issues

* 1440 hides too many real-world layout problems.

This becomes your **canonical “desktop baseline.”**

---

### **2\) Desktop – Safari (catch the weird stuff)**

* Engine: WebKit

* OS (emulated): macOS

* Viewport: **1366 × 768**

* DPR: 1

Why:

* Safari is still the \#1 source of:

    * flexbox oddities

    * sticky/fixed positioning bugs

    * overflow issues

    * font rendering differences

* Using the *same viewport* as Chrome makes review fast and comparable.

* This single shot eliminates the “but Safari…” post-launch surprise.

---

### **3\) Mobile – iOS Safari (non-negotiable)**

* Engine: WebKit

* Device: iPhone 13 / 14 class

* Viewport: **390 × 844**

* DPR: 3

Why:

* iOS Safari is its own universe.

* This catches:

    * viewport unit bugs

    * fixed bars \+ safe-area issues

    * mobile nav disasters

* One modern iPhone size is enough for v1.

---
## v1.1 Screenshot Baseline Add-On: Tablet (Optional)

An optional tablet breakpoint may be enabled at the project level starting in v1.1.  
This breakpoint is intended to catch layout and navigation issues that occur at common tablet and breakpoint-transition widths, without significantly increasing review burden.

### Tablet – iPad Safari (Emulated)

- Engine: WebKit
- Browser: Safari (emulated)
- Viewport: 768 × 1024 (portrait)
- Device Pixel Ratio (DPR): 2
- Capture Mode: Full-page screenshot
- Stabilization: Same stabilization rules as other screenshots (animations disabled, fonts loaded, dynamic UI hidden)

### Purpose

This breakpoint targets:
- CSS breakpoint transitions at or below 768px
- Navigation collapse or duplication issues
- Sticky and fixed positioning bugs
- iOS Safari–specific layout behavior at tablet widths

### Scope Rules

- Disabled by default
- Enabled via a project-level setting (not per Release Run)
- When enabled, exactly one additional screenshot per URL is captured
- Tablet screenshots participate in the same manual review workflow (PASS / REVIEW / FAIL)
- Tablet screenshots contribute to Release Readiness via manual review status

### Rationale

768px is preferred over 1024px for v1.1 because it:
- Triggers the most common breakpoint logic
- Produces higher bug yield than 1024px
- Minimizes overlap with the 1366px desktop baseline
- Avoids unnecessary screensho
