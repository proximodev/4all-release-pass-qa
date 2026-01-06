'use client'

import { memo } from 'react'
import type { ResultsProps } from './types'

function PerformanceResults({
  loadingItems,
  resultItems,
}: ResultsProps) {
  if (loadingItems) {
    return <p className="text-black/60">Loading details...</p>
  }

  if (resultItems.length === 0) {
    return <p>No results available for this URL.</p>
  }

  // TODO: Implement Core Web Vitals display (similar to Google PageSpeed layout)
  return (
    <div className="text-black/60 italic">
      Performance details coming soon. This will display Core Web Vitals and metrics similar to Google PageSpeed Insights.
    </div>
  )
}

export default memo(PerformanceResults)
