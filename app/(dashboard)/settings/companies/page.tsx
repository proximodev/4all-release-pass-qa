'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import PageContainer from '@/components/layout/PageContainer'
import TabPanel from '@/components/layout/TabPanel'
import Tabs from '@/components/ui/tabs/Tabs'
import { settingsTabs } from '@/lib/constants/navigation'

interface Company {
  id: string
  name: string
  url: string | null
  createdAt: string
  _count: {
    users: number
    projects: number
  }
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies')
      if (res.ok) {
        const data = await res.json()
        setCompanies(data)
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCompanies = companies.filter(company => {
    const searchTerm = filter.toLowerCase()
    return company.name.toLowerCase().includes(searchTerm)
  })

  return (
    <PageContainer>
      <Tabs tabs={settingsTabs} />
      <TabPanel>
        <div className="flex items-center justify-between mb-8">
          <input
            type="text"
            placeholder="Filter by name"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-medium-gray rounded w-full max-w-md"
          />
          <Link href="/settings/companies/new">
            <Button>Add Company</Button>
          </Link>
        </div>

        <Card>
          {loading ? (
            <p>Loading companies...</p>
          ) : filteredCompanies.length === 0 ? (
            <p>
              {filter ? 'No companies match your filter.' : 'No companies yet. Add your first company to get started.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-medium-gray text-left">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">URL</th>
                    <th className="pb-3 font-medium">Created</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((company) => (
                    <tr key={company.id} className="border-b border-medium-gray/50">
                      <td className="py-4">{company.name}</td>
                      <td className="py-4">
                        {company.url ? (
                          <a
                            href={company.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {company.url}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-4">
                        {new Date(company.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right">
                        <Link href={`/settings/companies/${company.id}/edit`}>
                          <Button variant="secondary">Edit</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </TabPanel>
    </PageContainer>
  )
}
