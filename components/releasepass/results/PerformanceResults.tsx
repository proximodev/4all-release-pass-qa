'use client'

import { memo, useMemo } from 'react'
import type { ResultsProps } from './types'
import type { UrlResultData } from '@/lib/types/releasepass'
import { getScoreBadgeClasses } from '@/lib/scoring'
import {
  WEB_VITALS_THRESHOLDS,
  LAB_METRICS,
  FIELD_METRICS,
  getVitalRating,
  getVitalTextColor,
  formatVitalValue,
} from '@/lib/constants/webVitals'

interface MetricRowProps {
  metric: keyof typeof WEB_VITALS_THRESHOLDS
  value: number | null | undefined
}

function MetricRow({ metric, value }: MetricRowProps) {
  const threshold = WEB_VITALS_THRESHOLDS[metric]
  const rating = getVitalRating(metric, value)
  const colorClass = getVitalTextColor(rating)
  const formattedValue = formatVitalValue(metric, value)

  return (
    <div className="flex justify-between items-center py-2 border-b border-dark-gray/20 last:border-b-0">
      <div className="flex flex-col">
        <span>{threshold.shortLabel}</span>
        <span className="text-s text-black/60">{threshold.label}</span>
      </div>
      <strong><span className={`${colorClass}`}>
        {formattedValue}
      </span></strong>
    </div>
  )
}

interface ViewportColumnProps {
  viewport: 'mobile' | 'desktop'
  urlResult: UrlResultData | undefined
}

function ViewportColumn({ viewport, urlResult }: ViewportColumnProps) {
  const title = viewport === 'mobile' ? 'Mobile' : 'Desktop'
  const score = urlResult?.score ?? null

  // Check if field data is available
  const hasFieldData = urlResult?.additionalMetrics?.hasFieldData === true

  // Get field data values from additionalMetrics
  const fieldData = useMemo(() => {
    if (!hasFieldData || !urlResult?.additionalMetrics) return null
    return {
      lcp: urlResult.additionalMetrics.fieldLcp as number | null,
      cls: urlResult.additionalMetrics.fieldCls as number | null,
      inp: urlResult.additionalMetrics.fieldInp as number | null,
    }
  }, [hasFieldData, urlResult?.additionalMetrics])

  if (!urlResult) {
    return (
      <div className="flex-1 min-w-[280px]">
        <h4 className="text-lg font-semibold mb-4">{title}</h4>
        <p className="text-black/60">No data available</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-[280px]">
      {/* Header with score */}
      <div className="flex items-center gap-2 mb-4">
        <h4 className="text-lg mb-0">{title}</h4>
        {score !== null && (
          <span className={`px-2 py-0.5 text-sm ${getScoreBadgeClasses(score)}`}>
            {score}
          </span>
        )}
      </div>

      {/* Lab Data Section */}
      <div className="mb-6">
        <h5>Lab Data</h5>
        <div className="bg-light-gray rounded-lg p-4">
          {LAB_METRICS.map((metric) => (
            <MetricRow
              key={metric}
              metric={metric}
              value={urlResult[metric as keyof UrlResultData] as number | null}
            />
          ))}
        </div>
      </div>

      {/* Field Data Section (if available) */}
      {hasFieldData && fieldData && (
        <div>
          <h5>Field Data (CrUX)</h5>
          <div className="bg-light-gray rounded-lg p-4">
            {FIELD_METRICS.map((metric) => (
              <MetricRow
                key={metric}
                metric={metric}
                value={fieldData[metric as keyof typeof fieldData]}
              />
            ))}
          </div>
        </div>
      )}

      {!hasFieldData && (
        <div>
          <h5>
            Field Data (CrUX)
          </h5>
          <p className="text-black/40 italic">
            No field data available for this URL
          </p>
        </div>
      )}
    </div>
  )
}

function PerformanceResults({
  loadingItems,
  urlResults,
  currentUrl,
}: ResultsProps) {
  // Find mobile and desktop results for the current URL
  const { mobileResult, desktopResult } = useMemo(() => {
    if (!urlResults || !currentUrl) {
      return { mobileResult: undefined, desktopResult: undefined }
    }

    return {
      mobileResult: urlResults.find(
        (ur) => ur.url === currentUrl && ur.viewport === 'mobile'
      ),
      desktopResult: urlResults.find(
        (ur) => ur.url === currentUrl && ur.viewport === 'desktop'
      ),
    }
  }, [urlResults, currentUrl])

  if (loadingItems) {
    return <p className="text-black/60">Loading performance data...</p>
  }

  if (!mobileResult && !desktopResult) {
    return <p className="text-black/60">No performance data available for this URL.</p>
  }

  return (
    <div>
      <h3 className="mb-4">Core Web Vitals</h3>
      <div className="flex flex-col md:flex-row gap-8">
        <ViewportColumn viewport="mobile" urlResult={mobileResult} />
        <ViewportColumn viewport="desktop" urlResult={desktopResult} />
      </div>
    </div>
  )
}

export default memo(PerformanceResults)
