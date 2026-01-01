'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/card/Card'
import { isPassingScore, getScoreBadgeClasses, getStatusBadgeClasses, calculateScoreFromItems } from '@/lib/config/scoring'
import PageContainer from "@/components/layout/PageContainer";
import TabPanel from "@/components/layout/TabPanel";

interface ResultItem {
  id: string
  provider: string
  code: string
  name: string
  status: string
  severity?: string
  meta?: Record<string, any>
}

interface UrlResultData {
  id: string
  url: string
  issueCount?: number
  additionalMetrics?: Record<string, any>
  resultItems?: ResultItem[]
  performanceScore?: number | null
}

interface TestRunData {
  id: string
  type: string
  status: string
  score: number | null
  createdAt: string
  finishedAt: string | null
  urlResults?: UrlResultData[]
}

interface ReleaseRun {
  id: string
  name: string | null
  status: string
  urls: string[]
  selectedTests: string[]
  createdAt: string
  testRuns: TestRunData[]
  project: {
    id: string
    name: string
    siteUrl: string
  }
}

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

export default function TestResultDetail({ testType, title }: TestResultDetailProps) {
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

  const fetchReleaseRun = async (id: string) => {
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
  }

  const fetchResultItems = async (releaseRunId: string, urlResultId: string) => {
    setLoadingItems(true)
    try {
      const res = await fetch(`/api/release-runs/${releaseRunId}/url-results/${urlResultId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch result details')
      }
      const data = await res.json()
      setResultItems(data.resultItems || [])
    } catch (err: any) {
      // Don't set error state - just log it, the summary still works
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch result items:', err)
      }
      setResultItems([])
    } finally {
      setLoadingItems(false)
    }
  }

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

    // Use resultItems from state (fetched separately)
    const passCount = resultItems.filter(i => i.status === 'PASS').length
    const failCount = resultItems.filter(i => i.status === 'FAIL').length
    const totalCount = resultItems.length

    // Calculate per-URL score based on test type
    let score: number
    if (testType === 'PAGE_PREFLIGHT') {
      // Baseline: calculate from ResultItems
      score = calculateScoreFromItems(resultItems)
    } else if (testType === 'PERFORMANCE' && urlResult.performanceScore != null) {
      // Performance: use stored per-URL score
      score = urlResult.performanceScore
    } else {
      // Fallback to testRun score
      score = testRun.score ?? 0
    }

    // Determine pass/fail based on score threshold
    const status = isPassingScore(score) ? 'Passed' : 'Failed'

    // Get additional metrics based on test type
    let additionalInfo: string[] = []
    if (testType === 'PAGE_PREFLIGHT') {
      const linkCount = urlResult.additionalMetrics?.linkCount || 0
      const brokenLinkCount = urlResult.additionalMetrics?.brokenLinkCount || 0
      if (linkCount > 0) {
        additionalInfo.push(
          brokenLinkCount === 0
            ? `No broken links (${linkCount} links tested)`
            : `${brokenLinkCount} broken links (${linkCount} links tested)`
        )
      }
    }

    return {
      testRun,
      urlResult,
      urlResults,
      summary: {
        score,
        passCount,
        failCount,
        totalCount,
        status,
        additionalInfo,
      }
    }
  }, [releaseRun, selectedUrlResultId, testType, resultItems])

  const handleUrlChange = (newUrlResultId: string) => {
    setSelectedUrlResultId(newUrlResultId)
    // Update URL param
    const params = new URLSearchParams(searchParams.toString())
    params.set('urlResult', newUrlResultId)
    const currentRoute = TEST_TYPE_OPTIONS.find(o => o.value === testType)?.route || 'baseline'
    router.replace(`/releasepass/preflight/${currentRoute}?${params.toString()}`)
  }

  const handleTestTypeChange = (newTestType: string) => {
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
  }

  const handleRerunTest = async () => {
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
  }

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
            {/* URL Selector */}
            <select
              value={selectedUrlResultId}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="px-3 py-2 border border-medium-gray rounded text-sm bg-white min-w-[200px]"
            >
              {urlResults.map((ur) => (
                <option key={ur.id} value={ur.id}>
                  {ur.url}
                </option>
              ))}
            </select>

            {/* Test Type Selector */}
            <select
              value={testType}
              onChange={(e) => handleTestTypeChange(e.target.value)}
              className="px-3 py-2 border border-medium-gray rounded text-sm bg-white"
            >
              {availableTestTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <hr className="border-medium-gray mb-6" />

        {/* Summary Section */}
        {summary && urlResult ? (
          <>
            <div className="mb-6">
              <h3>Summary</h3>
              <div className="flex flex-wrap gap-x-12 gap-y-4 items-center">
                {/* Status & Score */}
                <div className="flex flex-row gap-3">
                  <div className="flex gap-2">
                    <span>Status</span>
                      <span className={`px-2 py-0.5 text-s font-medium ${getStatusBadgeClasses(summary.status === 'Passed' ? 'pass' : 'fail')}`}>
                        {summary.status}
                      </span>
                  </div>
                  <div>
                    <span className="mr-2">Score</span>
                      <span className={`px-2 py-1 text-s font-medium ${getScoreBadgeClasses(summary.score)}`}>
                        {summary.score}
                      </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex flex-col gap-0">
                  <div className="mb-0.5">Passed {summary.passCount}/{summary.totalCount} checks</div>
                  {summary.additionalInfo.map((info, i) => (
                    <span key={i}>{info}</span>
                  ))}
                </div>

                {/* Analysis placeholder */}
                <div className="flex-1 min-w-[300px] text-sm text-black/60 italic">

                </div>
              </div>
            </div>

            <hr className="border-medium-gray mb-6" />

            {/* Details Table */}
            <div>
              <h3>Details</h3>

              {loadingItems ? (
                <p className="text-black/60">Loading details...</p>
              ) : resultItems.length === 0 ? (
                <p>No results available for this URL.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-medium-gray">
                        <th className="text-left py-2 px-2 font-medium text-black/70">Provider</th>
                        <th className="text-left py-2 px-2 font-medium text-black/70">Code</th>
                        <th className="text-left py-2 px-2 font-medium text-black/70">Name</th>
                        <th className="text-left py-2 px-2 font-medium text-black/70">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultItems.map((item) => (
                        <tr key={item.id} className="border-b border-medium-gray/50 last:border-0">
                          <td className="py-2 px-2 text-black/70">
                            {item.provider === 'LIGHTHOUSE' ? 'Lighthouse' :
                             item.provider === 'LINKINATOR' ? 'Linkinator' :
                             item.provider === 'LANGUAGETOOL' ? 'LanguageTool' :
                             item.provider}
                          </td>
                          <td className="py-2 px-2 text-black/70">{item.code}</td>
                          <td className="py-2 px-2">{item.name}</td>
                          <td className="py-2 px-2">
                            <span className={
                              item.status === 'PASS'
                                ? 'text-brand-cyan'
                                : item.status === 'FAIL'
                                  ? 'text-red'
                                  : 'text-black/60'
                            }>
                              {item.status === 'PASS' ? 'Pass' :
                               item.status === 'FAIL' ? 'Fail' :
                               item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-black/60 text-sm">
            No results available for the selected URL.
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-medium-gray">
          <Link
            href={`/releasepass/preflight?project=${releaseRun.project.id}&test=${releaseRun.id}`}
            className="px-4 py-2 border border-medium-gray rounded text-sm bg-white hover:bg-white/80"
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
