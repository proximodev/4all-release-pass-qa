'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import PageContainer from '@/components/layout/PageContainer'
import TabPanel from '@/components/layout/TabPanel'
import Tabs from '@/components/ui/tabs/Tabs'
import { settingsTabs } from '@/lib/constants/navigation'

interface Rule {
  id: string
  code: string
  provider: string
  name: string
  severity: string
  isActive: boolean
  isOptional: boolean
  category: {
    id: string
    name: string
  }
}

export default function PreflightRulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/release-rules')
      if (res.ok) {
        const data = await res.json()
        setRules(data)
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRules = rules.filter(rule => {
    const searchTerm = filter.toLowerCase()
    return (
      rule.name.toLowerCase().includes(searchTerm) ||
      rule.code.toLowerCase().includes(searchTerm)
    )
  })

  return (
    <PageContainer>
      <Tabs tabs={settingsTabs} />
      <TabPanel>
        <div className="flex items-center justify-between mb-8">
          <input
            type="text"
            placeholder="Filter by name or code"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-medium-gray rounded w-full max-w-md"
          />
          <Link href="/settings/preflight-rules/new">
            <Button>Add Rule</Button>
          </Link>
        </div>

        <Card>
          {loading ? (
            <p>Loading rules...</p>
          ) : filteredRules.length === 0 ? (
            <p>
              {filter ? 'No rules match your filter.' : 'No rules yet. Add your first rule to get started.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                <tr className="border-b border-medium-gray text-left">
                  <th className="pb-3 pr-8">Code</th>
                  <th className="pb-3 pr-8">Name</th>
                  <th className="pb-3 pr-8">Provider</th>
                  <th className="pb-3 pr-8">Category</th>
                  <th className="pb-3 pr-8">Severity</th>
                  <th className="pb-3 pr-8">Status</th>
                  <th className="pb-3 pr-8">Optional</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
                </thead>
                <tbody>
                {filteredRules.map((rule) => (
                      <tr key={rule.id} className="border-b border-medium-gray/50">
                        <td className="py-4 font-mono text-sm">{rule.code}</td>
                        <td className="py-4">{rule.name}</td>
                        <td className="py-4">{rule.provider}</td>
                        <td className="py-4">{rule.category.name}</td>
                        <td className="py-4">{rule.severity}</td>
                        <td className="py-4">
                        <span
                            className={`px-2 py-1 rounded text-sm ${rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </span>
                        </td>
                        <td className="py-4">
                          {rule.isOptional && (
                              <span className="px-2 py-1 rounded text-sm bg-blue-100 text-blue-800">
                            Optional
                          </span>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <Link href={`/settings/preflight-rules/${rule.code}/edit`}>
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
