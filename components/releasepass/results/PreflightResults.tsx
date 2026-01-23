'use client'

import { Fragment, memo, useMemo, useState } from 'react'
import { getSeveritySortOrder } from '@/lib/scoring'
import type { ResultsProps } from './types'
import { IgnoreToggleButton } from './IgnoreToggleButton'

/**
 * Render meta fields as nested ul/li structure
 * Displays ResultItem.meta data as-is for error details
 */
function renderMetaFields(meta: Record<string, unknown>, depth = 0): React.ReactNode[] {
  const maxDepth = 3 // Prevent infinite nesting

  return Object.entries(meta).map(([key, value]) => {
    if (value === null || value === undefined) return null

    // Handle nested objects
    if (typeof value === 'object' && !Array.isArray(value) && depth < maxDepth) {
      return (
        <li key={key}>
          <span className="font-medium">{key}:</span>
          <ul className="ml-4 list-disc">
            {renderMetaFields(value as Record<string, unknown>, depth + 1)}
          </ul>
        </li>
      )
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return null
      return (
        <li key={key}>
          <span className="font-medium">{key}:</span>
          <ul className="ml-4 list-disc">
            {value.slice(0, 10).map((item, i) => (
              <li key={i} className={typeof item === 'object' && item !== null ? 'list-none' : ''}>
                {typeof item === 'object' && item !== null ? (
                  <ul className="list-disc">
                    {renderMetaFields(item as Record<string, unknown>, depth + 1)}
                  </ul>
                ) : String(item)}
              </li>
            ))}
            {value.length > 10 && <li className="text-black/60">...and {value.length - 10} more</li>}
          </ul>
        </li>
      )
    }

    // Handle primitive values
    return (
      <li key={key}>
        <span className="font-medium">{key}:</span> {String(value)}
      </li>
    )
  }).filter(Boolean)
}

