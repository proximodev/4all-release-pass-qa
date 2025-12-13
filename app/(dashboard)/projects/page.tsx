import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import PageContainer from '@/components/layout/PageContainer'
import PageHeader from '@/components/layout/PageHeader'
import Link from 'next/link'

export default function ProjectsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="All Projects"
        action={
          <Link href="/dashboard/projects/new">
            <Button>Add New Project</Button>
          </Link>
        }
      />

      <Card>
        <p className="text-center text-black/60 py-8">
          No projects yet. Create your first project to get started.
        </p>
        {/* Project list will go here in Phase 3 */}
      </Card>
    </PageContainer>
  )
}
