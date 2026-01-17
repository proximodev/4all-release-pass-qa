'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import Input from '@/components/ui/input/Input'
import Textarea from '@/components/ui/textarea/Textarea'
import FormContainer from '@/components/layout/FormContainer'
import Tabs from "@/components/ui/tabs/Tabs"
import { projectTabs } from "@/lib/constants/navigation"
import TwoColumnGrid from "@/components/layout/TwoColumnGrid"
import PageContainer from "@/components/layout/PageContainer"
import OptionalRulesSection from "@/components/projects/OptionalRulesSection"

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [enabledRules, setEnabledRules] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      siteUrl: formData.get('siteUrl') as string,
      sitemapUrl: formData.get('sitemapUrl') as string,
      notes: formData.get('notes') as string,
      enabledOptionalRules: enabledRules,
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        if (Array.isArray(error.error)) {
          // Zod validation errors
          const errorMap: Record<string, string> = {}
          error.error.forEach((err: any) => {
            errorMap[err.path[0]] = err.message
          })
          setErrors(errorMap)
        } else {
          setErrors({ general: error.error || 'Failed to create project' })
        }
        return
      }

      // Success - redirect to projects list
      router.push('/projects')
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageContainer>
      <Tabs tabs={projectTabs} />
      <TwoColumnGrid>
        <FormContainer>
          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.general && (
                <div className="bg-red/10 border border-red text-red p-3 rounded">
                  {errors.general}
                </div>
              )}

              <h3>Project Information</h3>

              <Input
                label="Project Name"
                name="name"
                placeholder="e.g., Company Website"
                required
                error={errors.name}
              />

              <Input
                label="Site URL"
                name="siteUrl"
                type="url"
                placeholder="https://example.com"
                required
                error={errors.siteUrl}
              />

              <Input
                label="Sitemap URL"
                name="sitemapUrl"
                type="url"
                placeholder="https://example.com/sitemap.xml"
                required
                error={errors.sitemapUrl}
              />

              <Textarea
                label="Notes"
                name="notes"
                placeholder="Optional notes about this project"
                rows={4}
              />

              <OptionalRulesSection onEnabledRulesChange={setEnabledRules} />

              <div className="flex items-center space-x-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Project'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push('/projects')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </FormContainer>
      </TwoColumnGrid>
    </PageContainer>
  )
}
