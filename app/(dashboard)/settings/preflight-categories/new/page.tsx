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

export default function NewCategoryPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isActive, setIsActive] = useState(true)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
      isActive,
    }

    try {
      const res = await fetch('/api/release-rule-categories', {
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
          setErrors({ general: error.error || 'Failed to create category' })
        }
        return
      }

      router.push('/settings/preflight-categories')
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
            <Card title="Add Category">
              <form onSubmit={handleSubmit} className="space-y-4">
                {errors.general && (
                  <div className="bg-red/10 border border-red text-red p-3 rounded">
                    {errors.general}
                  </div>
                )}

                <Input
                  label="Name"
                  name="name"
                  placeholder="Category name"
                  required
                  error={errors.name}
                />

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    name="description"
                    placeholder="Optional description"
                    rows={3}
                    className="w-full px-4 py-2 border border-medium-gray rounded resize-none"
                  />
                  {errors.description && (
                    <p className="text-red text-sm mt-1">{errors.description}</p>
                  )}
                </div>

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
                    {saving ? 'Creating...' : 'Create Category'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push('/settings/preflight-categories')}
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
