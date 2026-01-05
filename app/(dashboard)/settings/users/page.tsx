'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import PageContainer from '@/components/layout/PageContainer'
import TabPanel from '@/components/layout/TabPanel'
import Tabs from '@/components/ui/tabs/Tabs'
import { settingsTabs } from '@/lib/constants/navigation'

interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  createdAt: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()
    const searchTerm = filter.toLowerCase()
    return fullName.includes(searchTerm) || user.email.toLowerCase().includes(searchTerm)
  })

  const formatName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }
    return '—'
  }

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
          <Link href="/settings/users/new">
            <Button>Add User</Button>
          </Link>
        </div>

        <Card>
          {loading ? (
            <p>Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <p>
              {filter ? 'No users match your filter.' : 'No users yet. Add your first user to get started.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-medium-gray text-left">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Created</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-medium-gray/50">
                      <td className="py-4">{formatName(user)}</td>
                      <td className="py-4">{user.email}</td>
                      <td className="py-4">{user.role}</td>
                      <td className="py-4">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right">
                        <Link href={`/settings/users/${user.id}/edit`}>
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
