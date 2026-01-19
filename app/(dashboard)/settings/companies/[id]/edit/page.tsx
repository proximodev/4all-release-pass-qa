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

interface Company {
  id: string
  name: string
  url: string | null
  createdAt: string
  updatedAt: string
  _count: {
    users: number
    projects: number
  }
}

interface CompanyEditPageProps {
  params: Promise<{ id: string }>
}

export default function CompanyEditPage({ params }: CompanyEditPageProps) {
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    params.then(({ id }) => {
      setCompanyId(id)
      fetchCompany(id)
    })
  }, [params])

  const fetchCompany = async (id: string) => {
    try {
      const res = await fetch(`/api/companies/${id}`)

      if (!res.ok) {
        setErrors({ general: 'Failed to load company' })
        return
      }

      const data = await res.json()
      setCompany(data)
    } catch {
      setErrors({ general: 'An unexpected error occurred' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!companyId) return

    setSaving(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      url: formData.get('url') as string,
    }

    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
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
          setErrors({ general: error.error || 'Failed to update company' })
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

  const handleDelete = async () => {
    if (!companyId) return

    setDeleting(true)

    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        setErrors({ general: error.error || 'Failed to delete company' })
        setDeleting(false)
        setShowDeleteConfirm(false)
        return
      }

      router.push('/settings/companies')
    } catch {
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
            <p>Loading company...</p>
          </div>
        </TabPanel>
      </PageContainer>
    )
  }

  if (!company) {
    return (
      <PageContainer>
        <Tabs tabs={settingsTabs} />
        <TabPanel>
          <Card title="Error">
            <div className="space-y-4">
              <p>{errors.general || 'Company not found'}</p>
              <Button onClick={() => router.push('/settings/companies')}>
                Back to Companies
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
            <Card title={`Edit: ${company.name}`}>
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
                  defaultValue={company.name}
                  error={errors.name}
                />

                <Input
                  label="Website URL"
                  name="url"
                  type="url"
                  placeholder="https://example.com"
                  defaultValue={company.url || ''}
                  error={errors.url}
                />

                <div className="flex items-center justify-between pt-4 border-t border-medium-gray">
                  <div className="flex items-center space-x-4">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => router.push('/settings/companies')}
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
                    Delete Company
                  </Button>
                </div>
              </form>
            </Card>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <h3 className="text-lg font-medium mb-2">Confirm Deletion</h3>
                  <p className="mb-4">
                    Are you sure you want to delete <strong>{company.name}</strong>?
                  </p>
                  {(company._count.users > 0 || company._count.projects > 0) && (
                    <p className="mb-4 text-amber-700 bg-amber-50 p-3 rounded">
                      This will reassign {company._count.users} user(s) and {company._count.projects} project(s) to the &quot;Unassigned&quot; company.
                    </p>
                  )}
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
                      {deleting ? 'Deleting...' : 'Delete Company'}
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
