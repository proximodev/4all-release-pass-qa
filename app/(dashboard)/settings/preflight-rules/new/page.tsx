'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import Input from '@/components/ui/input/Input'
import Select from '@/components/ui/select/Select'
import PageContainer from '@/components/layout/PageContainer'
import TabPanel from '@/components/layout/TabPanel'
import Tabs from '@/components/ui/tabs/Tabs'
import FormContainer from '@/components/layout/FormContainer'
import TwoColumnGrid from '@/components/layout/TwoColumnGrid'
import { settingsTabs } from '@/lib/constants/navigation'

interface Category {
  id: string
  name: string
}

const providerOptions = [
  { value: 'SE_RANKING', label: 'SE Ranking' },
  { value: 'LANGUAGETOOL', label: 'LanguageTool' },
  { value: 'LIGHTHOUSE', label: 'Lighthouse' },
  { value: 'LINKINATOR', label: 'Linkinator' },
  { value: 'ReleasePass', label: 'ReleasePass' },
  { value: 'INTERNAL', label: 'Internal' },
]

const severityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'BLOCKER', label: 'Blocker' },
]

export default function NewRulePage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/release-rule-categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const categoryOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.name,
  }))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      code: formData.get('code') as string,
      provider: formData.get('provider') as string,
      categoryId: formData.get('categoryId') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      severity: formData.get('severity') as string,
      impact: (formData.get('impact') as string) || null,
      fix: (formData.get('fix') as string) || null,
      docUrl: (formData.get('docUrl') as string) || null,
      sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
      isActive,
    }

    try {
      const res = await fetch('/api/release-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        if (Array.isArray(error.error)) {
          const errorMap: Record<string, string> = {}
          error.error.forEach((err: any) => {
            errorMap[err.path[0]] = err.message
          })
          setErrors(errorMap)
        } else {
          setErrors({ general: error.error || 'Failed to create rule' })
        }
        return
      }

      router.push('/settings/preflight-rules')
    } catch (error) {
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
            <Card title="Add Rule">
              <form onSubmit={handleSubmit} className="space-y-4">
                {errors.general && (
                  <div className="bg-red/10 border border-red text-red p-3 rounded">
                    {errors.general}
                  </div>
                )}

                <Input
                  label="Code"
                  name="code"
                  placeholder="e.g., document-title"
                  required
                  error={errors.code}
                />

                <Select
                  label="Provider"
                  name="provider"
                  options={providerOptions}
                  required
                  error={errors.provider}
                />

                <Select
                  label="Category"
                  name="categoryId"
                  options={categoryOptions}
                  required
                  error={errors.categoryId}
                />

                <Input
                  label="Name"
                  name="name"
                  placeholder="Rule name"
                  required
                  error={errors.name}
                />

                <div>
                  <label className="block text-sm font-medium mb-1">Description *</label>
                  <textarea
                    name="description"
                    placeholder="What this rule checks"
                    rows={2}
                    required
                    className="w-full px-4 py-2 border border-medium-gray rounded resize-none"
                  />
                  {errors.description && (
                    <p className="text-red text-sm mt-1">{errors.description}</p>
                  )}
                </div>

                <Select
                  label="Severity"
                  name="severity"
                  options={severityOptions}
                  required
                  error={errors.severity}
                />

                <div>
                  <label className="block text-sm font-medium mb-1">Impact</label>
                  <textarea
                    name="impact"
                    placeholder="What happens if this fails"
                    rows={2}
                    className="w-full px-4 py-2 border border-medium-gray rounded resize-none"
                  />
                  {errors.impact && (
                    <p className="text-red text-sm mt-1">{errors.impact}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Fix</label>
                  <textarea
                    name="fix"
                    placeholder="How to fix this issue"
                    rows={2}
                    className="w-full px-4 py-2 border border-medium-gray rounded resize-none"
                  />
                  {errors.fix && (
                    <p className="text-red text-sm mt-1">{errors.fix}</p>
                  )}
                </div>

                <Input
                  label="Documentation URL"
                  name="docUrl"
                  type="url"
                  placeholder="https://..."
                  error={errors.docUrl}
                />

                <Input
                  label="Sort Order"
                  name="sortOrder"
                  type="number"
                  defaultValue="0"
                  error={errors.sortOrder}
                />

                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>

                <div className="flex items-center space-x-4 pt-4 border-t border-medium-gray">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Rule'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push('/settings/preflight-rules')}
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
