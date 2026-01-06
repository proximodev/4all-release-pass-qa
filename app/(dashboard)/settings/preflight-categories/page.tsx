'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import PageContainer from '@/components/layout/PageContainer'
import TabPanel from '@/components/layout/TabPanel'
import Tabs from '@/components/ui/tabs/Tabs'
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

export default function PreflightCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

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
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = categories.filter(category => {
    const searchTerm = filter.toLowerCase()
    return category.name.toLowerCase().includes(searchTerm)
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
          <Link href="/settings/preflight-categories/new">
            <Button>Add Category</Button>
          </Link>
        </div>

        <Card>
          {loading ? (
            <p>Loading categories...</p>
          ) : filteredCategories.length === 0 ? (
            <p>
              {filter ? 'No categories match your filter.' : 'No categories yet. Add your first category to get started.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-medium-gray text-left">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Rules</th>
                    <th className="pb-3">Sort Order</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => (
                    <tr key={category.id} className="border-b border-medium-gray/50">
                      <td className="py-4">{category.name}</td>
                      <td className="py-4">{category.description || '—'}</td>
                      <td className="py-4">{category._count.rules}</td>
                      <td className="py-4">{category.sortOrder}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-sm ${category.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <Link href={`/settings/preflight-categories/${category.id}/edit`}>
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
