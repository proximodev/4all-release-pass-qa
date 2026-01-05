'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import PageContainer from '@/components/layout/PageContainer'
import PageHeader from '@/components/layout/PageHeader'
import Link from 'next/link'
import { projectTabs } from "@/lib/constants/navigation"
import Tabs from "@/components/ui/tabs/Tabs"
import TabPanel from "@/components/layout/TabPanel"


interface Project {
  id: string
  name: string
  siteUrl: string
  sitemapUrl: string | null
  createdAt: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (<PageContainer>
      <Tabs tabs={projectTabs} />
      <TabPanel>
      <div className="mb-8">
        <input
          type="text"
          placeholder="Filter by name"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-medium-gray rounded w-full max-w-md"
        />
      </div>

      <Card>
        {loading ? (
          <p>Loading projects...</p>
        ) : filteredProjects.length === 0 ? (
          <p>
            {filter ? 'No projects match your filter.' : 'No projects yet. Create your first project to get started.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-medium-gray text-left">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">URL</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="border-b border-medium-gray/50">
                    <td className="py-4">{project.name}</td>
                    <td className="py-4">
                      <a href={project.siteUrl} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline">
                        {project.siteUrl}
                      </a>
                    </td>
                    <td className="py-4">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-right space-x-2">
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="secondary">View</Button>
                      </Link>
                      <Link href={`/projects/${project.id}/edit`}>
                        <Button variant="secondary">Edit</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      </TabPanel>
    </PageContainer>
  )
}


