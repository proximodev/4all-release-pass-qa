'use client'

import { memo } from 'react'
import type { ResultsProps } from './types'

function PreflightResults({
  failedItems,
  passedItemsByCategory,
  expandedItemId,
  setExpandedItemId,
  loadingItems,
  resultItems,
}: ResultsProps) {
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
                  <th className="py-2 text-left font-medium">Category</th>
                  <th className="py-2 text-left font-medium">Error</th>
                  <th className="py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {failedItems.map((item, index) => {
                  const rule = item.releaseRule
                  const isExpanded = expandedItemId === item.id
                  const hasDetails = rule && (rule.fix || rule.impact || rule.docUrl)
                  const testName = rule
                    ? `${rule.name}${rule.description ? ` - ${rule.description}` : ''}`
                    : item.name
                  const categoryName = rule?.category?.name || '—'
                  const isLastItem = index === failedItems.length - 1

                  return (
                    <tr
                      key={item.id}
                      className={`${isLastItem && !isExpanded ? '' : 'border-b border-dark-gray/40'} ${hasDetails ? 'cursor-pointer' : ''}`}
                      onClick={() => hasDetails && setExpandedItemId(isExpanded ? null : item.id)}
                    >
                      <td className="py-2">{categoryName}</td>
                      <td className="py-2">{testName}</td>
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
                  )
                })}
              </tbody>
            </table>
            {/* Expanded details rendered separately */}
            {failedItems.map((item) => {
              const rule = item.releaseRule
              const isExpanded = expandedItemId === item.id
              if (!isExpanded || !rule) return null

              return (
                <div key={`${item.id}-details`} className="bg-black/5 py-3 px-4 border-b border-dark-gray/40">
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
                </div>
              )
            })}
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
