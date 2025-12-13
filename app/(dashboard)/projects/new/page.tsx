import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import Input from '@/components/ui/input/Input'
import Textarea from '@/components/ui/textarea/Textarea'
import FormContainer from '@/components/layout/FormContainer'

export default function NewProjectPage() {
  return (
    <FormContainer>
      <Card title="Add New Project">
        <form className="space-y-4">
          <Input
            label="Project Name"
            name="name"
            placeholder="e.g., 4All Digital Marketing Site"
            required
          />

          <Input
            label="Site URL"
            name="siteUrl"
            type="url"
            placeholder="https://example.com"
            required
          />

          <Input
            label="Site Map URL"
            name="sitemapUrl"
            type="url"
            placeholder="https://example.com/sitemap.xml"
          />

          <Textarea
            label="Notes"
            name="notes"
            placeholder="Optional notes about this project"
            rows={4}
          />

          <div className="flex items-center space-x-4">
            <Button type="submit">Save Project</Button>
            <Button type="button" variant="secondary">Cancel</Button>
          </div>
        </form>
      </Card>
    </FormContainer>
  )
}
