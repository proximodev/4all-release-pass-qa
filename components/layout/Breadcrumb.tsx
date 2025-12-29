'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface ReleaseRunInfo {
  name: string | null
  project: {
    name: string
  }
}

export default function Breadcrumb() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  const testId = searchParams.get('test')
  const [projectName, setProjectName] = useState<string | null>(null)
  const [releaseRunInfo, setReleaseRunInfo] = useState<ReleaseRunInfo | null>(null)

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

  // Fetch release run info if testId is present (for detail pages)
  useEffect(() => {
    if (testId) {
      fetch(`/api/release-runs/${testId}`)
        .then((res) => res.json())
        .then((data) => setReleaseRunInfo({
          name: data.name,
          project: data.project
        }))
        .catch(() => setReleaseRunInfo(null))
    } else {
      setReleaseRunInfo(null)
    }
  }, [testId])

  // Check if on a detail page (baseline, performance, spelling, browser)
  const isDetailPage = pathname.match(/\/releasepass\/preflight\/(baseline|performance|spelling|browser)/)

  // Generate breadcrumb based on route
  const getBreadcrumb = () => {
    if (pathname.startsWith('/releasepass')) {
      // Detail pages show: ReleasePass / Project Name / Test Name
      if (isDetailPage && releaseRunInfo?.project?.name) {
        return `ReleasePass / ${releaseRunInfo.project.name} / ${releaseRunInfo.name || 'Untitled Test'}`
      }
      // Main pages show: ReleasePass / Project Name (if selected)
      if (projectName) {
        return `ReleasePass / ${projectName}`
      }
      // If we have release run info from testId but not on detail page
      if (releaseRunInfo?.project?.name) {
        return `ReleasePass / ${releaseRunInfo.project.name}`
      }
      return 'ReleasePass'
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
