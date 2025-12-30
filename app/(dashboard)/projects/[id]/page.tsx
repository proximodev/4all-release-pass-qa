'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import PageContainer from '@/components/layout/PageContainer'
import Tabs from '@/components/ui/tabs/Tabs'
import { projectTabs } from '@/lib/constants/navigation'
import Link from 'next/link'
import TabPanel from "@/components/layout/TabPanel"

interface Project {
  id: string
  name: string
  siteUrl: string
  sitemapUrl: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface ProjectViewPageProps {
  params: Promise<{ id: string }>
}

export default function ProjectViewPage({ params }: ProjectViewPageProps) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id)
      fetchProject(id)
    })
  }, [params])

  const fetchProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`)

      if (!res.ok) {
        if (res.status === 404) {
          setError('Project not found')
        } else {
          setError('Failed to load project')
        }
        return
      }

      const data = await res.json()
      setProject(data)
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <Tabs tabs={projectTabs} />
        <div className="flex justify-center items-center py-12">
          <p>Loading project...</p>
        </div>
      </PageContainer>
    )
  }

  if (error || !project) {
    return (
      <PageContainer>
        <Tabs tabs={projectTabs} />
        <Card title="Error">
          <div className="space-y-4">
            <p>{error || 'Project not found'}</p>
            <Button onClick={() => router.push('/projects')}>
              Back to Projects
            </Button>
          </div>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Tabs tabs={projectTabs} />
      <TabPanel>
      <Card title={"View " + project.name}>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black/70 mb-1">
                Project Name
              </label>
              <p>{project.name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-black/70 mb-1">
                Site URL
              </label>
              <a
                href={project.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-cyan hover:underline"
              >
                {project.siteUrl}
              </a>
            </div>

            <div>
              <label className="block text-sm font-medium text-black/70 mb-1">
                Sitemap URL
              </label>
              <a
                href={project.sitemapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-cyan hover:underline"
              >
                {project.sitemapUrl}
              </a>
            </div>

            {project.notes && (
              <div>
                <label className="block text-sm font-medium text-black/70 mb-1">
                  Notes
                </label>
                <p>{project.notes}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-medium-gray">
              <div>
                <label className="block text-sm font-medium text-black/70 mb-1">
                  Created
                </label>
                <p>
                  {new Date(project.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-black/70 mb-1">
                  Last Updated
                </label>
                <p>
                  {new Date(project.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4 pt-4 border-t border-medium-gray">
            <Link href={`/projects/${projectId}/edit`}>
              <Button>Edit Project</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => router.push('/projects')}
            >
              Back to Projects
            </Button>
          </div>
        </div>
      </Card>
      </TabPanel>
    </PageContainer>
  )
}
