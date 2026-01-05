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

interface Rule {
  id: string
  code: string
  provider: string
  categoryId: string
  name: string
  description: string
  severity: string
  impact: string | null
  fix: string | null
  docUrl: string | null
  sortOrder: number
  isActive: boolean
  category: {
    id: string
    name: string
  }
}

interface RuleEditPageProps {
  params: Promise<{ code: string }>
}

const severityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'BLOCKER', label: 'Blocker' },
]

export default function RuleEditPage({ params }: RuleEditPageProps) {
  const router = useRouter()
  const [ruleCode, setRuleCode] = useState<string | null>(null)
  const [rule, setRule] = useState<Rule | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    params.then(({ code }) => {
      setRuleCode(code)
      fetchRule(code)
      fetchCategories()
    })
  }, [params])

  const fetchRule = async (code: string) => {
    try {
      const res = await fetch(`/api/release-rules/${code}`)

      if (!res.ok) {
        setErrors({ general: 'Failed to load rule' })
        return
      }

      const data = await res.json()
      setRule(data)
      setIsActive(data.isActive)
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' })
    } finally {
      setLoading(false)
    }
  }

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
    if (!ruleCode) return

    setSaving(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
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
      const res = await fetch(`/api/release-rules/${ruleCode}`, {
        method: 'PATCH',
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
          setErrors({ general: error.error || 'Failed to update rule' })
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

  const handleDelete = async () => {
    if (!ruleCode) return

    setDeleting(true)

    try {
      const res = await fetch(`/api/release-rules/${ruleCode}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        setErrors({ general: error.error || 'Failed to delete rule' })
        setDeleting(false)
        setShowDeleteConfirm(false)
        return
      }

      router.push('/settings/preflight-rules')
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' })
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <Tabs tabs={settingsTabs} />
        <TabPanel>
          <div className="flex justify-center items-center py-12">
            <p>Loading rule...</p>
          </div>
        </TabPanel>
      </PageContainer>
    )
  }

  if (!rule) {
    return (
      <PageContainer>
        <Tabs tabs={settingsTabs} />
        <TabPanel>
          <Card title="Error">
            <div className="space-y-4">
              <p>{errors.general || 'Rule not found'}</p>
              <Button onClick={() => router.push('/settings/preflight-rules')}>
                Back to Rules
              </Button>
            </div>
          </Card>
        </TabPanel>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Tabs tabs={settingsTabs} />
      <TabPanel>
        <TwoColumnGrid>
          <FormContainer>
            <Card title={`Edit: ${rule.name}`}>
              <form onSubmit={handleSubmit} className="space-y-4">
                {errors.general && (
                  <div className="bg-red/10 border border-red text-red p-3 rounded">
                    {errors.general}
                  </div>
                )}

                {/* Read-only fields */}
                <div>
                  <label className="block text-sm font-medium mb-1">Code</label>
                  <div className="px-4 py-2 bg-gray-100 border border-medium-gray rounded font-mono text-sm">
                    {rule.code}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Code cannot be changed after creation.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Provider</label>
                  <div className="px-4 py-2 bg-gray-100 border border-medium-gray rounded">
                    {rule.provider}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Provider cannot be changed after creation.</p>
                </div>

                {/* Editable fields */}
                <Select
                  label="Category"
                  name="categoryId"
                  options={categoryOptions}
                  defaultValue={rule.categoryId}
                  required
                  error={errors.categoryId}
                />

                <Input
                  label="Name"
                  name="name"
                  placeholder="Rule name"
                  required
                  defaultValue={rule.name}
                  error={errors.name}
                />

                <div>
                  <label className="block text-sm font-medium mb-1">Description *</label>
                  <textarea
                    name="description"
                    placeholder="What this rule checks"
                    rows={2}
                    required
                    defaultValue={rule.description}
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
                  defaultValue={rule.severity}
                  required
                  error={errors.severity}
                />

                <div>
                  <label className="block text-sm font-medium mb-1">Impact</label>
                  <textarea
                    name="impact"
                    placeholder="What happens if this fails"
                    rows={2}
                    defaultValue={rule.impact || ''}
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
                    defaultValue={rule.fix || ''}
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
                  defaultValue={rule.docUrl || ''}
                  error={errors.docUrl}
                />

                <Input
                  label="Sort Order"
                  name="sortOrder"
                  type="number"
                  defaultValue={rule.sortOrder.toString()}
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

                <div className="flex items-center justify-between pt-4 border-t border-medium-gray">
                  <div className="flex items-center space-x-4">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => router.push('/settings/preflight-rules')}
                    >
                      Cancel
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleting}
                  >
                    Delete Rule
                  </Button>
                </div>
              </form>
            </Card>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <h3>Confirm Deletion</h3>
                  <p className="mb-4">
                    Are you sure you want to delete <strong>{rule.name}</strong>?
                    This action cannot be undone.
                  </p>
                  <div className="flex items-center justify-end space-x-4">
                    <Button
                      variant="secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Delete Rule'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </FormContainer>
        </TwoColumnGrid>
      </TabPanel>
    </PageContainer>
  )
}
