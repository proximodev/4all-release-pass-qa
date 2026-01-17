'use client'

import Card from '@/components/ui/card/Card'
import NewPreflightTestForm from '@/components/releasepass/NewPreflightTestForm'
import TabPanel from '@/components/layout/TabPanel'
import NewTestPageWrapper from '@/components/releasepass/NewTestPageWrapper'

export default function NewPreflightTestPage() {
  return (
    <NewTestPageWrapper
      backPath="/releasepass/preflight"
      testTypeLabel="Preflight"
    >
      {(project) => (
        <TabPanel>
          <Card title={`New Test Run for ${project.name}`}>
            <NewPreflightTestForm projectId={project.id} projectName={project.name} />
          </Card>
        </TabPanel>
      )}
    </NewTestPageWrapper>
  )
}
