import { redirect } from 'next/navigation'

export default function DashboardPage() {
  // For now, redirect to QA Tools - Site Audit
  // This page can be built out later as a dashboard home
  redirect('/dashboard/qa/audit')
}
