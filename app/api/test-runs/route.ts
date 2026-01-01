import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { testRunSchema } from '@/lib/validation/testRun'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/test-runs - Create a new test run
 *
 * This is a STUB implementation for Phase 3.
 * Creates a test run in QUEUED status but does not trigger actual test execution.
 * Test execution will be implemented in Phase 4 (Worker Service).
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = testRunSchema.parse(body)

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: {
        id: validatedData.projectId,
        deletedAt: null,
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Create test run with QUEUED status
    const testRun = await prisma.testRun.create({
      data: {
        projectId: validatedData.projectId,
        type: validatedData.type,
        status: 'QUEUED',
      },
    })

    // Create test run config if scope/urls provided
    if (validatedData.scope) {
      await prisma.testRunConfig.create({
        data: {
          testRunId: testRun.id,
          scope: validatedData.scope,
          urls: validatedData.urls || [],
        },
      })
    }

    return NextResponse.json(testRun, { status: 201 })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create test run error:', error)
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create test run' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/test-runs - List test runs
 * Query parameters:
 * - projectId: Filter by project ID (required)
 * - type: Filter by test type (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const type = searchParams.get('type')

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId query parameter is required' },
        { status: 400 }
      )
    }

    // Build where clause
    const where: any = { projectId }
    if (type) {
      where.type = type
    }

    // Get test runs
    const testRuns = await prisma.testRun.findMany({
      where,
      include: {
        config: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(testRuns)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('List test runs error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch test runs' },
      { status: 500 }
    )
  }
}
