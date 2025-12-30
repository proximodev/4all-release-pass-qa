'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Card from '@/components/ui/card/Card'
import NewPreflightTestForm from '@/components/releasepass/NewPreflightTestForm'
import Link from 'next/link'
import TabPanel from "@/components/layout/TabPanel"

interface Project {
  id: string
  name: string
  siteUrl: string
}

export default function NewPreflightTestPage() {
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
        <div className="max-w-2xl">
          <Card>
            <p>Loading...</p>
          </Card>
        </div>
      </TabPanel>
    )
  }

  if (!projectId || !project) {
    return (
        <TabPanel>
          <Card>
            <p>
              Please select a project first to create a new test.
            </p>
            <Link
              href="/releasepass/preflight"
              className="text-brand-cyan hover:underline"
            >
              Go back to Preflight
            </Link>
          </Card>
        </TabPanel>
    )
  }

  return (
    <TabPanel>
      <Card title={`New Test for ${project.name}`}>
        <NewPreflightTestForm projectId={project.id} projectName={project.name} />
      </Card>
    </TabPanel>
  )
}
