'use client'

import { Fragment, memo, useMemo, useState } from 'react'
import { getSeveritySortOrder } from '@/lib/config/scoring'
import type { ResultsProps } from './types'

function SpellingResults({
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
                  <th className="py-2 text-left pr-6"><strong>Error</strong></th>
                  <th className="py-2 text-left pr-6"><strong>Context</strong></th>
                  <th className="py-2 text-left pr-6 whitespace-nowrap"><strong>Severity</strong></th>
                  {onIgnoreToggle && <th className="py-2 w-20 text-center"><strong>Ignore</strong></th>}
                  <th className="py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sortedFailedItems.map((item, index) => {
                  const rule = item.releaseRule
                  const isExpanded = expandedItemId === item.id
                  const hasDetails = rule && (rule.fix || rule.impact || rule.docUrl)
                  const testName = rule
                    ? `${rule.name}${rule.description ? ` - ${rule.description}` : ''}`
                    : item.name
                  const severityValue = rule?.severity || item.severity || '—'
                  const isLastItem = index === sortedFailedItems.length - 1
                  const isIgnored = item.ignored ?? false
                  const isToggling = togglingIds.has(item.id)

                  // Extract context with highlighting for spelling errors
                  const meta = item.meta as { context?: string; contextOffset?: number; contextLength?: number } | null
                  const contextText = meta?.context || ''
                  const contextOffset = meta?.contextOffset ?? 0
                  const contextLength = meta?.contextLength ?? 0

                  // Build highlighted context
                  let contextDisplay: React.ReactNode = null
                  if (contextText && contextLength > 0) {
                    const before = contextText.substring(0, contextOffset)
                    const highlighted = contextText.substring(contextOffset, contextOffset + contextLength)
                    const after = contextText.substring(contextOffset + contextLength)
                    contextDisplay = (
                      <span>
                        {before}<mark className="bg-yellow-200 px-0.5">{highlighted}</mark>{after}
                      </span>
                    )
                  } else if (contextText) {
                    contextDisplay = contextText
                  }

                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`${isLastItem && !isExpanded ? '' : 'border-b border-dark-gray/40'} ${hasDetails ? 'cursor-pointer' : ''} ${isIgnored ? 'opacity-50' : ''}`}
                        onClick={() => hasDetails && setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <td className={`py-2 pr-6 align-top ${isIgnored ? 'line-through' : ''}`}>{testName}</td>
                        <td className={`py-2 pr-6 align-top ${isIgnored ? 'line-through' : ''}`}>{contextDisplay}</td>
                        <td className={`py-2 pr-6 align-top whitespace-nowrap ${isIgnored ? 'line-through' : ''}`}>{severityValue}</td>
                        {onIgnoreToggle && (
                          <td className="py-2 text-center">
                            <button
                              onClick={(e) => handleIgnoreClick(e, item.id, isIgnored)}
                              disabled={isToggling}
                              className={`p-1 rounded hover:bg-black/10 transition-colors ${isToggling ? 'opacity-50' : ''}`}
                              title={isIgnored ? 'Include in score' : 'Ignore (false positive)'}
                            >
                              {isIgnored ? (
                                <svg className="w-5 h-5 text-black/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-black/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              )}
                            </button>
                          </td>
                        )}
                        <td className="py-2 align-top text-right">
                          {hasDetails && (
                            <svg
                              className={`w-4 h-4 inline-block transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                            </svg>
                          )}
                        </td>
                      </tr>
                      {isExpanded && rule && (
                        <tr key={`${item.id}-details`}>
                          <td colSpan={onIgnoreToggle ? 5 : 4} className="bg-black/5 py-3 px-4 border-b border-dark-gray/40">
                            {rule.fix && (
                              <div className="mb-2">
                                <span className="font-medium">How to Fix: </span>
                                <span className="text-black/80">{rule.fix}</span>
                              </div>
                            )}
                            {rule.impact && (
                              <div className="mb-2">
                                <span className="font-medium">Impact: </span>
                                <span className="text-black/80">{rule.impact}</span>
                              </div>
                            )}
                            {rule.docUrl && (
                              <div>
                                <a
                                  href={rule.docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-cyan underline"
                                >
                                  Learn more →
                                </a>
                              </div>
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

      {/* Passed Section - simplified for spelling */}
      {passedItemsByCategory.length > 0 && (
        <div>
          <h3 className="mb-3">Passed Tests</h3>
          {passedItemsByCategory.map((category) => (
            <div key={category.name} className="mb-4">
              <div className="space-y-0">
                {category.items.map((item, index) => {
                  const testName = item.name
                  const isLastItem = index === category.items.length - 1

                  return (
                    <div
                      key={item.id}
                      className={`py-2 ${isLastItem ? '' : 'border-b border-dark-gray/40'}`}
                    >
                      {testName}
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

export default memo(SpellingResults)
