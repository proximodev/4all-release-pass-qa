'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import TwoColumnGrid from '@/components/layout/TwoColumnGrid'
import Card from '@/components/ui/card/Card'
import ProjectSelectorWithAdd from '@/components/releasepass/ProjectSelectorWithAdd'
import TestSelector from '@/components/releasepass/TestSelector'
import TestResultsSummary from '@/components/releasepass/TestResultsSummary'

export default function SiteAuditPage() {
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
        <div className="space-y-4">
          <ProjectSelectorWithAdd onProjectChange={setProjectId} />
          <TestSelector
            projectId={projectId}
            onTestChange={setTestId}
            newTestPath="/releasepass/site-audit/new"
          />
        </div>
      </Card>
      <Card title="Latest Results">
        {testId ? (
          <TestResultsSummary testId={testId} />
        ) : (
          <p className="text-black/60">
            {projectId
              ? 'Select a test to view results, or create a new site audit.'
              : 'Select a project to get started.'}
          </p>
        )}
      </Card>
    </TwoColumnGrid>
  )
}
