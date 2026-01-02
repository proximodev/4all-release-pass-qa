import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { projectSchema } from '@/lib/validation/project'
import { requireAuth } from '@/lib/auth'

/**
 * POST /api/projects - Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    // Parse and validate request body
    const body = await request.json()
    const validatedData = projectSchema.parse(body)

    // Create project (companyId null for MVP)
    const project = await prisma.project.create({
      data: {
        ...validatedData,
        companyId: null,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create project error:', error)
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/projects - List all active projects
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    // Get all active projects (not soft deleted)
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(projects, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('List projects error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}
