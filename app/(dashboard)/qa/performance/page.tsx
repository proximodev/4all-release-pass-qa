import Tabs from '@/components/ui/tabs/Tabs'
import Card from '@/components/ui/card/Card'
import PageContainer from '@/components/layout/PageContainer'
import TwoColumnGrid from '@/components/layout/TwoColumnGrid'
import { qaTabs } from '@/lib/constants/navigation'
import ProjectSelector from '@/components/ui/ProjectSelector'

export default function PerformancePage() {
  return (
    <PageContainer>
      <Tabs tabs={qaTabs} />

      <TwoColumnGrid>
        <Card title="Project">
          <ProjectSelector />
          {/* URL input will go here in Phase 6 */}
        </Card>

        <Card title="Latest Results">
          <p className="text-black/60">No tests have been run yet.</p>
          {/* Test results will go here in Phase 6 */}
        </Card>
      </TwoColumnGrid>
    </PageContainer>
  )
}
