'use client'

import { useState, useEffect, useCallback } from 'react'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import PageContainer from '@/components/layout/PageContainer'
import TabPanel from '@/components/layout/TabPanel'
import Tabs from '@/components/ui/tabs/Tabs'
import Modal from '@/components/ui/modal/Modal'
import { settingsTabs } from '@/lib/constants/navigation'

interface DictionaryWord {
  id: string
  word: string
  displayWord: string
  status: 'REVIEW' | 'WHITELISTED'
  source: 'MANUAL' | 'RESULT' | 'SEED'
  createdAt: string
  createdBy: { email: string } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function DictionaryPage() {
  const [words, setWords] = useState<DictionaryWord[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'REVIEW' | 'WHITELISTED'>('')

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingWord, setEditingWord] = useState<DictionaryWord | null>(null)

  // Form states
  const [addWordsText, setAddWordsText] = useState('')
  const [addStatus, setAddStatus] = useState<'REVIEW' | 'WHITELISTED'>('WHITELISTED')
  const [editWordText, setEditWordText] = useState('')
  const [editStatus, setEditStatus] = useState<'REVIEW' | 'WHITELISTED'>('WHITELISTED')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchWords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', '50')
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/dictionary?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWords(data.words)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch dictionary:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, search, statusFilter])

  useEffect(() => {
    fetchWords()
  }, [fetchWords])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(p => ({ ...p, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleAddWords = async () => {
    setFormError('')
    setFormSuccess('')
    setSubmitting(true)

    const wordsArray = addWordsText
      .split(/[\n\r]+/)
      .map(w => w.trim())
      .filter(w => w.length > 0)

    if (wordsArray.length === 0) {
      setFormError('Please enter at least one word')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: wordsArray, status: addStatus }),
      })

      const data = await res.json()

      if (!res.ok) {
        setFormError(data.error || 'Failed to add words')
        return
      }

      // Show success message
      let message = `Added ${data.added} word(s).`
      if (data.skipped > 0) {
        message += ` ${data.skipped} already existed (skipped).`
      }
      if (data.errors?.length > 0) {
        message += ` ${data.errors.length} invalid: ${data.errors.slice(0, 3).join(', ')}${data.errors.length > 3 ? '...' : ''}`
      }
      setFormSuccess(message)
      setAddWordsText('')
      fetchWords()

      // Close modal after short delay if successful
      if (data.added > 0) {
        setTimeout(() => {
          setShowAddModal(false)
          setFormSuccess('')
        }, 2000)
      }
    } catch (error) {
      setFormError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditWord = async () => {
    if (!editingWord) return
    setFormError('')
    setSubmitting(true)

    try {
      const res = await fetch(`/api/dictionary/${editingWord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: editWordText, status: editStatus }),
      })

      const data = await res.json()

      if (!res.ok) {
        setFormError(data.error || 'Failed to update word')
        return
      }

      setShowEditModal(false)
      setEditingWord(null)
      fetchWords()
    } catch (error) {
      setFormError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteWord = async () => {
    if (!editingWord) return
    if (!confirm(`Delete "${editingWord.displayWord}" from the dictionary?`)) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/dictionary/${editingWord.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || 'Failed to delete word')
        return
      }

      setShowEditModal(false)
      setEditingWord(null)
      fetchWords()
    } catch (error) {
      setFormError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const openEditModal = (word: DictionaryWord) => {
    setEditingWord(word)
    setEditWordText(word.displayWord)
    setEditStatus(word.status)
    setFormError('')
    setShowEditModal(true)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const day = date.getDate()
    const year = date.getFullYear()
    const hour = date.getHours()
    const minute = date.getMinutes().toString().padStart(2, '0')
    const hour12 = hour % 12 || 12
    const ampm = hour >= 12 ? 'pm' : 'am'
    return `${month} ${day}, ${year} ${hour12}:${minute}${ampm}`
  }

  const formatSource = (source: 'MANUAL' | 'RESULT' | 'SEED') => {
    switch (source) {
      case 'MANUAL': return 'Manual'
      case 'RESULT': return 'Spelling Ignore'
      case 'SEED': return 'Seed'
    }
  }

  return (
    <PageContainer>
      <Tabs tabs={settingsTabs} />
      <TabPanel>
        {/* Header with filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <input
              type="text"
              placeholder="Search words..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border border-medium-gray rounded w-full max-w-md"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as '' | 'REVIEW' | 'WHITELISTED')
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="px-4 py-2 border border-medium-gray rounded"
            >
              <option value="">All Status</option>
              <option value="WHITELISTED">Whitelisted</option>
              <option value="REVIEW">Review</option>
            </select>
          </div>
          <div className="flex gap-3 min-w-120px">
            <Button onClick={() => {
              setShowAddModal(true)
              setAddWordsText('')
              setAddStatus('WHITELISTED')
              setFormError('')
              setFormSuccess('')
            }}>
              Add Words
            </Button>
          </div>
        </div>

        {/* Word count */}
        <div className="text-sm text-gray-600 mb-4">
          {pagination.total === 0 ? 'No words' :
            pagination.total <= pagination.limit
              ? `${pagination.total} word${pagination.total !== 1 ? 's' : ''}`
              : `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} words`
          }
        </div>

        <Card>
          {loading ? (
            <p>Loading dictionary...</p>
          ) : words.length === 0 ? (
            <p>
              {search || statusFilter
                ? 'No words match your filters.'
                : 'Dictionary is empty. Add words to whitelist them from spelling checks.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-medium-gray text-left">
                    <th className="pb-3 w-1/6" >Word</th>
                    <th className="pb-3 w-1/6">Source</th>
                    <th className="pb-3 w-1/6">Added By</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Date Added</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {words.map((word) => (
                    <tr key={word.id} className="border-b border-medium-gray/50">
                      <td className="py-3 font-medium">{word.displayWord}</td>
                      <td className="py-3 text-gray-600">{formatSource(word.source)}</td>
                      <td className="py-3 text-gray-600">{word.createdBy?.email || 'System'}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-sm ${
                          word.status === 'WHITELISTED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {word.status === 'WHITELISTED' ? 'Whitelisted' : 'Review'}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600">{formatDate(word.createdAt)}</td>
                      <td className="py-3 text-right">
                        <Button variant="secondary" onClick={() => openEditModal(word)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button
              variant="secondary"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
            >
              Previous
            </Button>
            <span className="px-4 py-2 text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
            >
              Next
            </Button>
          </div>
        )}
      </TabPanel>

      {/* Add Words Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Dictionary Words"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddWords} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Words'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Enter words (one per line):
            </label>
            <textarea
              value={addWordsText}
              onChange={(e) => setAddWordsText(e.target.value)}
              placeholder="Coconino&#10;ReleasePass&#10;Acme"
              rows={6}
              className="w-full px-3 py-2 border border-medium-gray rounded resize-none font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Words with spaces will be split into separate entries.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Status:</label>
            <select
              value={addStatus}
              onChange={(e) => setAddStatus(e.target.value as 'REVIEW' | 'WHITELISTED')}
              className="w-full px-3 py-2 border border-medium-gray rounded"
            >
              <option value="WHITELISTED">Whitelisted (active filtering)</option>
              <option value="REVIEW">Review (pending approval)</option>
            </select>
          </div>
          {formError && (
            <p className="text-red-600 text-sm">{formError}</p>
          )}
          {formSuccess && (
            <p className="text-green-600 text-sm">{formSuccess}</p>
          )}
        </div>
      </Modal>

      {/* Edit Word Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Dictionary Word"
        footer={
          <div className="flex justify-between">
            <Button
              variant="secondary"
              onClick={handleDeleteWord}
              disabled={submitting}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Delete
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditWord} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Word:</label>
            <input
              type="text"
              value={editWordText}
              onChange={(e) => setEditWordText(e.target.value)}
              className="w-full px-3 py-2 border border-medium-gray rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Status:</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as 'REVIEW' | 'WHITELISTED')}
              className="w-full px-3 py-2 border border-medium-gray rounded"
            >
              <option value="WHITELISTED">Whitelisted (active filtering)</option>
              <option value="REVIEW">Review (pending approval)</option>
            </select>
          </div>
          {formError && (
            <p className="text-red-600 text-sm">{formError}</p>
          )}
        </div>
      </Modal>
    </PageContainer>
  )
}
