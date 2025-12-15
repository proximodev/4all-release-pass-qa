'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Select from '@/components/ui/select/Select'

interface Project {
  id: string
  name: string
}

export default function ProjectSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('')

  useEffect(() => {
    fetchProjects()
    // Get current project from URL query parameter
    const projectId = searchParams.get('project')
    if (projectId) {
      setSelectedProject(projectId)
    }
  }, [searchParams])

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

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value
    setSelectedProject(projectId)

    // Update URL with project query parameter
    if (projectId) {
      router.push(`${pathname}?project=${projectId}`)
    } else {
      router.push(pathname)
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-md">
        <Select
          label="Select Project"
          value=""
          onChange={() => {}}
          disabled
          options={[{ value: '', label: 'Loading projects...' }]}
        />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="w-full max-w-md">
        <Select
          label="Select Project"
          value=""
          onChange={() => {}}
          disabled
          options={[{ value: '', label: 'No projects available' }]}
        />
        <p className="text-sm text-black/60 mt-2">
          Create a project first to run tests.
        </p>
      </div>
    )
  }

  const selectOptions = [
    { value: '', label: 'Choose a project...' },
    ...projects.map((project) => ({
      value: project.id,
      label: project.name,
    })),
  ]

  return (
    <div className="w-full max-w-md">
      <Select
        label="Select Project"
        value={selectedProject}
        onChange={handleProjectChange}
        options={selectOptions}
      />
    </div>
  )
}
