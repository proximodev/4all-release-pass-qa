'use client'

import { useState, useEffect } from 'react'

interface TestRun {
  id: string
  type: string
  status: string
  score: number | null
  finishedAt: string | null
  _count?: {
    issues: number
    urlResults: number
  }
}

interface ReleaseRun {
  id: string
  name: string | null
  status: string
  urls: string[]
  selectedTests: string[]
  createdAt: string
  testRuns: TestRun[]
  project: {
    id: string
    name: string
    siteUrl: string
  }
}

interface TestResultsSummaryProps {
  testId: string
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

export default function TestResultsSummary({ testId }: TestResultsSummaryProps) {
  const [releaseRun, setReleaseRun] = useState<ReleaseRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (testId) {
      fetchReleaseRun(testId)
    }
  }, [testId])

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

  if (!releaseRun) {
    return (
      <div className="p-4 text-center text-black/60">
        No test selected
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
          {releaseRun.testRuns.map((testRun) => (
            <div key={testRun.id} className="py-2 flex items-center justify-between">
              <span className="text-sm">
                {TEST_TYPE_LABELS[testRun.type] || testRun.type}
              </span>
              <div className="flex items-center gap-2">
                {testRun.score !== null && (
                  <span className="text-sm font-medium">{testRun.score}/100</span>
                )}
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[testRun.status] || 'bg-medium-gray'}`}
                >
                  {testRun.status}
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
    </div>
  )
}
