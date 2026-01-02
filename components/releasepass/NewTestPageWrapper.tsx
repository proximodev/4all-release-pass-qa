'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Card from '@/components/ui/card/Card'
import Link from 'next/link'
import TabPanel from '@/components/layout/TabPanel'

export interface Project {
  id: string
  name: string
  siteUrl: string
  sitemapUrl?: string | null
}

interface NewTestPageWrapperProps {
  /** Path to go back to when no project selected */
  backPath: string
  /** Label for the test type (e.g., "Preflight", "Site Audit") */
  testTypeLabel: string
  /** Render function that receives the project */
  children: (project: Project) => React.ReactNode
}

export default function NewTestPageWrapper({
  backPath,
  testTypeLabel,
  children,
}: NewTestPageWrapperProps) {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <TabPanel>
        <Card>
          <p>Loading...</p>
        </Card>
      </TabPanel>
    )
  }

  if (!projectId || !project) {
    return (
      <TabPanel>
        <Card>
          <p>
            Please select a project first to create a new {testTypeLabel.toLowerCase()}.
          </p>
          <Link
            href={backPath}
            className="text-brand-cyan hover:underline"
          >
            Go back to {testTypeLabel}
          </Link>
        </Card>
      </TabPanel>
    )
  }

  return <>{children(project)}</>
}
