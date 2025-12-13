import { ReactNode } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface DashboardGroupLayoutProps {
  children: ReactNode
}

export default async function DashboardGroupLayout({ children }: DashboardGroupLayoutProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <DashboardLayout>{children}</DashboardLayout>
}
