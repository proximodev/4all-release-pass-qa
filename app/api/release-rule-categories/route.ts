import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

/**
 * GET /api/release-rule-categories - List all categories
 */
export async function GET() {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const categories = await prisma.releaseRuleCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { rules: true },
        },
      },
    })

    return NextResponse.json(categories)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('List categories error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/release-rule-categories - Create a new category
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const body = await request.json()
    const validation = createCategorySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { name, description, sortOrder, isActive } = validation.data

    // Check if category name already exists
    const existing = await prisma.releaseRuleCategory.findUnique({
      where: { name },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      )
    }

    const category = await prisma.releaseRuleCategory.create({
      data: {
        name,
        description,
        sortOrder,
        isActive,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create category error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}
