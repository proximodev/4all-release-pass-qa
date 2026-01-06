'use client'

import { Fragment, memo, useMemo } from 'react'
import { getSeveritySortOrder } from '@/lib/config/scoring'
import type { ResultsProps } from './types'

function PreflightResults({
  failedItems,
  passedItemsByCategory,
  expandedItemId,
  setExpandedItemId,
  loadingItems,
  resultItems,
}: ResultsProps) {
  const sortedFailedItems = useMemo(() => {
    return [...failedItems].sort((a, b) => {
      const severityA = a.releaseRule?.severity || a.severity
      const severityB = b.releaseRule?.severity || b.severity
      return getSeveritySortOrder(severityA) - getSeveritySortOrder(severityB)
    })
  }, [failedItems])

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
                  const categoryName = rule?.category?.name || '—'
                  const severityValue = rule?.severity || item.severity || '—'
                  const isLastItem = index === sortedFailedItems.length - 1

                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`${isLastItem && !isExpanded ? '' : 'border-b border-dark-gray/40'} ${hasDetails ? 'cursor-pointer' : ''}`}
                        onClick={() => hasDetails && setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <td className="py-2 pr-6 whitespace-nowrap">{categoryName}</td>
                        <td className="py-2 pr-6">{testName}</td>
                        <td className="py-2 pr-6 whitespace-nowrap">{severityValue}</td>
                        <td className="py-2 text-right">
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
                          <td colSpan={4} className="bg-black/5 py-3 px-4 border-b border-dark-gray/40">
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
                  const hasDetails = rule && (rule.fix || rule.impact || rule.docUrl)
                  const testName = rule
                    ? `${rule.name}${rule.description ? ` - ${rule.description}` : ''}`
                    : item.name
                  const isLastItem = index === category.items.length - 1

                  return (
                    <div key={item.id}>
                      <div
                        className={`py-2 ${isLastItem && !isExpanded ? '' : 'border-b border-dark-gray/40'} flex items-center justify-between ${hasDetails ? 'cursor-pointer' : ''}`}
                        onClick={() => hasDetails && setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <span>{testName}</span>
                        {hasDetails && (
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                          </svg>
                        )}
                      </div>
                      {isExpanded && rule && (
                        <div className="bg-black/5 py-3 px-4">
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
                                onClick={(e) => e.stopPropagation()}
                              >
                                Learn more →
                              </a>
                            </div>
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
