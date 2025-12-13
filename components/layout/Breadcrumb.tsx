'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Breadcrumb() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  const [projectName, setProjectName] = useState<string | null>(null)

  // Fetch project name if projectId is present
  useEffect(() => {
    if (projectId) {
      fetch(`/api/projects/${projectId}`)
        .then((res) => res.json())
        .then((data) => setProjectName(data.name))
        .catch(() => setProjectName(null))
    } else {
      setProjectName(null)
    }
  }, [projectId])

  // Generate breadcrumb based on route
  const getBreadcrumb = () => {
    if (pathname.startsWith('/qa')) {
      if (projectName) {
        return `QA Tools / ${projectName}`
      }
      return 'QA Tools'
    }
    if (pathname.startsWith('/projects')) {
      return 'Projects'
    }
    if (pathname.startsWith('/settings')) {
      return 'Settings'
    }
    if (pathname.startsWith('/utilities')) {
      return 'Utilities'
    }
    return 'Dashboard'
  }

  return (
    <div className="bg-white border-b border-medium-gray">
      <div className="container mx-auto px-6 py-4">
        <h1 className="text-2xl font-heading font-bold text-black">
          {getBreadcrumb()}
        </h1>
      </div>
    </div>
  )
}
