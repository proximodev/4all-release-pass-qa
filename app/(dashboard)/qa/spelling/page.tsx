import Tabs from '@/components/ui/tabs/Tabs'
import Card from '@/components/ui/card/Card'
import PageContainer from '@/components/layout/PageContainer'
import TwoColumnGrid from '@/components/layout/TwoColumnGrid'
import { qaTabs } from '@/lib/constants/navigation'

export default function SpellcheckPage() {
  return (
    <PageContainer>
      <Tabs tabs={qaTabs} />

      <TwoColumnGrid>
        <Card title="Project">
          <p className="text-black/60">Select or create a project to run Spellcheck tests.</p>
          {/* Project selector and URL input will go here in Phase 3 & 6 */}
        </Card>

        <Card title="Latest Results">
          <p className="text-black/60">No spellcheck tests have been run yet.</p>
          {/* Spellcheck results will go here in Phase 6 */}
        </Card>
      </TwoColumnGrid>
    </PageContainer>
  )
}
