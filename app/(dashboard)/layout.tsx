import { ReactNode } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UserSyncWrapper from '@/components/auth/UserSyncWrapper'

interface DashboardGroupLayoutProps {
  children: ReactNode
}

export default async function DashboardGroupLayout({ children }: DashboardGroupLayoutProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify user is authenticated
  if (!user) {
    redirect('/login')
  }

  return (
    <UserSyncWrapper>
      <DashboardLayout>{children}</DashboardLayout>
    </UserSyncWrapper>
  )
}
