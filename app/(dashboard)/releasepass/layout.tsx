import { ReactNode, Suspense } from 'react'
import PageContainer from '@/components/layout/PageContainer'
import Tabs from '@/components/ui/tabs/Tabs'
import ReleaseStatusBadge from '@/components/releasepass/ReleaseStatusBadge'
import { releasePassTabs } from '@/lib/constants/navigation'

interface ReleasePassLayoutProps {
  children: ReactNode
}

export default function ReleasePassLayout({ children }: ReleasePassLayoutProps) {
  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <Tabs tabs={releasePassTabs} />
        <Suspense fallback={null}>
          <ReleaseStatusBadge />
        </Suspense>
      </div>
      {children}
    </PageContainer>
  )
}
