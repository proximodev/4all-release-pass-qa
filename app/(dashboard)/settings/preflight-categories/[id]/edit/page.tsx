'use client'

import { useState, useEffect } from 'react'
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

interface Category {
  id: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  _count: {
    rules: number
  }
}

interface CategoryEditPageProps {
  params: Promise<{ id: string }>
}

export default function CategoryEditPage({ params }: CategoryEditPageProps) {
  const router = useRouter()
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    params.then(({ id }) => {
      setCategoryId(id)
      fetchCategory(id)
    })
  }, [params])

  const fetchCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/release-rule-categories/${id}`)

      if (!res.ok) {
        setErrors({ general: 'Failed to load category' })
        return
      }

      const data = await res.json()
      setCategory(data)
      setIsActive(data.isActive)
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!categoryId) return

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
      const res = await fetch(`/api/release-rule-categories/${categoryId}`, {
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
          setErrors({ general: error.error || 'Failed to update category' })
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

  const handleDelete = async () => {
    if (!categoryId) return

    setDeleting(true)

    try {
      const res = await fetch(`/api/release-rule-categories/${categoryId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        setErrors({ general: error.error || 'Failed to delete category' })
        setDeleting(false)
        setShowDeleteConfirm(false)
        return
      }

      router.push('/settings/preflight-categories')
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
            <p>Loading category...</p>
          </div>
        </TabPanel>
      </PageContainer>
    )
  }

  if (!category) {
    return (
      <PageContainer>
        <Tabs tabs={settingsTabs} />
        <TabPanel>
          <Card title="Error">
            <div className="space-y-4">
              <p>{errors.general || 'Category not found'}</p>
              <Button onClick={() => router.push('/settings/preflight-categories')}>
                Back to Categories
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
            <Card title={`Edit: ${category.name}`}>
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
                  defaultValue={category.name}
                  error={errors.name}
                />

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    name="description"
                    placeholder="Optional description"
                    rows={3}
                    defaultValue={category.description || ''}
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
                  defaultValue={category.sortOrder.toString()}
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
                      onClick={() => router.push('/settings/preflight-categories')}
                    >
                      Cancel
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleting || category._count.rules > 0}
                    title={category._count.rules > 0 ? `Cannot delete: ${category._count.rules} rule(s) linked` : undefined}
                  >
                    Delete Category
                  </Button>
                </div>

                {category._count.rules > 0 && (
                  <p className="text-sm text-gray-500">
                    This category has {category._count.rules} rule(s) and cannot be deleted.
                  </p>
                )}
              </form>
            </Card>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <h3>Confirm Deletion</h3>
                  <p className="mb-4">
                    Are you sure you want to delete <strong>{category.name}</strong>?
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
                      {deleting ? 'Deleting...' : 'Delete Category'}
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
