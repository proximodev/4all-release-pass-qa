'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ResultItem {
  id: string
  status: string
  code: string
  name: string
  severity?: string
  impact?: string
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

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-medium-gray text-black',
  QUEUED: 'bg-medium-gray text-black',
  RUNNING: 'bg-brand-yellow text-black',
  SUCCESS: 'bg-brand-cyan text-white',
  READY: 'bg-brand-cyan text-white',
  FAILED: 'bg-red text-white',
  FAIL: 'bg-red text-white',
  PARTIAL: 'bg-brand-yellow text-black',
}

const TEST_TYPE_LABELS: Record<string, string> = {
  PAGE_PREFLIGHT: 'Baseline',
  PERFORMANCE: 'Performance',
  SCREENSHOTS: 'Browser',
  SPELLING: 'Spelling',
  SITE_AUDIT: 'Site Audit',
}

export default function TestResultsSummary({ testId, mode = 'releaseRun' }: TestResultsSummaryProps) {
  const router = useRouter()
  const [releaseRun, setReleaseRun] = useState<ReleaseRun | null>(null)
  const [testRun, setTestRun] = useState<TestRunData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (testId) {
      if (mode === 'testRun') {
        fetchTestRun(testId)
      } else {
        fetchReleaseRun(testId)
      }
    }
  }, [testId, mode])

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
          <span
            className={`px-3 py-1 rounded text-sm font-medium ${STATUS_COLORS[testRun.status] || 'bg-medium-gray'}`}
          >
            {testRun.status}
          </span>
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

  return (
    <div className="space-y-4">
      {/* Test Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-lg">
          {releaseRun.name || 'Untitled Test'}
        </h3>
        <span
          className={`px-3 py-1 rounded text-sm font-medium ${STATUS_COLORS[releaseRun.status] || 'bg-medium-gray'}`}
        >
          {releaseRun.status}
        </span>
      </div>

      {/* Meta Info */}
      <div className="text-sm text-black/60">
        <p>Created: {formatDate(releaseRun.createdAt)}</p>
        <p>URLs: {releaseRun.urls.length} page(s)</p>
      </div>

      {/* Test Runs */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Test Results</h4>
        <div className="divide-y divide-medium-gray">
          {releaseRun.testRuns.map((run) => (
            <div key={run.id} className="py-2 flex items-center justify-between">
              <span className="text-sm">
                {TEST_TYPE_LABELS[run.type] || run.type}
              </span>
              <div className="flex items-center gap-2">
                {run.score !== null && (
                  <span className="text-sm font-medium">{run.score}/100</span>
                )}
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[run.status] || 'bg-medium-gray'}`}
                >
                  {run.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* URLs List */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Pages Tested</h4>
        <ul className="text-sm space-y-1">
          {releaseRun.urls.slice(0, 5).map((url, index) => (
            <li key={index} className="truncate text-black/70">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-cyan hover:underline"
              >
                {url}
              </a>
            </li>
          ))}
          {releaseRun.urls.length > 5 && (
            <li className="text-black/50">
              +{releaseRun.urls.length - 5} more pages
            </li>
          )}
        </ul>
      </div>

      {/* Delete Button */}
      <div className="pt-4 border-t border-medium-gray">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm text-red hover:text-red/80 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete Test'}
        </button>
      </div>
    </div>
  )
}
