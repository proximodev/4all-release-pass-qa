'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const STORAGE_KEY = 'releasepass_last_project'

interface Project {
  id: string
  name: string
}

interface ProjectSelectorWithAddProps {
  onProjectChange?: (projectId: string | null) => void
}

export default function ProjectSelectorWithAdd({ onProjectChange }: ProjectSelectorWithAddProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  // Handle initial project selection from URL or localStorage
  useEffect(() => {
    if (loading || initialLoadDone) return

    const urlProjectId = searchParams.get('project')

    if (urlProjectId) {
      // URL param takes precedence
      setSelectedProject(urlProjectId)
      onProjectChange?.(urlProjectId)
    } else {
      // Check localStorage for saved project
      const savedProjectId = localStorage.getItem(STORAGE_KEY)
      if (savedProjectId) {
        // Verify the saved project still exists
        const projectExists = projects.some(p => p.id === savedProjectId)
        if (projectExists) {
          setSelectedProject(savedProjectId)
          onProjectChange?.(savedProjectId)
          // Update URL to reflect the selection
          const params = new URLSearchParams(searchParams.toString())
          params.set('project', savedProjectId)
          router.replace(`${pathname}?${params.toString()}`)
        } else {
          // Project no longer exists, clear localStorage
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    }

    setInitialLoadDone(true)
  }, [loading, projects, searchParams, initialLoadDone, pathname, router, onProjectChange])

  // Handle URL changes after initial load
  useEffect(() => {
    if (!initialLoadDone) return

    const projectId = searchParams.get('project')
    if (projectId) {
      setSelectedProject(projectId)
    }
  }, [searchParams, initialLoadDone])

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
    const value = e.target.value

    if (value === 'add-new') {
      // Navigate to add project page with return URL
      const returnUrl = encodeURIComponent(pathname)
      router.push(`/projects/new?returnTo=${returnUrl}`)
      return
    }

    setSelectedProject(value)
    onProjectChange?.(value || null)

    // Save to localStorage (or clear if deselected)
    if (value) {
      localStorage.setItem(STORAGE_KEY, value)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }

    // Update URL with project query parameter
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('project', value)
    } else {
      params.delete('project')
    }
    // Clear test selection when project changes
    params.delete('test')
    router.push(`${pathname}?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="w-full">
        <label className="block font-medium mb-2">Project</label>
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
      <label className="block font-medium mb-2">Project</label>
      <select
        value={selectedProject}
        onChange={handleProjectChange}
        className="w-full px-3 py-2 border border-medium-gray rounded focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent bg-white"
      >
        <option value="">Select</option>
        <option value="add-new">(+) Add New Project</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  )
}
