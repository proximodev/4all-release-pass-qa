'use client'

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/card/Card'
import { getScoreBadgeClasses, getStatusBadgeClasses } from '@/lib/config/scoring'
import { calculateUrlResultSummary } from '@/lib/services/testResults'
import PageContainer from "@/components/layout/PageContainer";
import TabPanel from "@/components/layout/TabPanel";
import type { ResultItem, UrlResultData, TestRunData, ReleaseRun, ReleaseRule, ReleaseRuleCategory } from '@/lib/types/releasepass'

const TEST_TYPE_OPTIONS = [
  { value: 'PAGE_PREFLIGHT', label: 'Technical Baseline', route: 'baseline' },
  { value: 'PERFORMANCE', label: 'Performance', route: 'performance' },
  { value: 'SPELLING', label: 'Spelling', route: 'spelling' },
  { value: 'SCREENSHOTS', label: 'Browser', route: 'browser' },
]

interface TestResultDetailProps {
  testType: 'PAGE_PREFLIGHT' | 'PERFORMANCE' | 'SPELLING' | 'SCREENSHOTS'
  title: string
}

function TestResultDetail({ testType, title }: TestResultDetailProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const testId = searchParams.get('test')
  const urlResultId = searchParams.get('urlResult')

  const [releaseRun, setReleaseRun] = useState<ReleaseRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUrlResultId, setSelectedUrlResultId] = useState<string>('')
  const [rerunning, setRerunning] = useState(false)

  // Separate state for result items (fetched on demand)
  const [resultItems, setResultItems] = useState<ResultItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  useEffect(() => {
    if (testId) {
      fetchReleaseRun(testId)
    }
  }, [testId])

  // Set initial URL from query param or first available
  useEffect(() => {
    if (releaseRun && !selectedUrlResultId) {
      const testRun = releaseRun.testRuns.find(r => r.type === testType)
      if (testRun?.urlResults && testRun.urlResults.length > 0) {
        if (urlResultId && testRun.urlResults.some(ur => ur.id === urlResultId)) {
          setSelectedUrlResultId(urlResultId)
        } else {
          setSelectedUrlResultId(testRun.urlResults[0].id)
        }
      }
    }
  }, [releaseRun, urlResultId, testType])

  // Fetch result items when selected URL changes
  useEffect(() => {
    if (testId && selectedUrlResultId) {
      fetchResultItems(testId, selectedUrlResultId)
    }
  }, [testId, selectedUrlResultId])

  const fetchReleaseRun = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/release-runs/${id}`)
      if (!res.ok) {
        throw new Error('Failed to fetch test details')
      }
      const data = await res.json()
      setReleaseRun(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchResultItems = useCallback(async (releaseRunId: string, urlResultId: string) => {
    setLoadingItems(true)
    try {
      const res = await fetch(`/api/release-runs/${releaseRunId}/url-results/${urlResultId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch result details')
      }
      const data = await res.json()
      // Sort by status (FAIL first) then by provider
      const statusOrder: Record<string, number> = { FAIL: 0, PASS: 1, SKIP: 2 }
      const sorted = (data.resultItems || []).sort((a: ResultItem, b: ResultItem) => {
        const statusDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
        if (statusDiff !== 0) return statusDiff
        return (a.provider || '').localeCompare(b.provider || '')
      })
      setResultItems(sorted)
    } catch (err: any) {
      // Don't set error state - just log it, the summary still works
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch result items:', err)
      }
      setResultItems([])
    } finally {
      setLoadingItems(false)
    }
  }, [])

  // Split result items into failed and passed groups
  const { failedItems, passedItemsByCategory } = useMemo(() => {
    const failed = resultItems.filter(item => item.status === 'FAIL')
    const passed = resultItems.filter(item => item.status === 'PASS')

    // Group passed items by category and sort by sortOrder
    const categoryMap = new Map<string, { name: string; sortOrder: number; items: ResultItem[] }>()

    passed.forEach(item => {
      const categoryName = item.releaseRule?.category?.name || 'Uncategorized'
      const categorySortOrder = item.releaseRule?.category?.sortOrder ?? 999

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, { name: categoryName, sortOrder: categorySortOrder, items: [] })
      }
      categoryMap.get(categoryName)!.items.push(item)
    })

    // Sort categories by sortOrder, then sort items within each category by rule sortOrder
    const sortedCategories = Array.from(categoryMap.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(cat => ({
        ...cat,
        items: cat.items.sort((a, b) => (a.releaseRule?.sortOrder ?? 999) - (b.releaseRule?.sortOrder ?? 999))
      }))

    return { failedItems: failed, passedItemsByCategory: sortedCategories }
  }, [resultItems])

  // Get the test run and URL result data (resultItems come from separate state)
  const { testRun, urlResult, urlResults, summary } = useMemo(() => {
    if (!releaseRun) {
      return { testRun: null, urlResult: null, urlResults: [], summary: null }
    }

    const testRun = releaseRun.testRuns.find(r => r.type === testType)
    if (!testRun) {
      return { testRun: null, urlResult: null, urlResults: [], summary: null }
    }

    const urlResults = testRun.urlResults || []
    const urlResult = urlResults.find(ur => ur.id === selectedUrlResultId)

    if (!urlResult) {
      return { testRun, urlResult: null, urlResults, summary: null }
    }

    // Calculate summary using extracted service function
    const summary = calculateUrlResultSummary(
      testType,
      urlResult,
      urlResults,
      resultItems,
      testRun.score ?? 0
    )

    return { testRun, urlResult, urlResults, summary }
  }, [releaseRun, selectedUrlResultId, testType, resultItems])

  const handleUrlChange = useCallback((newUrlResultId: string) => {
    setSelectedUrlResultId(newUrlResultId)
    // Update URL param
    const params = new URLSearchParams(searchParams.toString())
    params.set('urlResult', newUrlResultId)
    const currentRoute = TEST_TYPE_OPTIONS.find(o => o.value === testType)?.route || 'baseline'
    router.replace(`/releasepass/preflight/${currentRoute}?${params.toString()}`)
  }, [searchParams, testType, router])

  const handleTestTypeChange = useCallback((newTestType: string) => {
    const option = TEST_TYPE_OPTIONS.find(o => o.value === newTestType)
    if (!option) return

    // Find the URL result for the same URL in the new test type
    const newTestRun = releaseRun?.testRuns.find(r => r.type === newTestType)
    const currentUrl = urlResult?.url
    const newUrlResult = newTestRun?.urlResults?.find(ur => ur.url === currentUrl)

    const params = new URLSearchParams()
    params.set('test', testId || '')
    if (newUrlResult) {
      params.set('urlResult', newUrlResult.id)
    }

    router.push(`/releasepass/preflight/${option.route}?${params.toString()}`)
  }, [releaseRun, urlResult?.url, testId, router])

  const handleRerunTest = useCallback(async () => {
    if (!releaseRun || !testRun) return

    const confirmed = window.confirm(
      `Are you sure you want to rerun the ${title} test? This will replace the existing results.`
    )
    if (!confirmed) return

    setRerunning(true)
    try {
      const res = await fetch(`/api/release-runs/${releaseRun.id}/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType }),
      })

      if (!res.ok) {
        throw new Error('Failed to rerun test')
      }

      // Navigate back to the main preflight page to see progress
      router.push(`/releasepass/preflight?project=${releaseRun.project.id}&test=${releaseRun.id}`)
    } catch (err: any) {
      setError(err.message)
      setRerunning(false)
    }
  }, [releaseRun, testRun, title, testType, router])

  if (loading) {
    return (
      <Card>
        <div className="p-8 text-center text-black/60">
          Loading test results...
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <div className="p-8 text-center text-red">
          {error}
        </div>
      </Card>
    )
  }

  if (!releaseRun) {
    return (
      <Card>
        <div className="p-8 text-center text-black/60">
          Test not found. Please select a test from the Preflight page.
        </div>
      </Card>
    )
  }

  if (!testRun) {
    return (
      <TabPanel>
        <Card>
          <div className="p-8 text-center text-black/60">
            No {title} test was run for this release.
            <Link href={`/releasepass/preflight?project=${releaseRun.project.id}&test=${releaseRun.id}`} className="text-brand-cyan underline ml-1">
              Go back to results
            </Link>
          </div>
        </Card>
      </TabPanel>
    )
  }

  const availableTestTypes = TEST_TYPE_OPTIONS.filter(opt =>
    releaseRun.selectedTests.includes(opt.value)
  )

  return (
    <TabPanel className={'min-h=[440px]'}>
      <Card>
        {/* Header with dropdowns */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2>{title} Results</h2>
          <div className="flex gap-3">
            {/* URL Selector - show unique URLs only */}
            <select
              value={urlResult?.url || ''}
              onChange={(e) => {
                // Find the first urlResult for this URL (prefer mobile for Performance)
                const selectedUrl = e.target.value
                const match = urlResults.find(ur => ur.url === selectedUrl && ur.viewport === 'mobile')
                  || urlResults.find(ur => ur.url === selectedUrl)
                if (match) handleUrlChange(match.id)
              }}
              className="px-3 py-2 border border-dark-gray/40 rounded text-sm bg-white min-w-[200px]"
            >
              {/* Get unique URLs */}
              {[...new Set(urlResults.map(ur => ur.url))].map((url) => (
                <option key={url} value={url}>
                  {url}
                </option>
              ))}
            </select>

            {/* Test Type Selector */}
            <select
              value={testType}
              onChange={(e) => handleTestTypeChange(e.target.value)}
              className="px-3 py-2 border border-dark-gray/40 rounded text-sm bg-white"
            >
              {availableTestTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <hr className="border-dark-gray/40 mb-8" />

        {/* Summary Section */}
        {summary && urlResult ? (
          <>
            <div className="mb-6">
              <h3>Summary</h3>
              <div className="flex flex-wrap gap-x-12 gap-y-4 items-center">
                {/* Status */}
                <div className="flex gap-2">
                  <span>Status</span>
                  <span className={`px-2 py-0.5 text-s font-medium ${getStatusBadgeClasses(summary.status === 'Passed' ? 'pass' : 'fail')}`}>
                    {summary.status}
                  </span>
                </div>

                {/* Score(s) - different display for Performance vs other tests */}
                {testType === 'PERFORMANCE' ? (
                  <div className="flex flex-row gap-6">
                    <div className="flex gap-2">
                      <span>Mobile Score</span>
                      <span className={`px-2 py-0.5 text-s font-medium ${summary.mobileScore !== null ? getScoreBadgeClasses(summary.mobileScore) : 'bg-medium-gray text-black'}`}>
                        {summary.mobileScore !== null ? summary.mobileScore : 'N/A'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span>Desktop Score</span>
                      <span className={`px-2 py-0.5 text-s font-medium ${summary.desktopScore !== null ? getScoreBadgeClasses(summary.desktopScore) : 'bg-medium-gray text-black'}`}>
                        {summary.desktopScore !== null ? summary.desktopScore : 'N/A'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <span>Score</span>
                    <span className={`px-2 py-0.5 text-s font-medium ${getScoreBadgeClasses(summary.score)}`}>
                      {summary.score}
                    </span>
                  </div>
                )}

                {/* Stats - hide for Performance tests */}
                {testType !== 'PERFORMANCE' && (
                  <div className="flex flex-col gap-0">
                    <div className="mb-0.5">Passed {summary.passCount}/{summary.totalCount} checks</div>
                    {summary.additionalInfo.map((info, i) => (
                      <span key={i}>{info}</span>
                    ))}
                  </div>
                )}

                {/* Analysis placeholder */}
                <div className="flex-1 min-w-[300px] text-sm text-black/60 italic">

                </div>
              </div>
            </div>

            <hr className="border-dark-gray/40 mb-8" />

            {/* Failed Section */}
            {loadingItems ? (
              <p className="text-black/60">Loading details...</p>
            ) : resultItems.length === 0 ? (
              <p>No results available for this URL.</p>
            ) : (
              <>
                {failedItems.length > 0 && (
                  <div className="mb-6">
                    <h3>Failed Tests</h3>
                    <div className="overflow-hidden">
                      <table className="w-full text-m">
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
                              <>
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
                                {isExpanded && rule && (
                                  <tr key={`${item.id}-details`} className="bg-black/5">
                                    <td colSpan={3} className="py-3 px-4">
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
                                    </td>
                                  </tr>
                                )}
                              </>
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
            )}
          </>
        ) : (
          <div className="text-black/60 text-sm">
            No results available for the selected URL.
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex gap-3 mt-8 pt-6o">
          <Link
            href={`/releasepass/preflight?project=${releaseRun.project.id}&test=${releaseRun.id}`}
            className="px-4 py-2 border border-dark-gray/40 rounded text-sm bg-white hover:bg-white/80"
          >
            &larr; Back to All Results
          </Link>
          <button
            className="px-4 py-2 bg-black text-white rounded text-sm hover:bg-black/80 disabled:opacity-50"
            onClick={handleRerunTest}
            disabled={rerunning}
          >
            {rerunning ? 'Rerunning...' : 'Rerun Test'}
          </button>
        </div>
      </Card>
    </TabPanel>
  )
}

export default memo(TestResultDetail)
