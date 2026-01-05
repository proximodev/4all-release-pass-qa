import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const updateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

/**
 * GET /api/release-rule-categories/[id] - Get a specific category
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    const category = await prisma.releaseRuleCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { rules: true },
        },
      },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json(category)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get category error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/release-rule-categories/[id] - Update a category
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const validation = updateCategorySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    // Check if category exists
    const existing = await prisma.releaseRuleCategory.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const { name, description, sortOrder, isActive } = validation.data

    // If name is changing, check it's not already taken
    if (name && name !== existing.name) {
      const nameTaken = await prisma.releaseRuleCategory.findUnique({
        where: { name },
      })

      if (nameTaken) {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        )
      }
    }

    const category = await prisma.releaseRuleCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update category error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/release-rule-categories/[id] - Delete a category
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    // Check if category exists and has rules
    const category = await prisma.releaseRuleCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { rules: true },
        },
      },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Prevent deletion if rules are linked
    if (category._count.rules > 0) {
      return NextResponse.json(
        { error: `Cannot delete category. ${category._count.rules} rule(s) are linked to it.` },
        { status: 400 }
      )
    }

    await prisma.releaseRuleCategory.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete category error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}
