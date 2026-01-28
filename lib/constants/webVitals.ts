/**
 * Core Web Vitals Thresholds and Helpers
 *
 * Based on Google's Web Vitals thresholds:
 * https://web.dev/articles/vitals
 */

export interface VitalThreshold {
  good: number
  needsImprovement: number
  unit: string
  label: string
  shortLabel: string
}

export const WEB_VITALS_THRESHOLDS: Record<string, VitalThreshold> = {
  lcp: {
    good: 2.5,
    needsImprovement: 4.0,
    unit: 's',
    label: 'Largest Contentful Paint',
    shortLabel: 'LCP',
  },
  fcp: {
    good: 1.8,
    needsImprovement: 3.0,
    unit: 's',
    label: 'First Contentful Paint',
    shortLabel: 'FCP',
  },
  cls: {
    good: 0.1,
    needsImprovement: 0.25,
    unit: '',
    label: 'Cumulative Layout Shift',
    shortLabel: 'CLS',
  },
  tbt: {
    good: 200,
    needsImprovement: 600,
    unit: 'ms',
    label: 'Total Blocking Time',
    shortLabel: 'TBT',
  },
  tti: {
    good: 3.8,
    needsImprovement: 7.3,
    unit: 's',
    label: 'Time to Interactive',
    shortLabel: 'TTI',
  },
  inp: {
    good: 200,
    needsImprovement: 500,
    unit: 'ms',
    label: 'Interaction to Next Paint',
    shortLabel: 'INP',
  },
}

export type VitalRating = 'good' | 'needs-improvement' | 'poor'

/**
 * Get the rating (good/needs-improvement/poor) for a metric value
 */
export function getVitalRating(
  metric: keyof typeof WEB_VITALS_THRESHOLDS,
  value: number | null | undefined
): VitalRating | null {
  if (value === null || value === undefined) return null

  const threshold = WEB_VITALS_THRESHOLDS[metric]
  if (!threshold) return null

  if (value <= threshold.good) return 'good'
  if (value <= threshold.needsImprovement) return 'needs-improvement'
  return 'poor'
}

/**
 * Get Tailwind color classes for a rating
 */
export function getVitalColorClass(rating: VitalRating | null): string {
  switch (rating) {
    case 'good':
      return 'text-green bg-green/10'
    case 'needs-improvement':
      return 'text-yellow-600 bg-yellow-100'
    case 'poor':
      return 'text-red bg-red/10'
    default:
      return 'text-black/60 bg-black/5'
  }
}

/**
 * Get just the text color class for a rating
 */
export function getVitalTextColor(rating: VitalRating | null): string {
  switch (rating) {
    case 'good':
      return 'text-green'
    case 'needs-improvement':
      return 'text-yellow-600'
    case 'poor':
      return 'text-red'
    default:
      return 'text-black/60'
  }
}

/**
 * Format a metric value with its unit
 */
export function formatVitalValue(
  metric: keyof typeof WEB_VITALS_THRESHOLDS,
  value: number | null | undefined
): string {
  if (value === null || value === undefined) return '—'

  const threshold = WEB_VITALS_THRESHOLDS[metric]
  if (!threshold) return String(value)

  // CLS has no unit and should show 2 decimal places
  if (metric === 'cls') {
    return value.toFixed(2)
  }

  // Format with appropriate precision
  const formatted = value < 10 ? value.toFixed(1) : Math.round(value).toString()
  return `${formatted}${threshold.unit}`
}

/**
 * Lab metrics to display (in order)
 */
export const LAB_METRICS: (keyof typeof WEB_VITALS_THRESHOLDS)[] = [
  'lcp',
  'fcp',
  'cls',
  'tbt',
  'tti',
]

/**
 * Field metrics to display (in order)
 */
export const FIELD_METRICS: (keyof typeof WEB_VITALS_THRESHOLDS)[] = [
  'lcp',
  'cls',
  'inp',
]