import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { projectSchema } from '@/lib/validation/project'
import { isValidUuid } from '@/lib/validation/common'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/projects/[id] - Get project details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid project ID format' }, { status: 400 })
    }

    // TODO: Add resource-level authorization when multi-tenant is implemented
    // Verify user has access: project.companyId === user.companyId

    const project = await prisma.project.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get project error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/projects/[id] - Update project
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid project ID format' }, { status: 400 })
    }

    // TODO: Add resource-level authorization when multi-tenant is implemented
    // Verify user has access: project.companyId === user.companyId

    // Parse and validate request body
    const body = await request.json()
    const validatedData = projectSchema.partial().parse(body)

    // Update project
    const project = await prisma.project.update({
      where: {
        id,
        deletedAt: null,
      },
      data: validatedData,
    })

    return NextResponse.json(project)
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update project error:', error)
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      )
    }

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[id] - Soft delete project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid project ID format' }, { status: 400 })
    }

    // TODO: Add resource-level authorization when multi-tenant is implemented
    // Verify user has access: project.companyId === user.companyId

    // Soft delete by setting deletedAt timestamp
    await prisma.project.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({ message: 'Project deleted successfully' })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete project error:', error)
    }

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
