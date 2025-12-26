'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import Input from '@/components/ui/input/Input'
import Link from 'next/link'
import TabPanel from "@/components/layout/TabPanel"

interface Project {
  id: string
  name: string
  siteUrl: string
  sitemapUrl: string | null
}

export default function NewSiteAuditPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = searchParams.get('project')
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate default test name
  const now = new Date()
  const defaultName = `${now.getMonth() + 1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)} Site Audit`
  const [testName, setTestName] = useState(defaultName)

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId)
    } else {
      setLoading(false)
    }
  }, [projectId])

  const fetchProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (res.ok) {
        const data = await res.json()
        setProject(data)
      }
    } catch (error) {
      console.error('Failed to fetch project:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project) return

    setSubmitting(true)
    setError(null)

    try {
      // Create a site audit test run directly (not a release run)
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
    router.push(`/releasepass/site-audit?project=${projectId}`)
  }

  if (loading) {
    return (
      <TabPanel>
        <Card>
          <p className="text-black/60">Loading...</p>
        </Card>
      </TabPanel>
    )
  }

  if (!projectId || !project) {
    return (
      <TabPanel>
        <Card>
          <p className="text-black/60 mb-4">
            Please select a project first to create a new site audit.
          </p>
          <Link
            href="/releasepass/site-audit"
            className="text-brand-cyan hover:underline"
          >
            Go back to Site Audit
          </Link>
        </Card>
      </TabPanel>
    )
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
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="Enter test name"
          />

          <div className="space-y-2">
            <label className="block font-medium">Site URL</label>
            <p className="text-black/70">{project.siteUrl}</p>
          </div>

          {project.sitemapUrl && (
            <div className="space-y-2">
              <label className="block font-medium">Sitemap URL</label>
              <p className="text-black/70">{project.sitemapUrl}</p>
            </div>
          )}

          <div className="p-4 bg-light-gray rounded">
            <p className="text-sm text-black/70">
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
