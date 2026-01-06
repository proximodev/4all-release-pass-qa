'use client'

import { memo } from 'react'
import type { ResultsProps } from './types'

function BrowserResults({
  loadingItems,
  resultItems,
}: ResultsProps) {
  if (loadingItems) {
    return <p className="text-black/60">Loading details...</p>
  }

  if (resultItems.length === 0) {
    return <p>No results available for this URL.</p>
  }

  // TODO: Implement screenshot grid with drilldown for larger view and notes
  return (
    <div className="text-black/60 italic">
      Browser screenshot details coming soon. This will display a grid of screenshots with the ability to view larger and add notes.
    </div>
  )
}

export default memo(BrowserResults)
