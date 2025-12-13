import Tabs from '@/components/ui/Tabs'
import Card from '@/components/ui/Card'

const qaTabs = [
  { label: 'Site Audit', href: '/dashboard/qa/audit' },
  { label: 'Performance', href: '/dashboard/qa/performance' },
  { label: 'Browser Test', href: '/dashboard/qa/browser' },
  { label: 'Spellcheck', href: '/dashboard/qa/spelling' },
]

export default function BrowserTestPage() {
  return (
    <div className="space-y-6">
      <Tabs tabs={qaTabs} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Project">
          <p className="text-sm text-black/60">Select or create a project to run Browser tests.</p>
          {/* Project selector and URL input will go here in Phase 3 & 6 */}
        </Card>

        <Card title="Latest Results">
          <p className="text-sm text-black/60">No screenshots have been captured yet.</p>
          {/* Screenshot results will go here in Phase 6 */}
        </Card>
      </div>
    </div>
  )
}