function PreflightResults({
  failedItems,
  passedItemsByCategory,
  expandedItemId,
  setExpandedItemId,
  loadingItems,
  resultItems,
  onIgnoreToggle,
}: ResultsProps) {
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  const sortedFailedItems = useMemo(() => {
    // Sort: non-ignored first by severity, then ignored items
    return [...failedItems].sort((a, b) => {
      // Ignored items go to the end
      if (a.ignored !== b.ignored) {
        return a.ignored ? 1 : -1
      }
      const severityA = a.releaseRule?.severity || a.severity
      const severityB = b.releaseRule?.severity || b.severity
      return getSeveritySortOrder(severityA) - getSeveritySortOrder(severityB)
    })
  }, [failedItems])

  const handleIgnoreClick = async (e: React.MouseEvent, itemId: string, currentIgnored: boolean) => {
    e.stopPropagation()
    if (!onIgnoreToggle || togglingIds.has(itemId)) return

    setTogglingIds(prev => new Set(prev).add(itemId))
    try {
      await onIgnoreToggle(itemId, !currentIgnored)
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  if (loadingItems) {
    return <p className="text-black/60">Loading details...</p>
  }

  if (resultItems.length === 0) {
    return <p>No results available for this URL.</p>
  }

  return (
    <>
      {/* Failed Section */}
      {failedItems.length > 0 && (
        <div className="mb-6">
          <h3>Failed Tests</h3>
          <div className="overflow-hidden">
            <table className="w-full text-m">
              <thead>
                <tr className="border-b border-dark-gray/40">
                  <th className="py-2 text-left pr-6"><strong>Category</strong></th>
                  <th className="py-2 text-left pr-6"><strong>Error</strong></th>
                  <th className="py-2 text-left pr-6 whitespace-nowrap"><strong>Severity</strong></th>
                  {onIgnoreToggle && <th className="py-2 w-20 text-center"><strong>Ignore</strong></th>}
                  <th className="py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sortedFailedItems.map((item, index) => {
                  const rule = item.releaseRule
                  const isExpanded = expandedItemId === item.id
                  // For failed tests: always use ResultItem.name (dynamic error message)
                  const testName = item.name
                  // Use rule category, or fall back to provider name
                  const categoryName = rule?.category?.name || item.provider || '—'
                  const severityValue = rule?.severity || item.severity || '—'
                  const isLastItem = index === sortedFailedItems.length - 1
                  const isIgnored = item.ignored ?? false
                  const isToggling = togglingIds.has(item.id)

                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`${isLastItem && !isExpanded ? '' : 'border-b border-dark-gray/40'} cursor-pointer ${isIgnored ? 'opacity-50' : ''}`}
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <td className={`py-2 pr-6 whitespace-nowrap ${isIgnored ? 'line-through' : ''}`}>{categoryName}</td>
                        <td className={`py-2 pr-6 ${isIgnored ? 'line-through' : ''}`}>{testName}</td>
                        <td className={`py-2 pr-6 whitespace-nowrap ${isIgnored ? 'line-through' : ''}`}>{severityValue}</td>
                        {onIgnoreToggle && (
                          <td className="py-2 text-center">
                            <IgnoreToggleButton
                              isIgnored={isIgnored}
                              isToggling={isToggling}
                              onClick={(e) => handleIgnoreClick(e, item.id, isIgnored)}
                            />
                          </td>
                        )}
                        <td className="py-2 text-right">
                          <svg
                            className={`w-4 h-4 inline-block transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                          </svg>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${item.id}-details`}>
                          <td colSpan={onIgnoreToggle ? 5 : 4} className="bg-black/5 py-3 px-4 border-b border-dark-gray/40">
                            {rule?.impact && (
                              <div className="mb-2">
                                <span className="font-medium">Impact: </span>
                                <span className="text-black/80">{rule.impact}</span>
                              </div>
                            )}
                            {rule?.fix && (
                              <div className="mb-2">
                                <span className="font-medium">Fix: </span>
                                <span className="text-black/80">{rule.fix}</span>
                              </div>
                            )}
                            {rule?.docUrl && (
                              <div className="mb-2">
                                <a
                                  href={rule.docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-cyan underline"
                                >
                                  Learn More
                                </a>
                              </div>
                            )}
                            {/* Error Details - only for LINKINATOR and ReleasePass failed items */}
                            {(item.provider === 'LINKINATOR' || item.provider === 'ReleasePass') &&
                             item.meta && Object.keys(item.meta).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-dark-gray/20">
                                <span className="font-medium">Error Details:</span>
                                <ul className="mt-1 ml-4 list-disc text-black/80 text-m">
                                  {renderMetaFields(item.meta)}
                                </ul>
                              </div>
                            )}
                            {!rule?.fix && !rule?.impact && !rule?.docUrl &&
                             !(item.provider === 'LINKINATOR' || item.provider === 'ReleasePass') && (
                              <span className="text-black/60">No additional details available.</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Passed Section */}
      {passedItemsByCategory.length > 0 && (
        <div>
          <h3 className="mb-3">Passed Tests</h3>
          {passedItemsByCategory.map((category) => (
            <div key={category.name} className="mb-4">
              <h4 className="mb-2">{category.name}</h4>
              <div className="space-y-0">
                {category.items.map((item, index) => {
                  const rule = item.releaseRule
                  const isExpanded = expandedItemId === item.id
                  const testName = rule
                    ? `${rule.name}${rule.description ? ` - ${rule.description}` : ''}`
                    : item.name
                  const isLastItem = index === category.items.length - 1

                  return (
                    <div key={item.id}>
                      <div
                        className={`py-2 ${isLastItem && !isExpanded ? '' : 'border-b border-dark-gray/40'} flex items-center justify-between cursor-pointer`}
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <span>{testName}</span>
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                      {isExpanded && (
                        <div className="bg-black/5 py-3 px-4">
                          {rule?.impact && (
                            <div className="mb-2">
                              <span className="font-medium">Impact: </span>
                              <span className="text-black/80">{rule.impact}</span>
                            </div>
                          )}
                          {rule?.fix && (
                            <div className="mb-2">
                              <span className="font-medium">Fix: </span>
                              <span className="text-black/80">{rule.fix}</span>
                            </div>
                          )}
                          {rule?.docUrl && (
                            <div>
                              <a
                                href={rule.docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-cyan underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Learn More
                              </a>
                            </div>
                          )}
                          {!rule?.fix && !rule?.impact && !rule?.docUrl && (
                            <span className="text-black/60">No additional details available.</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default memo(PreflightResults)
