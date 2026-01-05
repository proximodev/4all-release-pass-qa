import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const providerEnum = z.enum(['SE_RANKING', 'LANGUAGETOOL', 'LIGHTHOUSE', 'LINKINATOR', 'ReleasePass', 'INTERNAL'])
const severityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'BLOCKER'])

const createRuleSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  provider: providerEnum,
  categoryId: z.string().uuid('Invalid category'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  severity: severityEnum,
  impact: z.string().optional().nullable(),
  fix: z.string().optional().nullable(),
  docUrl: z.string().url().optional().nullable().or(z.literal('')),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

/**
 * GET /api/release-rules - List all rules
 */
export async function GET() {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const rules = await prisma.releaseRule.findMany({
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

    return NextResponse.json(rules)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('List rules error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch rules' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/release-rules - Create a new rule
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const body = await request.json()
    // Handle empty docUrl
    if (body.docUrl === '') {
      body.docUrl = null
    }
    const validation = createRuleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { code, provider, categoryId, name, description, severity, impact, fix, docUrl, sortOrder, isActive } = validation.data

    // Check if code already exists
    const existing = await prisma.releaseRule.findUnique({
      where: { code },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A rule with this code already exists' },
        { status: 409 }
      )
    }

    // Check if category exists
    const category = await prisma.releaseRuleCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 400 }
      )
    }

    const rule = await prisma.releaseRule.create({
      data: {
        code,
        provider,
        categoryId,
        name,
        description,
        severity,
        impact,
        fix,
        docUrl: docUrl || null,
        sortOrder,
        isActive,
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

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create rule error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    )
  }
}
