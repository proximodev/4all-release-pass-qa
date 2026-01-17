import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isValidUuid } from '@/lib/validation/common'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const updateOptionalRuleSchema = z.object({
  ruleCode: z.string().min(1, 'Rule code is required'),
  enabled: z.boolean(),
})

/**
 * GET /api/projects/[id]/optional-rules - Get all optional rules with enabled status for project
 *
 * Returns all rules where isOptional=true, with enabled status from ProjectOptionalRule.
 * Rules not in ProjectOptionalRule are considered disabled (OFF by default).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id: projectId } = await params

    if (!isValidUuid(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID format' }, { status: 400 })
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId, deletedAt: null },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all optional rules
    const optionalRules = await prisma.releaseRule.findMany({
      where: {
        isOptional: true,
        isActive: true,
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
      ],
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Get enabled rules for this project
    const projectOptionalRules = await prisma.projectOptionalRule.findMany({
      where: {
        projectId,
        enabled: true,
      },
    })

    const enabledRuleCodes = new Set(projectOptionalRules.map(r => r.ruleCode))

    // Combine: return all optional rules with their enabled status
    const result = optionalRules.map(rule => ({
      code: rule.code,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      category: rule.category,
      enabled: enabledRuleCodes.has(rule.code),
    }))

    return NextResponse.json(result)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get project optional rules error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch optional rules' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/projects/[id]/optional-rules - Update enabled status for an optional rule
 *
 * Body: { ruleCode: string, enabled: boolean }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id: projectId } = await params

    if (!isValidUuid(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID format' }, { status: 400 })
    }

    const body = await request.json()
    const validation = updateOptionalRuleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { ruleCode, enabled } = validation.data

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId, deletedAt: null },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify rule exists and is optional
    const rule = await prisma.releaseRule.findUnique({
      where: { code: ruleCode },
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    if (!rule.isOptional) {
      return NextResponse.json(
        { error: 'Rule is not optional' },
        { status: 400 }
      )
    }

    // Upsert the ProjectOptionalRule record
    const projectOptionalRule = await prisma.projectOptionalRule.upsert({
      where: {
        projectId_ruleCode: {
          projectId,
          ruleCode,
        },
      },
      update: { enabled },
      create: {
        projectId,
        ruleCode,
        enabled,
      },
    })

    return NextResponse.json(projectOptionalRule)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update project optional rule error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to update optional rule' },
      { status: 500 }
    )
  }
}
