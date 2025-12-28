'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import TwoColumnGrid from '@/components/layout/TwoColumnGrid'
import Card from '@/components/ui/card/Card'
import ProjectSelectorWithAdd from '@/components/releasepass/ProjectSelectorWithAdd'
import TestSelector from '@/components/releasepass/TestSelector'
import TestResultsSummary from '@/components/releasepass/TestResultsSummary'
import TabPanel from "@/components/layout/TabPanel"

export default function PreflightPage() {
  const searchParams = useSearchParams()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [testId, setTestId] = useState<string | null>(null)

  useEffect(() => {
    const project = searchParams.get('project')
    const test = searchParams.get('test')
    setProjectId(project)
    setTestId(test)
  }, [searchParams])

  return (
    <TwoColumnGrid>
      <Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <ProjectSelectorWithAdd onProjectChange={setProjectId} />
          <TestSelector
            projectId={projectId}
            onTestChange={setTestId}
            newTestPath="/releasepass/preflight/new"
          />
        </div>
      </Card>
      <Card title="Status">
        {testId ? (
          <TestResultsSummary testId={testId} />
        ) : (
          <p className="text-black/60">
            {projectId
              ? 'Select a test to view results, or create a new test.'
              : 'Select a project to get started.'}
          </p>
        )}
      </Card>
    </TwoColumnGrid>
  )
}
