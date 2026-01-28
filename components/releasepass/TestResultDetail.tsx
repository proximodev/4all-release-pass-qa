'use client'

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/card/Card'
import { getScoreBadgeClasses, getStatusBadgeClasses, SCORING_CONFIG } from '@/lib/scoring'
import { calculateUrlResultSummary } from '@/lib/services/testResults'
import TabPanel from "@/components/layout/TabPanel";
import type { ResultItem, ReleaseRun, TestRunData } from '@/lib/types/releasepass'
import {
  PreflightResults,
  SpellingResults,
  PerformanceResults,
  BrowserResults,
  type CategoryGroup,
  type IgnoreToggleResult
} from './results'
import { PREFLIGHT_TEST_TYPES } from '@/lib/constants/testTypes'

/**
 * Get pass/fail/error status label for a test type to display in the selector.
 * Shows status for the currently selected URL, not the aggregate test score.
 * Returns null if no label should be shown (QUEUED, RUNNING, SCREENSHOTS).
 */
function getTestTypeStatusLabel(
  testTypeValue: string,
  testRuns: TestRunData[],
  currentUrl: string | undefined
): string | null {
  // Skip SCREENSHOTS - no status display until UI is built out
  if (testTypeValue === 'SCREENSHOTS') return null

  const testRun = testRuns.find(tr => tr.type === testTypeValue)
  if (!testRun) return null

  // No label for in-progress tests
  if (testRun.status === 'QUEUED' || testRun.status === 'RUNNING') return null

  // Operational failure
  if (testRun.status === 'FAILED') return '(error)'

  // If no current URL, fall back to testRun.score
  if (!currentUrl) {
    if (testRun.score === null) return '(error)'
    return testRun.score < SCORING_CONFIG.passThreshold ? '(failed)' : '(passed)'
  }

  // Find urlResult(s) for the current URL
  const urlResultsForUrl = testRun.urlResults?.filter(ur => ur.url === currentUrl) || []

  if (urlResultsForUrl.length === 0) {
    // URL not found in this test type - fall back to testRun.score
    if (testRun.score === null) return '(error)'
    return testRun.score < SCORING_CONFIG.passThreshold ? '(failed)' : '(passed)'
  }

  // For PERFORMANCE: check all viewports for this URL (mobile + desktop)
  // For other tests: should have one urlResult per URL
  const hasError = urlResultsForUrl.some(ur => ur.score === null || ur.score === undefined)
  if (hasError) return '(error)'

  const hasFailingScore = urlResultsForUrl.some(ur => ur.score! < SCORING_CONFIG.passThreshold)
  return hasFailingScore ? '(failed)' : '(passed)'
}

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
      const res = await fetch(`/api/release-runs/${id}`, { cache: 'no-store' })
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
      const res = await fetch(`/api/release-runs/${releaseRunId}/url-results/${urlResultId}`, { cache: 'no-store' })
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
    // Use releaseRule.category.name if available, otherwise fall back to provider
    const categoryMap = new Map<string, { name: string; sortOrder: number; items: ResultItem[] }>()

    passed.forEach(item => {
      const categoryName = item.releaseRule?.category?.name || item.provider || 'Uncategorized'
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
    const currentRoute = PREFLIGHT_TEST_TYPES.find(o => o.value === testType)?.route || 'baseline'
    router.replace(`/releasepass/preflight/${currentRoute}?${params.toString()}`)
  }, [searchParams, testType, router])

  const handleTestTypeChange = useCallback((newTestType: string) => {
    // Handle special "summary" option
    if (newTestType === 'SUMMARY') {
      router.push(`/releasepass/preflight?project=${releaseRun?.project.id}&test=${testId}`)
      return
    }

    const option = PREFLIGHT_TEST_TYPES.find(o => o.value === newTestType)
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
    if (!releaseRun || !testRun || !urlResult) return

    const confirmed = window.confirm(
      `Are you sure you want to rerun the ${title} test for this page? This will replace the existing results for this URL.`
    )
    if (!confirmed) return

    setRerunning(true)
    try {
      const res = await fetch(`/api/release-runs/${releaseRun.id}/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType, url: urlResult.url }),
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
  }, [releaseRun, testRun, urlResult, title, testType, router])

  const handleIgnoreToggle = useCallback(async (itemId: string, ignored: boolean): Promise<IgnoreToggleResult | null> => {
    try {
      const res = await fetch(`/api/result-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignored }),
      })

      if (!res.ok) {
        throw new Error('Failed to update item')
      }

      const data: IgnoreToggleResult = await res.json()

      // Update local resultItems state
      setResultItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, ignored: data.resultItem.ignored } : item
      ))

      // Update releaseRun state with new testRun score and urlResult score
      setReleaseRun(prev => {
        if (!prev) return prev
        return {
          ...prev,
          testRuns: prev.testRuns.map(tr => {
            if (tr.type !== testType) return tr
            return {
              ...tr,
              score: data.testRunScore,
              // Also update the urlResult's score
              urlResults: tr.urlResults?.map(ur =>
                ur.id === selectedUrlResultId
                  ? { ...ur, score: data.urlResultScore }
                  : ur
              )
            }
          })
        }
      })

      // Notify ReleaseStatusBadge to refetch
      window.dispatchEvent(new CustomEvent('releaserun-score-updated'))

      return data
    } catch (err: any) {
      console.error('Failed to toggle ignore:', err)
      return null
    }
  }, [testType, selectedUrlResultId])

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

  const availableTestTypes = PREFLIGHT_TEST_TYPES.filter(opt =>
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
              className="px-3 py-2 border border-dark-gray/40 rounded bg-white min-w-[200px]"
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
              className="px-3 py-2 border border-dark-gray/40 rounded bg-white"
            >
              <option value="SUMMARY">Result Summary</option>
              {availableTestTypes.map((opt) => {
                const statusLabel = getTestTypeStatusLabel(opt.value, releaseRun.testRuns, urlResult?.url)
                return (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}{statusLabel ? ` ${statusLabel}` : ''}
                  </option>
                )
              })}
            </select>
          </div>
        </div>

        <hr className="border-dark-gray/40 mb-8" />

        {/* Summary Section */}
        {summary && urlResult ? (
          <>
            <div className="mb-6">
              <h3>Summary</h3>
              <div className="flex flex-wrap gap-x-6 gap-y-4 items-center">
                {/* Status */}
                <div className="flex gap-2">
                  <span>Status</span>
                  <span className={`px-2 py-0.5 text-s font-medium ${getStatusBadgeClasses(summary.status === 'Passed' ? 'pass' : 'fail')}`}>
                    {summary.status}
                  </span>
                </div>

                {/* Score - skip for Performance since it shows scores in the results component */}
                {testType !== 'PERFORMANCE' && (
                  <div className="flex gap-2">
                    <span>Score</span>
                    <span className={`px-2 py-0.5 text-s font-medium ${getScoreBadgeClasses(summary.score)}`}>
                      {summary.score}
                    </span>
                  </div>
                )}

                {/* Stats - hide for Performance tests */}
                {testType == 'PAGE_PREFLIGHT' && (
                  <div className="flex flex-col gap-0">
                    <div className="mb-0.5">Passed {summary.passCount}/{summary.totalCount} checks</div>
                    {summary.additionalInfo.map((info, i) => (
                      <span key={i}>{info}</span>
                    ))}
                  </div>
                )}

                {/* View Page link */}
                <div className="flex-1 text-right">
                  <a
                    href={urlResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border border-black rounded text-sm bg-white hover:bg-black hover:text-white"
                  >
                    View Page
                  </a>
                </div>
              </div>
            </div>

            <hr className="border-dark-gray/40 mb-8" />

            {/* Test Type Specific Results */}
            {testType === 'PAGE_PREFLIGHT' && (
              <PreflightResults
                resultItems={resultItems}
                failedItems={failedItems}
                passedItemsByCategory={passedItemsByCategory}
                expandedItemId={expandedItemId}
                setExpandedItemId={setExpandedItemId}
                loadingItems={loadingItems}
                onIgnoreToggle={handleIgnoreToggle}
              />
            )}
            {testType === 'SPELLING' && (
              <SpellingResults
                resultItems={resultItems}
                failedItems={failedItems}
                passedItemsByCategory={passedItemsByCategory}
                expandedItemId={expandedItemId}
                setExpandedItemId={setExpandedItemId}
                loadingItems={loadingItems}
                onIgnoreToggle={handleIgnoreToggle}
                url={urlResult?.url}
              />
            )}
            {testType === 'PERFORMANCE' && (
              <PerformanceResults
                resultItems={resultItems}
                failedItems={failedItems}
                passedItemsByCategory={passedItemsByCategory}
                expandedItemId={expandedItemId}
                setExpandedItemId={setExpandedItemId}
                loadingItems={loadingItems}
                urlResults={urlResults}
                currentUrl={urlResult?.url}
              />
            )}
            {testType === 'SCREENSHOTS' && (
              <BrowserResults
                resultItems={resultItems}
                failedItems={failedItems}
                passedItemsByCategory={passedItemsByCategory}
                expandedItemId={expandedItemId}
                setExpandedItemId={setExpandedItemId}
                loadingItems={loadingItems}
              />
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
