'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getScoreColor } from '@/lib/config/scoring'

interface ResultItem {
  id: string
  status: string
  code: string
  name: string
  severity?: string
}

interface UrlResultData {
  id: string
  url: string
  issueCount?: number
  resultItems?: ResultItem[]
}

interface TestRunData {
  id: string
  type: string
  status: string
  score: number | null
  createdAt: string
  finishedAt: string | null
  urlResults?: UrlResultData[]
  _count?: {
    urlResults: number
  }
  project?: {
    id: string
    name: string
    siteUrl: string
  }
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

interface TestResultsSummaryProps {
  testId: string
  /** 'releaseRun' for Preflight, 'testRun' for Site Audit */
  mode?: 'releaseRun' | 'testRun'
}

const TEST_STATUS_STYLES: Record<string, { bg: string; text: string; border?: string }> = {
  QUEUED: { bg: 'bg-medium-gray', text: 'text-black' },
  RUNNING: { bg: 'bg-brand-yellow', text: 'text-black', border: 'border border-black' },
  SUCCESS: { bg: 'bg-brand-cyan', text: 'text-white' },
  FAILED: { bg: 'bg-red', text: 'text-white' },
  PARTIAL: { bg: 'bg-brand-yellow', text: 'text-black' },
}

const TEST_TYPE_LABELS: Record<string, string> = {
  PAGE_PREFLIGHT: 'Baseline',
  PERFORMANCE: 'Performance',
  SCREENSHOTS: 'Browser',
  SPELLING: 'Spelling',
  SITE_AUDIT: 'Site Audit',
}

const TEST_TYPE_ROUTES: Record<string, string> = {
  PAGE_PREFLIGHT: 'baseline',
  PERFORMANCE: 'performance',
  SCREENSHOTS: 'browser',
  SPELLING: 'spelling',
}

export default function TestResultsSummary({ testId, mode = 'releaseRun' }: TestResultsSummaryProps) {
  const router = useRouter()
  const [releaseRun, setReleaseRun] = useState<ReleaseRun | null>(null)
  const [testRun, setTestRun] = useState<TestRunData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (testId) {
      if (mode === 'testRun') {
        fetchTestRun(testId)
      } else {
        fetchReleaseRun(testId)
      }
    }
  }, [testId, mode])

  // Auto-expand first URL when data loads
  useEffect(() => {
    if (releaseRun && releaseRun.urls.length > 0 && expandedUrls.size === 0) {
      setExpandedUrls(new Set([releaseRun.urls[0]]))
    }
  }, [releaseRun])

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

  const fetchTestRun = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/test-runs/${id}`)
      if (!res.ok) {
        throw new Error('Failed to fetch test details')
      }
      const data = await res.json()
      setTestRun(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!releaseRun) return

    const confirmed = window.confirm(
      'Are you sure you want to cancel this test? Running tests will be marked as failed.'
    )

    if (!confirmed) return

    setCancelling(true)
    try {
      const res = await fetch(`/api/release-runs/${releaseRun.id}/cancel`, {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Failed to cancel test')
      }

      // Refresh the data
      await fetchReleaseRun(releaseRun.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCancelling(false)
    }
  }

  const handleDelete = async () => {
    if (!releaseRun) return

    const confirmed = window.confirm(
      `Are you sure you want to delete "${releaseRun.name || 'this test'}"? This will also delete all associated test runs and results.`
    )

    if (!confirmed) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/release-runs/${releaseRun.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete test')
      }

      router.push('/releasepass/preflight')
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }

  const toggleUrlExpanded = (url: string) => {
    setExpandedUrls(prev => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
      }
      return next
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = TEST_STATUS_STYLES[status] || { bg: 'bg-medium-gray', text: 'text-black' }
    const label = status === 'RUNNING' ? 'In Progress' : status.charAt(0) + status.slice(1).toLowerCase()
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles.bg} ${styles.text} ${styles.border || ''}`}>
        {label}
      </span>
    )
  }

  const getScoreBadge = (score: number | null, testType: string) => {
    if (testType === 'SCREENSHOTS') {
      // Browser tests show "Review" badge
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-medium-gray text-black">
          Review
        </span>
      )
    }

    if (score === null) return null

    // Determine color based on score using config
    const color = getScoreColor(score)
    const bgColor = color === 'green'
      ? 'bg-brand-cyan'
      : color === 'yellow'
        ? 'bg-brand-yellow text-black'
        : 'bg-red'

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${bgColor} ${color !== 'yellow' ? 'text-white' : ''}`}>
        {score}
      </span>
    )
  }

  // Check if tests are still in progress
  const isInProgress = (runs: TestRunData[]) => {
    return runs.some(run => run.status === 'QUEUED' || run.status === 'RUNNING')
  }

  // Check if any test failed
  const hasFailed = (runs: TestRunData[]) => {
    return runs.some(run => run.status === 'FAILED')
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-black/60">
        Loading test results...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red">
        {error}
      </div>
    )
  }

  // Render for testRun mode (Site Audit)
  if (mode === 'testRun') {
    if (!testRun) {
      return (
        <div className="p-4 text-center text-black/60">
          No test selected
        </div>
      )
    }

    const dateStr = `${new Date(testRun.createdAt).getMonth() + 1}/${new Date(testRun.createdAt).getDate()}/${String(new Date(testRun.createdAt).getFullYear()).slice(-2)}`

    return (
      <div className="space-y-4">
        {/* Test Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-lg">
            {dateStr} Site Audit
          </h3>
          {getStatusBadge(testRun.status)}
        </div>

        {/* Meta Info */}
        <div className="text-sm text-black/60">
          <p>Created: {formatDate(testRun.createdAt)}</p>
          {testRun.finishedAt && <p>Completed: {formatDate(testRun.finishedAt)}</p>}
        </div>

        {/* Score */}
        {testRun.score !== null && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Score</h4>
            <div className="text-2xl font-bold">
              {testRun.score}<span className="text-sm font-normal text-black/60">/100</span>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {testRun.urlResults && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Summary</h4>
            <div className="text-sm text-black/70">
              {(() => {
                const allItems = testRun.urlResults.flatMap(r => r.resultItems || [])
                const passCount = allItems.filter(i => i.status === 'PASS').length
                const failCount = allItems.filter(i => i.status === 'FAIL').length
                return (
                  <>
                    <p>Checks passed: {passCount}</p>
                    <p>Checks failed: {failCount}</p>
                    <p>URLs analyzed: {testRun.urlResults.length}</p>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render for releaseRun mode (Preflight)
  if (!releaseRun) {
    return (
      <div className="p-4 text-center text-black/60">
        No test selected
      </div>
    )
  }

  const inProgress = isInProgress(releaseRun.testRuns)
  const failed = hasFailed(releaseRun.testRuns)

  // IN-PROGRESS VIEW (Design 3)
  if (inProgress) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-lg">Test Status</h3>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-sm text-red hover:text-red/80 disabled:opacity-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Test'}
          </button>
        </div>

        {/* Created Date */}
        <p className="text-sm text-black/60">
          <span className="font-medium text-black">Created:</span> {formatDate(releaseRun.createdAt)}
        </p>

        {/* Test Status List */}
        <div className="space-y-3 border-t border-medium-gray pt-4">
          {releaseRun.selectedTests.map((testType) => {
            const testRun = releaseRun.testRuns.find(r => r.type === testType)
            const status = testRun?.status || 'QUEUED'
            return (
              <div key={testType} className="flex items-center justify-between py-1 border-b border-medium-gray last:border-0">
                <span className="text-sm">{TEST_TYPE_LABELS[testType] || testType}</span>
                {getStatusBadge(status)}
              </div>
            )
          })}
        </div>

        {/* Pages Submitted */}
        <div className="space-y-2 pt-4">
          <h4 className="font-medium text-sm">Pages Submitted:</h4>
          <ul className="text-sm space-y-1 text-black/70">
            {releaseRun.urls.map((url, index) => (
              <li key={index} className="truncate">
                {url}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // RESULTS VIEW (Design 4)
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-lg">
          Results: {releaseRun.name || 'Untitled Test'}
        </h3>
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-medium-gray text-black">
          Review
        </span>
      </div>

      {/* Created Date */}
      <p className="text-sm text-black/60">
        <span className="font-medium text-black">Created:</span> {formatDate(releaseRun.createdAt)}
      </p>

      {/* URL Results with Expandable Sections */}
      <div className="space-y-2 border-t border-medium-gray pt-4">
        {releaseRun.urls.map((url) => {
          const isExpanded = expandedUrls.has(url)

          return (
            <div key={url} className="border-b border-medium-gray last:border-0">
              {/* URL Header - Clickable to expand/collapse */}
              <button
                onClick={() => toggleUrlExpanded(url)}
                className="w-full flex items-center justify-between py-2 text-left hover:bg-light-gray/50 -mx-2 px-2 rounded"
              >
                <span className="font-medium text-sm">{url}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded Content - Test Results */}
              {isExpanded && (
                <div className="pl-4 pb-3 space-y-2">
                  {releaseRun.selectedTests.map((testType) => {
                    const testRun = releaseRun.testRuns.find(r => r.type === testType)
                    const urlResult = testRun?.urlResults?.find(ur => ur.url === url)
                    const route = TEST_TYPE_ROUTES[testType]

                    // Calculate score for this URL from result items
                    let score: number | null = testRun?.score ?? null
                    if (urlResult?.resultItems) {
                      const passCount = urlResult.resultItems.filter(i => i.status === 'PASS').length
                      const totalCount = urlResult.resultItems.length
                      if (totalCount > 0) {
                        score = Math.round((passCount / totalCount) * 100)
                      }
                    }

                    // Build link - use urlResultId if available
                    const linkHref = urlResult?.id
                      ? `/releasepass/preflight/${route}?test=${releaseRun.id}&urlResult=${urlResult.id}`
                      : `/releasepass/preflight/${route}?test=${releaseRun.id}`

                    return (
                      <div key={testType} className="flex items-center justify-between py-1">
                        <Link
                          href={linkHref}
                          className="text-sm underline hover:text-brand-cyan"
                        >
                          {TEST_TYPE_LABELS[testType] || testType}
                        </Link>
                        {getScoreBadge(score, testType)}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Delete Button - Show if test failed or completed */}
      {(failed || !inProgress) && (
        <div className="pt-4 border-t border-medium-gray">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red hover:text-red/80 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Test'}
          </button>
        </div>
      )}
    </div>
  )
}
