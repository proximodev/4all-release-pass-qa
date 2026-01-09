'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { calculateReleaseScore, getScoreBadgeClasses } from '@/lib/scoring'
import type { ReleaseRun } from '@/lib/types/releasepass'

const POLL_INTERVAL_MS = 5000

/**
 * Displays the release-level status badge based on averaged TestRun scores.
 * Reads the test ID from URL search params and fetches release data.
 * Shows Pass/Fail status with score-based coloring.
 */
export default function ReleaseStatusBadge() {
  const searchParams = useSearchParams()
  const testId = searchParams.get('test')

  const [releaseRun, setReleaseRun] = useState<ReleaseRun | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReleaseRun = useCallback(async (id: string, showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch(`/api/release-runs/${id}`)
      if (!res.ok) return
      const data = await res.json()
      setReleaseRun(data)
    } catch {
      // Silently fail - badge just won't show
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  // Fetch release run when test ID changes
  useEffect(() => {
    if (testId) {
      fetchReleaseRun(testId)
    } else {
      setReleaseRun(null)
    }
  }, [testId, fetchReleaseRun])

  // Poll for updates while tests are in progress
  useEffect(() => {
    if (!releaseRun) return

    const hasInProgress = releaseRun.testRuns.some(
      run => run.status === 'QUEUED' || run.status === 'RUNNING'
    )
    if (!hasInProgress) return

    const intervalId = setInterval(() => {
      fetchReleaseRun(releaseRun.id, false)
    }, POLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [releaseRun, fetchReleaseRun])

  // Listen for score updates from ignore toggle
  useEffect(() => {
    if (!releaseRun) return

    const handleScoreUpdate = () => {
      fetchReleaseRun(releaseRun.id, false)
    }

    window.addEventListener('releaserun-score-updated', handleScoreUpdate)
    return () => window.removeEventListener('releaserun-score-updated', handleScoreUpdate)
  }, [releaseRun, fetchReleaseRun])

  // Don't render if no test selected or still loading
  if (!testId || loading || !releaseRun) {
    return null
  }

  // Calculate release score
  const result = calculateReleaseScore(releaseRun.testRuns, releaseRun.selectedTests)

  // Don't render if no status (tests still running or not started)
  if (result.status === null) {
    return null
  }

  // Handle Incomplete status (operational failures)
  if (result.status === 'Incomplete') {
    return (
      <div className="flex items-center gap-2 pr-8">
        <span>Release Status:</span>
        <span className="px-2 text-m py-0.25 bg-red text-white">
          Incomplete
        </span>
      </div>
    )
  }

  // Normal Pass/Fail status with score-based coloring
  const badgeClasses = getScoreBadgeClasses(result.score!)

  return (
    <div className="flex items-center gap-2 pr-8">
      <span>Release Status:</span>
      <span className={`px-2 text-m py-0.25 ${badgeClasses}`}>
        {result.status}
      </span>
    </div>
  )
}
