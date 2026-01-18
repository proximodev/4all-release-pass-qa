'use client'

import { useState, useEffect } from 'react'
import PageContainer from '@/components/layout/PageContainer'
import TabPanel from '@/components/layout/TabPanel'

interface Rule {
  code: string
  name: string
  description: string
  severity: string
  isOptional: boolean
}

interface Category {
  id: string
  name: string
  description: string | null
  rules: Rule[]
}

export default function AboutReleasePassPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/public/release-rules')
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = selectedCategory === 'all'
    ? categories
    : categories.filter(cat => cat.id === selectedCategory)

  return (
      <PageContainer>
        <h2>Overview</h2>

        <div className="mb-6">
        <p>ReleasePass delivers an automated pre- and post-deployment QA layer purpose-built for modern websites.
          It combines baseline preflight, performance, spelling/grammar and visual QA into single automated workflow.
          The result is a clear pass/fail report and prioritized fixes you can trust.</p>

          <p>This page provides an overview of the system features and roadmap for upcoming functionalities.</p>
        </div>

        <TabPanel className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="mb-0">Preflight Checks</h2>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-medium-gray rounded"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <p>Preflight checks include core SEO and health preflight checks alongside unique agency-focussed rules such
              as scanning for placeholder text and assuring external links open in new tabs. Current ruleset below:</p>
          </div>

          {loading ? (
              <p>Loading rules...</p>
          ) : filteredCategories.length === 0 ? (
              <p>No preflight rules configured.</p>
          ) : (
              <div className="space-y-8">
                {filteredCategories.map((category) => (
                    <div key={category.id}>
                      <h3 className="text-xl font-semibold mb-4">{category.name}</h3>
                      <ul className="space-y-3">
                        {category.rules.map((rule) => (
                            <li key={rule.code}>
                              <strong>{rule.name}</strong> - {rule.description}
                              <br/>
                              <span className="text-gray-600">
                        Scoring severity: {rule.severity}
                                {rule.isOptional && (
                                    <span className="ml-2 px-2 py-0.5 rounded text-sm bg-blue-100 text-blue-800">
                            Optional
                          </span>
                                )}
                      </span>
                            </li>
                        ))}
                      </ul>
                    </div>
                ))}
              </div>
          )}
        </TabPanel>

        <TabPanel className="mb-6">
          <h2>Performance</h2>

          <div className="mb-4">
          </div>
        </TabPanel>

        <TabPanel className="mb-6">
          <h2>Spelling/Grammar</h2>

          <div className="mb-4">
          </div>
        </TabPanel>

        <TabPanel className="mb-6">
          <h2>Browser Screenshots</h2>

          <div className="mb-4">
          </div>
        </TabPanel>

      </PageContainer>
  )
}
