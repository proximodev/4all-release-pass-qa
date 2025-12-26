'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/input/Input'
import Textarea from '@/components/ui/textarea/Textarea'
import Checkbox from '@/components/ui/checkbox/Checkbox'
import Button from '@/components/ui/button/Button'

interface NewPreflightTestFormProps {
  projectId: string
  projectName?: string
}

const TEST_TYPES = [
  { id: 'PAGE_PREFLIGHT', label: 'Baseline', defaultChecked: true },
  { id: 'PERFORMANCE', label: 'Performance', defaultChecked: true },
  { id: 'SPELLING', label: 'Spelling', defaultChecked: true },
  { id: 'SCREENSHOTS', label: 'Browser', defaultChecked: true },
] as const

export default function NewPreflightTestForm({ projectId, projectName }: NewPreflightTestFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate default test name
  const now = new Date()
  const defaultName = `${now.getMonth() + 1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)} Preflight Test`

  const [testName, setTestName] = useState(defaultName)
  const [selectedTests, setSelectedTests] = useState<string[]>(
    TEST_TYPES.filter((t) => t.defaultChecked).map((t) => t.id)
  )
  const [urls, setUrls] = useState('')

  const handleTestTypeChange = (testId: string, checked: boolean) => {
    if (checked) {
      setSelectedTests((prev) => [...prev, testId])
    } else {
      setSelectedTests((prev) => prev.filter((id) => id !== testId))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Parse URLs from textarea (one per line)
    const urlList = urls
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)

    if (urlList.length === 0) {
      setError('Please enter at least one URL to test')
      return
    }

    if (selectedTests.length === 0) {
      setError('Please select at least one test type')
      return
    }

    // Validate URLs
    const invalidUrls = urlList.filter((url) => {
      try {
        new URL(url)
        return false
      } catch {
        return true
      }
    })

    if (invalidUrls.length > 0) {
      setError(`Invalid URL(s): ${invalidUrls.join(', ')}`)
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/release-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name: testName,
          urls: urlList,
          selectedTests,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create test')
      }

      const releaseRun = await res.json()

      // Navigate back to preflight page with the new test selected
      router.push(`/releasepass/preflight?project=${projectId}&test=${releaseRun.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create test')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push(`/releasepass/preflight?project=${projectId}`)
  }

  return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
            <div className="p-3 bg-red/10 border border-red rounded text-red text-sm">
              {error}
            </div>
        )}

        <Input
            label="Test Name"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="Enter test name"
        />

        <div>
          <label className="block font-medium mb-3">Test Types</label>
          <div className="flex flex-wrap gap-4">
            {TEST_TYPES.map((testType) => (
                <Checkbox
                    key={testType.id}
                    label={testType.label}
                    checked={selectedTests.includes(testType.id)}
                    onChange={(e) => handleTestTypeChange(testType.id, e.target.checked)}
                />
            ))}
          </div>
        </div>

        <label className="font-medium mb-3">Pages to test</label>
        <Textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="Enter URLs to test (one per line)"
            rows={8}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Starting...' : 'Start Test'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </form>
  )
}
