'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { TestRunSummary, ReleaseRunSummary } from '@/lib/types/releasepass'

type SelectableItem = ReleaseRunSummary | TestRunSummary

interface TestSelectorProps {
  projectId: string | null
  onTestChange?: (testId: string | null) => void
  newTestPath: string
  /** 'releaseRun' for Preflight tests, 'testRun' for Site Audit */
  mode?: 'releaseRun' | 'testRun'
  /** Required when mode is 'testRun' - filters by test type */
  testType?: string
}

export default function TestSelector({
  projectId,
  onTestChange,
  newTestPath,
  mode = 'releaseRun',
  testType,
}: TestSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<SelectableItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTest, setSelectedTest] = useState<string>('')

  useEffect(() => {
    if (projectId) {
      fetchItems(projectId)
    } else {
      setItems([])
      setSelectedTest('')
    }
  }, [projectId, mode, testType])

  useEffect(() => {
    const testId = searchParams.get('test')
    if (testId) {
      setSelectedTest(testId)
    }
  }, [searchParams])

  const fetchItems = async (projectId: string) => {
    setLoading(true)
    try {
      let url: string
      if (mode === 'testRun' && testType) {
        url = `/api/test-runs?projectId=${projectId}&type=${testType}`
      } else {
        url = `/api/release-runs?projectId=${projectId}`
      }

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch (error) {
      console.error('Failed to fetch items:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatItemName = (item: SelectableItem) => {
    // ReleaseRun has a name field
    if ('name' in item && item.name) return item.name

    const date = new Date(item.createdAt)
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`

    // For testRun mode, include the type
    if (mode === 'testRun') {
      return `${dateStr} Site Audit`
    }
    return `${dateStr} Test`
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
          className="w-full py-2 pl-1 pr-4 border border-medium-gray rounded bg-white opacity-50 focus:outline-none focus:border-transparent "
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
          className="w-full px-3 py-2 border border-medium-gray rounded bg-white opacity-50 focus:outline-none focus:border-transparent "
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
        className="w-full py-2 pl-2 pr-10 border border-medium-gray rounded focus:outline-none focus:border-transparent bg-white"
      >
        <option value="">Select</option>
        <option value="new-test">(+) New Test</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {formatItemName(item)}
          </option>
        ))}
      </select>
    </div>
  )
}
