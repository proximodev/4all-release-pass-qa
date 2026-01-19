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

interface Company {
  id: string
  name: string
  isSystem: boolean
}

const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
]

export default function NewUserPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [companies, setCompanies] = useState<Company[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies/dropdown')
      if (res.ok) {
        const data = await res.json()
        setCompanies(data)
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error)
    } finally {
      setLoadingCompanies(false)
    }
  }

  const companyOptions = companies.map(c => ({
    value: c.id,
    label: c.name,
  }))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as string,
      companyId: formData.get('companyId') as string,
    }

    try {
      const res = await fetch('/api/users', {
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
          setErrors({ general: error.error || 'Failed to create user' })
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

  return (
    <PageContainer>
      <Tabs tabs={settingsTabs} />
      <TabPanel>
        <TwoColumnGrid>
          <FormContainer>
            <Card title="Add User">
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
                  error={errors.firstName}
                />

                <Input
                  label="Last Name"
                  name="lastName"
                  placeholder="Doe"
                  required
                  error={errors.lastName}
                />

                <Input
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  required
                  error={errors.email}
                />

                <Select
                  label="Role"
                  name="role"
                  options={roleOptions}
                  defaultValue="ADMIN"
                  error={errors.role}
                />

                <Select
                  label="Company"
                  name="companyId"
                  options={companyOptions}
                  defaultValue={companies[0]?.id || ''}
                  disabled={loadingCompanies}
                  error={errors.companyId}
                />

                <div className="flex items-center space-x-4 pt-4 border-t border-medium-gray">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creating...' : 'Create User'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push('/settings/users')}
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
