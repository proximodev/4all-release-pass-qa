'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import Input from '@/components/ui/input/Input'
import PageContainer from '@/components/layout/PageContainer'
import TabPanel from '@/components/layout/TabPanel'
import Tabs from '@/components/ui/tabs/Tabs'
import FormContainer from '@/components/layout/FormContainer'
import TwoColumnGrid from '@/components/layout/TwoColumnGrid'
import { settingsTabs } from '@/lib/constants/navigation'

export default function NewCompanyPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      url: formData.get('url') as string,
    }

    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        if (Array.isArray(error.error)) {
          const errorMap: Record<string, string> = {}
          error.error.forEach((err: { path: string[]; message: string }) => {
            errorMap[err.path[0]] = err.message
          })
          setErrors(errorMap)
        } else {
          setErrors({ general: error.error || 'Failed to create company' })
        }
        return
      }

      router.push('/settings/companies')
    } catch {
      setErrors({ general: 'An unexpected error occurred' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageContainer>
      <Tabs tabs={settingsTabs} />
      <TabPanel>
        <TwoColumnGrid>
          <FormContainer>
            <Card title="Add Company">
              <form onSubmit={handleSubmit} className="space-y-4">
                {errors.general && (
                  <div className="bg-red/10 border border-red text-red p-3 rounded">
                    {errors.general}
                  </div>
                )}

                <Input
                  label="Company Name"
                  name="name"
                  placeholder="Acme Corporation"
                  required
                  error={errors.name}
                />

                <Input
                  label="Website URL"
                  name="url"
                  type="url"
                  placeholder="https://example.com"
                  error={errors.url}
                />

                <div className="flex items-center space-x-4 pt-4 border-t border-medium-gray">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Company'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push('/settings/companies')}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </FormContainer>
        </TwoColumnGrid>
      </TabPanel>
    </PageContainer>
  )
}
