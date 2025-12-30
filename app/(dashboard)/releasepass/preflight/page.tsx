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
      <Card title="Get Started" className="select border-r-1 border-gray-400 pr-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ProjectSelectorWithAdd onProjectChange={setProjectId} />
          <TestSelector
            projectId={projectId}
            onTestChange={setTestId}
            newTestPath="/releasepass/preflight/new"
          />
        </div>
      </Card>
      <Card>
        {testId && <TestResultsSummary testId={testId} />}
      </Card>

    </TwoColumnGrid>
  )
}
