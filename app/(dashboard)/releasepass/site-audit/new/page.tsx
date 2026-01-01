'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import Input from '@/components/ui/input/Input'
import TabPanel from '@/components/layout/TabPanel'
import NewTestPageWrapper, { Project } from '@/components/releasepass/NewTestPageWrapper'

function SiteAuditForm({ project }: { project: Project }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate default test name
  const now = new Date()
  const defaultName = `${now.getMonth() + 1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)} Site Audit`
  const [testName, setTestName] = useState(defaultName)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/test-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          type: 'SITE_AUDIT',
          scope: 'SITEMAP',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create site audit')
      }

      const testRun = await res.json()
      router.push(`/releasepass/site-audit?project=${project.id}&test=${testRun.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create site audit')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push(`/releasepass/site-audit?project=${project.id}`)
  }

  return (
    <TabPanel>
      <Card title={`New Site Audit for ${project.name}`}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red/10 border border-red rounded text-red text-sm">
              {error}
            </div>
          )}

          <Input
            label="Test Name"
            className="block"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="Enter test name"
          />

          <div className="space-y-2">
            <label className="block">Site URL</label>
            <p>{project.siteUrl}</p>
          </div>

          {project.sitemapUrl && (
            <div className="space-y-2">
              <label className="block">Sitemap URL</label>
              <p>{project.sitemapUrl}</p>
            </div>
          )}

          <div className="p-4 bg-light-gray rounded">
            <p>
              Site Audit uses SE Ranking to crawl up to 500 pages from your sitemap
              and analyze technical SEO, security, and performance issues.
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Starting...' : 'Start Audit'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </TabPanel>
  )
}

export default function NewSiteAuditPage() {
  return (
    <NewTestPageWrapper
      backPath="/releasepass/site-audit"
      testTypeLabel="Site Audit"
    >
      {(project) => <SiteAuditForm project={project} />}
    </NewTestPageWrapper>
  )
}
