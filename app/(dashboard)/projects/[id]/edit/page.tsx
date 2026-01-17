'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import Input from '@/components/ui/input/Input'
import Textarea from '@/components/ui/textarea/Textarea'
import FormContainer from '@/components/layout/FormContainer'
import Tabs from '@/components/ui/tabs/Tabs'
import { projectTabs } from '@/lib/constants/navigation'
import TwoColumnGrid from '@/components/layout/TwoColumnGrid'
import PageContainer from '@/components/layout/PageContainer'

interface Project {
  id: string
  name: string
  siteUrl: string
  sitemapUrl: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface OptionalRule {
  code: string
  name: string
  description: string
  severity: string
  enabled: boolean
  category: {
    id: string
    name: string
  }
}

interface ProjectEditPageProps {
  params: Promise<{ id: string }>
}

export default function ProjectEditPage({ params }: ProjectEditPageProps) {
  const router = useRouter()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [optionalRules, setOptionalRules] = useState<OptionalRule[]>([])
  const [optionalRulesLoading, setOptionalRulesLoading] = useState(true)
  const [togglingRule, setTogglingRule] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id)
      fetchProject(id)
      fetchOptionalRules(id)
    })
  }, [params])

  const fetchProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`)

      if (!res.ok) {
        setErrors({ general: 'Failed to load project' })
        return
      }

      const data = await res.json()
      setProject(data)
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' })
    } finally {
      setLoading(false)
    }
  }

  const fetchOptionalRules = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/optional-rules`)
      if (res.ok) {
        const data = await res.json()
        setOptionalRules(data)
      }
    } catch (error) {
      console.error('Failed to fetch optional rules:', error)
    } finally {
      setOptionalRulesLoading(false)
    }
  }

  const toggleOptionalRule = async (ruleCode: string, enabled: boolean) => {
    if (!projectId) return

    setTogglingRule(ruleCode)

    try {
      const res = await fetch(`/api/projects/${projectId}/optional-rules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleCode, enabled }),
      })

      if (res.ok) {
        // Update local state
        setOptionalRules(prev =>
          prev.map(rule =>
            rule.code === ruleCode ? { ...rule, enabled } : rule
          )
        )
      }
    } catch (error) {
      console.error('Failed to toggle optional rule:', error)
    } finally {
      setTogglingRule(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!projectId) return

    setSaving(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      siteUrl: formData.get('siteUrl') as string,
      sitemapUrl: formData.get('sitemapUrl') as string,
      notes: formData.get('notes') as string,
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        if (Array.isArray(error.error)) {
          // Zod validation errors
          const errorMap: Record<string, string> = {}
          error.error.forEach((err: any) => {
            errorMap[err.path[0]] = err.message
          })
          setErrors(errorMap)
        } else {
          setErrors({ general: error.error || 'Failed to update project' })
        }
        return
      }

      // Success - redirect to project view
      router.push(`/projects/${projectId}`)
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!projectId) return

    setDeleting(true)

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        setErrors({ general: error.error || 'Failed to delete project' })
        setDeleting(false)
        setShowDeleteConfirm(false)
        return
      }

      // Success - redirect to projects list
      router.push('/projects')
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' })
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <Tabs tabs={projectTabs} />
        <div className="flex justify-center items-center py-12">
          <p>Loading project...</p>
        </div>
      </PageContainer>
    )
  }

  if (!project) {
    return (
      <PageContainer>
        <Tabs tabs={projectTabs} />
        <Card title="Error">
          <div className="space-y-4">
            <p>{errors.general || 'Project not found'}</p>
            <Button onClick={() => router.push('/projects')}>
              Back to Projects
            </Button>
          </div>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Tabs tabs={projectTabs} />
      <TwoColumnGrid>
        <FormContainer>
          <Card title={`Edit: ${project.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.general && (
                <div className="bg-red/10 border border-red text-red p-3 rounded">
                  {errors.general}
                </div>
              )}

              <Input
                label="Project Name"
                name="name"
                placeholder="e.g., 4All Digital Marketing Site"
                required
                defaultValue={project.name}
                error={errors.name}
              />

              <Input
                label="Site URL"
                name="siteUrl"
                type="url"
                placeholder="https://example.com"
                required
                defaultValue={project.siteUrl}
                error={errors.siteUrl}
              />

              <Input
                label="Sitemap URL"
                name="sitemapUrl"
                type="url"
                placeholder="https://example.com/sitemap.xml"
                required
                defaultValue={project.sitemapUrl}
                error={errors.sitemapUrl}
              />

              <Textarea
                label="Notes"
                name="notes"
                placeholder="Optional notes about this project"
                rows={4}
                defaultValue={project.notes || ''}
              />

              <div className="flex items-center justify-between pt-4 border-t border-medium-gray">
                <div className="flex items-center space-x-4">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push(`/projects/${projectId}`)}
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
                  Delete Project
                </Button>
              </div>
            </form>
          </Card>

          {/* Optional Preflight Rules Section */}
          <Card title="Optional Preflight Rules">
            <p className="text-sm text-gray-600 mb-4">
              Enable optional rules for this project. These rules are off by default and can be enabled per project.
            </p>
            {optionalRulesLoading ? (
              <p className="text-gray-500">Loading optional rules...</p>
            ) : optionalRules.length === 0 ? (
              <p className="text-gray-500">No optional rules configured. Optional rules can be created in Settings &gt; Preflight Rules.</p>
            ) : (
              <div className="space-y-3">
                {optionalRules.map((rule) => (
                  <label
                    key={rule.code}
                    className="flex items-start space-x-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => toggleOptionalRule(rule.code, e.target.checked)}
                      disabled={togglingRule === rule.code}
                      className="w-4 h-4 mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rule.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          rule.severity === 'BLOCKER' ? 'bg-red-100 text-red-800' :
                          rule.severity === 'CRITICAL' ? 'bg-orange-100 text-orange-800' :
                          rule.severity === 'HIGH' ? 'bg-yellow-100 text-yellow-800' :
                          rule.severity === 'MEDIUM' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{rule.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </Card>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3>
                  Confirm Deletion
                </h3>
                <p>
                  Are you sure you want to delete <strong>{project.name}</strong>?
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
                    {deleting ? 'Deleting...' : 'Delete Project'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </FormContainer>
      </TwoColumnGrid>
    </PageContainer>
  )
}
