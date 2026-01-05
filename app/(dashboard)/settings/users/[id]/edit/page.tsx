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

interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  createdAt: string
  updatedAt: string
}

interface UserEditPageProps {
  params: Promise<{ id: string }>
}

const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
]

export default function UserEditPage({ params }: UserEditPageProps) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    params.then(({ id }) => {
      setUserId(id)
      fetchUser(id)
    })
  }, [params])

  const fetchUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`)

      if (!res.ok) {
        setErrors({ general: 'Failed to load user' })
        return
      }

      const data = await res.json()
      setUser(data)
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!userId) return

    setSaving(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as string,
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
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
          setErrors({ general: error.error || 'Failed to update user' })
        }
        return
      }

      router.push('/settings/users')
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!userId) return

    setDeleting(true)

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        setErrors({ general: error.error || 'Failed to delete user' })
        setDeleting(false)
        setShowDeleteConfirm(false)
        return
      }

      router.push('/settings/users')
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
            <p>Loading user...</p>
          </div>
        </TabPanel>
      </PageContainer>
    )
  }

  if (!user) {
    return (
      <PageContainer>
        <Tabs tabs={settingsTabs} />
        <TabPanel>
          <Card title="Error">
            <div className="space-y-4">
              <p>{errors.general || 'User not found'}</p>
              <Button onClick={() => router.push('/settings/users')}>
                Back to Users
              </Button>
            </div>
          </Card>
        </TabPanel>
      </PageContainer>
    )
  }

  const userName = user.firstName || user.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : user.email

  return (
    <PageContainer>
      <Tabs tabs={settingsTabs} />
      <TabPanel>
        <TwoColumnGrid>
          <FormContainer>
            <Card title={`Edit: ${userName}`}>
              <form onSubmit={handleSubmit} className="space-y-4">
                {errors.general && (
                  <div className="bg-red/10 border border-red text-red p-3 rounded">
                    {errors.general}
                  </div>
                )}

                <Input
                  label="First Name"
                  name="firstName"
                  placeholder="John"
                  required
                  defaultValue={user.firstName || ''}
                  error={errors.firstName}
                />

                <Input
                  label="Last Name"
                  name="lastName"
                  placeholder="Doe"
                  required
                  defaultValue={user.lastName || ''}
                  error={errors.lastName}
                />

                <Input
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  required
                  defaultValue={user.email}
                  error={errors.email}
                />

                <Select
                  label="Role"
                  name="role"
                  options={roleOptions}
                  defaultValue={user.role}
                  error={errors.role}
                />

                <div className="flex items-center justify-between pt-4 border-t border-medium-gray">
                  <div className="flex items-center space-x-4">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => router.push('/settings/users')}
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
                    Delete User
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
                    Are you sure you want to delete <strong>{userName}</strong>?
                    This action cannot be undone and will also remove their authentication account.
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
                      {deleting ? 'Deleting...' : 'Delete User'}
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
