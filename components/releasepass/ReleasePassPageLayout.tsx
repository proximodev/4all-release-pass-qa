'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import TwoColumnGrid from '@/components/layout/TwoColumnGrid'
import Card from '@/components/ui/card/Card'
import ProjectSelectorWithAdd from '@/components/releasepass/ProjectSelectorWithAdd'
import TestSelector from '@/components/releasepass/TestSelector'
import TestResultsSummary from '@/components/releasepass/TestResultsSummary'

interface ReleasePassPageLayoutProps {
  /** 'releaseRun' for Preflight, 'testRun' for Site Audit */
  mode: 'releaseRun' | 'testRun'
  /** Path to the new test page */
  newTestPath: string
  /** Test type filter for testRun mode */
  testType?: 'SITE_AUDIT'
  /** Title for the left card */
  leftCardTitle?: string
  /** Title for the right card */
  rightCardTitle?: string
  /** Empty state message when no test selected */
  emptyMessage?: string
  /** Additional className for the grid */
  className?: string
}

export default function ReleasePassPageLayout({
  mode,
  newTestPath,
  testType,
  leftCardTitle = 'Get Started',
  rightCardTitle,
  emptyMessage = 'Select a project to get started.',
  className,
}: ReleasePassPageLayoutProps) {
  const searchParams = useSearchParams()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [testId, setTestId] = useState<string | null>(null)

  useEffect(() => {
    const project = searchParams.get('project')
    const test = searchParams.get('test')
    setProjectId(project)
    setTestId(test)
  }, [searchParams])

  const getEmptyMessage = () => {
    if (projectId) {
      return 'Select a test to view results, or create a new test.'
    }
    return emptyMessage
  }

  return (
    <TwoColumnGrid className={className}>
      <Card title={leftCardTitle} className={mode === 'releaseRun' ? 'select border-r-1 border-gray-400 pr-8' : ''}>
        <div className={mode === 'releaseRun' ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : 'space-y-4'}>
          <ProjectSelectorWithAdd onProjectChange={setProjectId} />
          <TestSelector
            projectId={projectId}
            onTestChange={setTestId}
            newTestPath={newTestPath}
            mode={mode}
            testType={testType}
          />
        </div>
      </Card>
      <Card title={rightCardTitle}>
        {testId ? (
          <TestResultsSummary testId={testId} mode={mode} />
        ) : (
          <p>{getEmptyMessage()}</p>
        )}
      </Card>
    </TwoColumnGrid>
  )
}
