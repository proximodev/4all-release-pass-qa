import { redirect } from 'next/navigation'

export default function DashboardPage() {
  // Redirect to ReleasePass
  // This page can be built out later as a dashboard home
  redirect('/releasepass')
}
