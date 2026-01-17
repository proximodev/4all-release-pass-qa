import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ code: string }>
}

const severityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'BLOCKER'])

const updateRuleSchema = z.object({
  categoryId: z.string().uuid('Invalid category').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().min(1, 'Description is required').optional(),
  severity: severityEnum.optional(),
  impact: z.string().optional().nullable(),
  fix: z.string().optional().nullable(),
  docUrl: z.string().url().optional().nullable().or(z.literal('')),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isOptional: z.boolean().optional(),
})

/**
 * GET /api/release-rules/[code] - Get a specific rule
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { code } = await params

    const rule = await prisma.releaseRule.findUnique({
      where: { code },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json(rule)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get rule error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch rule' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/release-rules/[code] - Update a rule
 * Note: code and provider are read-only after creation
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { code } = await params
    const body = await request.json()

    // Handle empty docUrl
    if (body.docUrl === '') {
      body.docUrl = null
    }

    const validation = updateRuleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    // Check if rule exists
    const existing = await prisma.releaseRule.findUnique({
      where: { code },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    const { categoryId, name, description, severity, impact, fix, docUrl, sortOrder, isActive, isOptional } = validation.data

    // If categoryId is changing, verify it exists
    if (categoryId && categoryId !== existing.categoryId) {
      const category = await prisma.releaseRuleCategory.findUnique({
        where: { id: categoryId },
      })

      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 400 }
        )
      }
    }

    // If rule is being changed from optional to non-optional, clean up ProjectOptionalRule records
    if (isOptional === false && existing.isOptional === true) {
      await prisma.projectOptionalRule.deleteMany({
        where: { ruleCode: code },
      })
    }

    const rule = await prisma.releaseRule.update({
      where: { code },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(severity !== undefined && { severity }),
        ...(impact !== undefined && { impact }),
        ...(fix !== undefined && { fix }),
        ...(docUrl !== undefined && { docUrl: docUrl || null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
        ...(isOptional !== undefined && { isOptional }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(rule)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update rule error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to update rule' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/release-rules/[code] - Delete a rule
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { code } = await params

    // Check if rule exists
    const rule = await prisma.releaseRule.findUnique({
      where: { code },
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    await prisma.releaseRule.delete({
      where: { code },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete rule error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to delete rule' },
      { status: 500 }
    )
  }
}
