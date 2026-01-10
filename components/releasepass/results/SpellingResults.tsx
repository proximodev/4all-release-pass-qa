'use client'

import { Fragment, memo, useMemo, useState } from 'react'
import { getSeveritySortOrder } from '@/lib/scoring'
import type { ResultsProps } from './types'
import { IgnoreToggleButton } from './IgnoreToggleButton'
import {underline} from "next/dist/lib/picocolors";

/**
 * Build a URL with Text Fragments for highlighting text on the page
 * Format: url#:~:text=prefix-,target,-suffix
 */
function buildTextFragmentUrl(
  url: string,
  prefix: string,
  target: string,
  suffix: string
): string {
  // Trim prefix to last ~30 chars (find word boundary)
  let trimmedPrefix = prefix
  if (prefix.length > 30) {
    const lastSpace = prefix.slice(-30).indexOf(' ')
    trimmedPrefix = lastSpace > 0 ? prefix.slice(-30 + lastSpace + 1) : prefix.slice(-30)
  }

  // Trim suffix to first ~30 chars (find word boundary)
  let trimmedSuffix = suffix
  if (suffix.length > 30) {
    const firstSpace = suffix.slice(0, 30).lastIndexOf(' ')
    trimmedSuffix = firstSpace > 0 ? suffix.slice(0, firstSpace) : suffix.slice(0, 30)
  }

  // URL-encode the components
  const encodedPrefix = encodeURIComponent(trimmedPrefix.trim())
  const encodedTarget = encodeURIComponent(target)
  const encodedSuffix = encodeURIComponent(trimmedSuffix.trim())

  // Build fragment with available parts
  let fragment = encodedTarget
  if (encodedPrefix && encodedSuffix) {
    fragment = `${encodedPrefix}-,${encodedTarget},-${encodedSuffix}`
  } else if (encodedPrefix) {
    fragment = `${encodedPrefix}-,${encodedTarget}`
  } else if (encodedSuffix) {
    fragment = `${encodedTarget},-${encodedSuffix}`
  }

  return `${url}#:~:text=${fragment}`
}

function SpellingResults({
  failedItems,
  passedItemsByCategory,
  expandedItemId,
  setExpandedItemId,
  loadingItems,
  resultItems,
  onIgnoreToggle,
  url,
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

                  // Build highlighted context with View link
                  let contextDisplay: React.ReactNode = null
                  let viewLink: React.ReactNode = null
                  if (contextText && contextLength > 0) {
                    const before = contextText.substring(0, contextOffset)
                    const highlighted = contextText.substring(contextOffset, contextOffset + contextLength)
                    const after = contextText.substring(contextOffset + contextLength)
                    contextDisplay = (
                      <span>
                        {before}<mark className="bg-yellow-200 px-0.5">{highlighted}</mark>{after}
                      </span>
                    )
                    // Build View link with text fragment
                    if (url) {
                      const fragmentUrl = buildTextFragmentUrl(url, before, highlighted, after)
                      viewLink = (
                        <a
                          href={fragmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          (<span className="underline">View Text</span>)
                        </a>
                      )
                    }
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
                        <td className={`py-2 pr-6 align-top ${isIgnored ? 'line-through' : ''}`}>{contextDisplay} {viewLink}</td>
                        <td className={`py-2 pr-6 align-top whitespace-nowrap ${isIgnored ? 'line-through' : ''}`}>{severityValue}</td>
                        {onIgnoreToggle && (
                          <td className="py-2 text-center">
                            <IgnoreToggleButton
                              isIgnored={isIgnored}
                              isToggling={isToggling}
                              onClick={(e) => handleIgnoreClick(e, item.id, isIgnored)}
                            />
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
