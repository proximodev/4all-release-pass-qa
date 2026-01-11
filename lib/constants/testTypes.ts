export const TEST_TYPES = [
  { value: 'PAGE_PREFLIGHT', label: 'Preflight Baseline', route: 'baseline', defaultChecked: true },
  { value: 'PERFORMANCE', label: 'Performance', route: 'performance', defaultChecked: true },
  { value: 'SPELLING', label: 'Spelling / Grammar', route: 'spelling', defaultChecked: true },
  { value: 'SCREENSHOTS', label: 'Browser Screenshots', route: 'browser', defaultChecked: true },
  { value: 'SITE_AUDIT', label: 'Site Audit', route: 'site-audit', defaultChecked: false },
] as const

export type TestTypeValue = (typeof TEST_TYPES)[number]['value']

// Derived lookup objects for convenience
export const TEST_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TEST_TYPES.map((t) => [t.value, t.label])
)

export const TEST_TYPE_ROUTES: Record<string, string> = Object.fromEntries(
  TEST_TYPES.map((t) => [t.value, t.route])
)

// Preflight-only types (excludes SITE_AUDIT)
export const PREFLIGHT_TEST_TYPES = TEST_TYPES.filter((t) => t.value !== 'SITE_AUDIT')
