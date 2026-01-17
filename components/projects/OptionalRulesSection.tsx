'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/card/Card'

interface OptionalRule {
  code: string
  name: string
  description: string
  severity: string
  enabled?: boolean
  category: {
    id: string
    name: string
  }
}

interface OptionalRulesSectionProps {
  projectId?: string
  onEnabledRulesChange: (codes: string[]) => void
}

export default function OptionalRulesSection({
  projectId,
  onEnabledRulesChange
}: OptionalRulesSectionProps) {
  const [rules, setRules] = useState<OptionalRule[]>([])
  const [enabledRules, setEnabledRules] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOptionalRules()
  }, [projectId])

  const fetchOptionalRules = async () => {
    try {
      // Use different endpoint based on whether we have a projectId
      const endpoint = projectId
        ? `/api/projects/${projectId}/optional-rules`
        : '/api/release-rules/optional'

      const res = await fetch(endpoint)
      if (res.ok) {
        const data = await res.json()
        setRules(data)

        // For edit mode, initialize enabled state from API response
        if (projectId) {
          const initialEnabled = new Set(
            data.filter((r: OptionalRule) => r.enabled).map((r: OptionalRule) => r.code)
          )
          setEnabledRules(initialEnabled)
          onEnabledRulesChange(Array.from(initialEnabled))
        }
      }
    } catch (error) {
      console.error('Failed to fetch optional rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (ruleCode: string, enabled: boolean) => {
    setEnabledRules(prev => {
      const next = new Set(prev)
      if (enabled) {
        next.add(ruleCode)
      } else {
        next.delete(ruleCode)
      }
      onEnabledRulesChange(Array.from(next))
      return next
    })
  }

  return (
    <Card title="Optional Preflight Rules">
      <p className="text-sm text-gray-600 mb-4">
        Enable optional rules for this project. These rules are off by default and can be enabled per project.
      </p>
      {loading ? (
        <p className="text-gray-500">Loading optional rules...</p>
      ) : rules.length === 0 ? (
        <p className="text-gray-500">No optional rules available.</p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <label
              key={rule.code}
              className="flex items-start space-x-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={enabledRules.has(rule.code)}
                onChange={(e) => handleToggle(rule.code, e.target.checked)}
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
  )
}
