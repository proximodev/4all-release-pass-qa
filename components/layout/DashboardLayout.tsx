import { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'
import Breadcrumb from './Breadcrumb'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Breadcrumb />
      <main className="flex-1 container mx-auto px-6 py-8">
        {children}
      </main>
      <Footer />
    </div>
  )
}
