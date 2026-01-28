'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getScoreBadgeClasses } from '@/lib/scoring'
import { TEST_TYPE_LABELS, TEST_TYPE_ROUTES } from '@/lib/constants/testTypes'
import type { ResultItem, UrlResultData, TestRunData, ReleaseRun } from '@/lib/types/releasepass'

interface TestResultsSummaryProps {
  testId: string
  /** 'releaseRun' for Preflight, 'testRun' for Site Audit */
  mode?: 'releaseRun' | 'testRun'
  /** Called after release run name is successfully updated */
  onNameUpdate?: () => void
}

const TEST_STATUS_STYLES: Record<string, { bg: string; text: string; border?: string }> = {
  QUEUED: { bg: 'bg-medium-gray', text: 'text-black' },
  RUNNING: { bg: 'bg-brand-yellow', text: 'text-black'},
  SUCCESS: { bg: 'bg-brand-cyan', text: 'text-white' },
  FAILED: { bg: 'bg-red', text: 'text-white' },
  PARTIAL: { bg: 'bg-medium-gray', text: 'text-black' },
}

const POLL_INTERVAL_MS = 5000

function TestResultsSummary({ testId, mode = 'releaseRun', onNameUpdate }: TestResultsSummaryProps) {
  const router = useRouter()
  const [releaseRun, setReleaseRun] = useState<ReleaseRun | null>(null)
  const [testRun, setTestRun] = useState<TestRunData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [rerunningAll, setRerunningAll] = useState(false)
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set())
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)

  // Check if any tests are still in progress (for polling)
  const hasInProgressTests = (runs: TestRunData[]) => {
    return runs.some(run => run.status === 'QUEUED' || run.status === 'RUNNING')
  }

  useEffect(() => {
    if (testId) {
      if (mode === 'testRun') {
        fetchTestRun(testId)
      } else {
        fetchReleaseRun(testId)
      }
    }
  }, [testId, mode])

  // Polling for in-progress tests
  useEffect(() => {
    if (mode !== 'releaseRun' || !releaseRun) return

    // Only poll if there are in-progress tests
    if (!hasInProgressTests(releaseRun.testRuns)) return

    const intervalId = setInterval(() => {
      fetchReleaseRun(releaseRun.id, false)
    }, POLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [releaseRun, mode])

  // Auto-expand first URL when data loads
  useEffect(() => {
    if (releaseRun && releaseRun.urls.length > 0 && expandedUrls.size === 0) {
      setExpandedUrls(new Set([releaseRun.urls[0]]))
    }
  }, [releaseRun])

  const fetchReleaseRun = useCallback(async (id: string, showLoading = true) => {
    if (showLoading) {
      setLoading(true)
      setError(null)
    }
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
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [])

  const fetchTestRun = useCallback(async (id: string) => {
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
  }, [])

  const handleCancel = useCallback(async () => {
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
  }, [releaseRun, fetchReleaseRun])

  const handleDelete = useCallback(async () => {
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

      // Full page reload to ensure TestSelector refetches the updated list
      window.location.href = `/releasepass/preflight?project=${releaseRun.project.id}`
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }, [releaseRun])

  const handleRerunAll = useCallback(async () => {
    if (!releaseRun) return

    const confirmed = window.confirm(
      'Rerun all tests? This will replace all existing results.'
    )

    if (!confirmed) return

    setRerunningAll(true)
    try {
      const res = await fetch(`/api/release-runs/${releaseRun.id}/rerun-all`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to rerun tests')
      }

      // Refresh the data - will show in-progress view
      await fetchReleaseRun(releaseRun.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRerunningAll(false)
    }
  }, [releaseRun, fetchReleaseRun])

  const toggleUrlExpanded = useCallback((url: string) => {
    setExpandedUrls(prev => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
      }
      return next
    })
  }, [])

  const handleStartEditName = useCallback(() => {
    if (!releaseRun) return
    setEditedName(releaseRun.name || '')
    setIsEditingName(true)
  }, [releaseRun])

  const handleCancelEditName = useCallback(() => {
    setIsEditingName(false)
    setEditedName('')
  }, [])

  const handleSaveName = useCallback(async () => {
    if (!releaseRun) return

    const trimmedName = editedName.trim()
    const originalName = releaseRun.name || ''

    // Only save if name actually changed
    if (trimmedName === originalName) {
      setIsEditingName(false)
      return
    }

    setIsSavingName(true)
    try {
      const res = await fetch(`/api/release-runs/${releaseRun.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      })

      if (!res.ok) {
        throw new Error('Failed to update name')
      }

      const updated = await res.json()
      setReleaseRun(prev => prev ? { ...prev, name: updated.name } : prev)
      setIsEditingName(false)
      onNameUpdate?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSavingName(false)
    }
  }, [releaseRun, editedName, onNameUpdate])

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleCancelEditName()
    } else if (e.key === 'Enter') {
      handleSaveName()
    }
  }, [handleCancelEditName, handleSaveName])

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
    // Map status to display label
    const labelMap: Record<string, string> = {
      RUNNING: 'In Progress',
      FAILED: 'Error',
    }
    const label = labelMap[status] || status.charAt(0) + status.slice(1).toLowerCase()
    return (
      <span className={`px-2 py-0.5 text-sm font-medium ${styles.bg} ${styles.text} ${styles.border || ''}`}>
        {label}
      </span>
    )
  }

  const getScoreBadge = (score: number | null, testType: string) => {
    if (testType === 'SCREENSHOTS') {
      // Browser tests show "Review" badge
      return (
        <span className="px-2 py-0.5 text-sm font-medium bg-medium-gray text-black">
          Review
        </span>
      )
    }

    if (score === null) {
      // No score available (e.g., PAGE_PREFLIGHT - score shown in detail view)
      return (
        <span className="px-2 py-0.5 text-sm font-medium bg-medium-gray text-black">
          View
        </span>
      )
    }

    return (
      <span className={`px-2 py-0.5 text-sm font-medium ${getScoreBadgeClasses(score)}`}>
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
          <h3>
            {dateStr} Site Audit
          </h3>
          {getStatusBadge(testRun.status)}
        </div>

        {/* Meta Info */}
        <div>
          <p><strong>Created:</strong> {formatDate(testRun.createdAt)}</p>
          {testRun.finishedAt && <p>Completed: {formatDate(testRun.finishedAt)}</p>}
        </div>

        {/* Score */}
        {testRun.score !== null && (
          <div className="space-y-2">
            <h3>Score</h3>
            <div className="text-2xl font-bold">
              {testRun.score}<span className="text-sm font-normal text-black/60">/100</span>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {testRun.urlResults && (
          <div className="space-y-2">
            <h3>Summary</h3>
            <div className="text-sm">
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
        {/* Header with progress dots */}
        <div className="flex items-center justify-between mb-0.5">
          <h2>Test Status</h2>
          <div className="mr-2 animate-progress-squares">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        {/* Created Date */}
        <p>
          <strong>Created:</strong> {formatDate(releaseRun.createdAt)}
        </p>

        {/* Test Status List */}
        <div className="space-y-3 border-t border-medium-gray pt-4">
          {releaseRun.selectedTests.map((testType) => {
            const testRun = releaseRun.testRuns.find(r => r.type === testType)
            const status = testRun?.status || 'QUEUED'
            return (
              <div key={testType} className="flex items-center justify-between pb-3 pt-0 border-b border-medium-gray last:border-0">
                <span>{TEST_TYPE_LABELS[testType] || testType}</span>
                {getStatusBadge(status)}
              </div>
            )
          })}
        </div>

        {/* Pages Submitted */}
        <div className="space-y-2 pt-4">
          <h2>Pages Submitted</h2>
            <ul className="space-y-1">
              {releaseRun.urls.map((url, index) => (
                  <li key={index} className="truncate">
                    {url}
                  </li>
              ))}
            </ul>
        </div>

        {/* Cancel Button - at bottom for consistency with Delete button */}
        <div className="pt-4">
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-sm text-white bg-red hover:bg-red/80 disabled:opacity-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Test'}
          </button>
        </div>
      </div>
    )
  }

  // RESULTS VIEW
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-3">
          Results:{' '}
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleCancelEditName}
              disabled={isSavingName}
              maxLength={50}
              autoFocus
              className="text-[1.5rem]/1 font-bold border-b border-dark-gray bg-transparent outline-none px-0 py-0"
              style={{ width: `${Math.max(editedName.length, 10)}ch` }}
            />
          ) : (
            <>
              <span>{releaseRun.name || 'Untitled Test'}</span>
              <button
                onClick={handleStartEditName}
                className="relative text-sm font-normal text-black/60 hover:text-black underline border-0 bg-transparent top-1 p-0"
              >
                (Edit)
              </button>
            </>
          )}
        </h2>
      </div>

      {/* Created Date */}
      <p>
        <strong>Created:</strong> {formatDate(releaseRun.createdAt)}
      </p>

      {/* URL Results with Expandable Sections */}
      <div className="space-y-2 border-t border-medium-gray pt-4 pb-2 mb-2">
        {releaseRun.urls.map((url) => {
          const isExpanded = expandedUrls.has(url)

          return (
            <div key={url} className="border-b border-medium-gray last:border-0">
              <button
                onClick={() => toggleUrlExpanded(url)}
                className="w-full flex border-0 items-center justify-between text-left p-0">
                <p><strong>{url}</strong></p>
                  <svg
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
              </button>

              {/* Expanded Content - Test Results */}
              {isExpanded && (
                <div className="pb-3 space-y-2">
                  {releaseRun.selectedTests.map((testType) => {
                    const testRun = releaseRun.testRuns.find(r => r.type === testType)
                    const route = TEST_TYPE_ROUTES[testType]

                    // For PERFORMANCE, find both mobile and desktop results
                    if (testType === 'PERFORMANCE') {
                      const mobileResult = testRun?.urlResults?.find(ur => ur.url === url && ur.viewport === 'mobile')
                      const desktopResult = testRun?.urlResults?.find(ur => ur.url === url && ur.viewport === 'desktop')
                      const isFailed = testRun?.status === 'FAILED'

                      // Build link - use mobile result ID if available
                      const linkHref = mobileResult?.id
                        ? `/releasepass/preflight/${route}?test=${releaseRun.id}&urlResult=${mobileResult.id}`
                        : desktopResult?.id
                          ? `/releasepass/preflight/${route}?test=${releaseRun.id}&urlResult=${desktopResult.id}`
                          : `/releasepass/preflight/${route}?test=${releaseRun.id}`

                      return (
                        <div key={testType} className="flex items-center justify-between py-0.5">
                          {isFailed ? (
                            <span className="text-black/60">
                              {TEST_TYPE_LABELS[testType] || testType}
                            </span>
                          ) : (
                            <Link
                              href={linkHref}
                              className="underline hover:text-brand-cyan"
                            >
                              {TEST_TYPE_LABELS[testType] || testType}
                            </Link>
                          )}
                          <div className="flex items-center gap-2">
                            {isFailed ? (
                              <span className="px-2 py-0.5 text-s font-medium bg-red text-white">
                                Error
                              </span>
                            ) : (
                              <>
                                {mobileResult?.score != null && (
                                  <span className={`px-2 py-0.5 text-s font-medium ${getScoreBadgeClasses(mobileResult.score)}`} title="Mobile">
                                    {mobileResult.score}
                                  </span>
                                )}
                                {desktopResult?.score != null && (
                                  <span className={`px-2 py-0.5 text-s font-medium ${getScoreBadgeClasses(desktopResult.score)}`} title="Desktop">
                                    {desktopResult.score}
                                  </span>
                                )}
                                {mobileResult?.score == null && desktopResult?.score == null && (
                                  <span className="px-2 py-0.5 text-s font-medium bg-medium-gray text-black">
                                    View
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // For other test types, use single urlResult
                    const urlResult = testRun?.urlResults?.find(ur => ur.url === url)
                    const isFailed = testRun?.status === 'FAILED'

                    // Calculate per-URL score based on test type
                    let score: number | null = null
                    if ((testType === 'PAGE_PREFLIGHT' || testType === 'SPELLING') && urlResult?.score != null) {
                      // Preflight & Spelling: use stored per-URL score
                      score = urlResult.score
                    }

                    // Build link - use urlResultId if available
                    const linkHref = urlResult?.id
                      ? `/releasepass/preflight/${route}?test=${releaseRun.id}&urlResult=${urlResult.id}`
                      : `/releasepass/preflight/${route}?test=${releaseRun.id}`

                    return (
                      <div key={testType} className="flex items-center justify-between py-0.5">
                        {isFailed ? (
                          <span className="text-black/60">
                            {TEST_TYPE_LABELS[testType] || testType}
                          </span>
                        ) : (
                          <Link
                            href={linkHref}
                            className="underline hover:text-brand-cyan"
                          >
                            {TEST_TYPE_LABELS[testType] || testType}
                          </Link>
                        )}
                        {isFailed ? (
                          <span className="px-2 py-0.5 text-s font-medium bg-red text-white">
                            Error
                          </span>
                        ) : (
                          getScoreBadge(score, testType)
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Action Buttons - Show if test failed or completed */}
      {(failed || !inProgress) && (
        <div className="pt-4 flex justify-between items-center">
          <button
            onClick={handleRerunAll}
            disabled={rerunningAll}
            className="px-4 py-2 text-sm text-white bg-black hover:bg-black/80 disabled:opacity-50"
          >
            {rerunningAll ? 'Rerunning...' : 'Rerun All'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm text-white bg-red hover:bg-red/80 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Test'}
          </button>
        </div>
      )}
    </div>
  )
}

export default memo(TestResultsSummary)
