import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Link from 'next/link'

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-black">All Projects</h2>
        <Link href="/dashboard/projects/new">
          <Button>Add New Project</Button>
        </Link>
      </div>

      <Card>
        <p className="text-center text-black/60 py-8">
          No projects yet. Create your first project to get started.
        </p>
        {/* Project list will go here in Phase 3 */}
      </Card>
    </div>
  )
}
