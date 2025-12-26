import { ReactNode } from 'react'
import PageContainer from '@/components/layout/PageContainer'
import Tabs from '@/components/ui/tabs/Tabs'
import { releasePassTabs } from '@/lib/constants/navigation'

interface ReleasePassLayoutProps {
  children: ReactNode
}

export default function ReleasePassLayout({ children }: ReleasePassLayoutProps) {
  return (
    <PageContainer>
      <Tabs tabs={releasePassTabs} />
      {children}
    </PageContainer>
  )
}
