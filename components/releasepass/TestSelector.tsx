'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface TestRun {
  id: string
  type: string
  status: string
  score: number | null
}

interface ReleaseRun {
  id: string
  name: string | null
  status: string
  createdAt: string
  testRuns: TestRun[]
}

interface TestSelectorProps {
  projectId: string | null
  onTestChange?: (testId: string | null) => void
  newTestPath: string
}

export default function TestSelector({ projectId, onTestChange, newTestPath }: TestSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [releaseRuns, setReleaseRuns] = useState<ReleaseRun[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTest, setSelectedTest] = useState<string>('')

  useEffect(() => {
    if (projectId) {
      fetchReleaseRuns(projectId)
    } else {
      setReleaseRuns([])
      setSelectedTest('')
    }
  }, [projectId])

  useEffect(() => {
    const testId = searchParams.get('test')
    if (testId) {
      setSelectedTest(testId)
    }
  }, [searchParams])

  const fetchReleaseRuns = async (projectId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/release-runs?projectId=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setReleaseRuns(data)
      }
    } catch (error) {
      console.error('Failed to fetch release runs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTestName = (releaseRun: ReleaseRun) => {
    if (releaseRun.name) return releaseRun.name
    const date = new Date(releaseRun.createdAt)
    return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)} Test`
  }

  const handleTestChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value

    if (value === 'new-test') {
      // Navigate to new test page
      const params = new URLSearchParams()
      if (projectId) params.set('project', projectId)
      router.push(`${newTestPath}?${params.toString()}`)
      return
    }

    setSelectedTest(value)
    onTestChange?.(value || null)

    // Update URL with test query parameter
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('test', value)
    } else {
      params.delete('test')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  if (!projectId) {
    return (
      <div className="w-full">
        <label className="block font-medium mb-2">Test</label>
        <select
          disabled
          className="w-full px-3 py-2 border border-medium-gray rounded bg-white opacity-50"
        >
          <option>Select a project first</option>
        </select>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="w-full">
        <label className="block font-medium mb-2">Test</label>
        <select
          disabled
          className="w-full px-3 py-2 border border-medium-gray rounded bg-white opacity-50"
        >
          <option>Loading...</option>
        </select>
      </div>
    )
  }

  return (
    <div className="w-full">
      <label className="block font-medium mb-2">Test</label>
      <select
        value={selectedTest}
        onChange={handleTestChange}
        className="w-full px-3 py-2 border border-medium-gray rounded focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:border-transparent bg-white"
      >
        <option value="">Select</option>
        <option value="new-test">(+) New Test</option>
        {releaseRuns.map((run) => (
          <option key={run.id} value={run.id}>
            {formatTestName(run)}
          </option>
        ))}
      </select>
    </div>
  )
}
