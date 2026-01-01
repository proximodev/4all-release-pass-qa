import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { releaseRunSchema } from '@/lib/validation/releaseRun'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/release-runs - Create a new Release Run (displayed as "Test" in UI)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = releaseRunSchema.parse(body)

    // Generate default name if not provided (M/D/YY Preflight Test)
    const now = new Date()
    const defaultName = `${now.getMonth() + 1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)} Preflight Test`

    // Use transaction to avoid connection pool exhaustion
    const releaseRun = await prisma.$transaction(async (tx) => {
      const run = await tx.releaseRun.create({
        data: {
          projectId: validatedData.projectId,
          name: validatedData.name || defaultName,
          urls: validatedData.urls,
          selectedTests: validatedData.selectedTests,
          status: 'PENDING',
        },
        include: {
          project: {
            select: { id: true, name: true, siteUrl: true },
          },
        },
      })

      // Create queued TestRuns for each selected test type
      await tx.testRun.createMany({
        data: validatedData.selectedTests.map((testType) => ({
          releaseRunId: run.id,
          projectId: validatedData.projectId,
          type: testType,
          status: 'QUEUED',
        })),
      })

      return run
    })

    return NextResponse.json(releaseRun, { status: 201 })
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create release run error:', error)
    }

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to create release run' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/release-runs?projectId={uuid} - List release runs for a project
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId query parameter is required' },
        { status: 400 }
      )
    }

    const releaseRuns = await prisma.releaseRun.findMany({
      where: { projectId },
      include: {
        testRuns: {
          select: {
            id: true,
            type: true,
            status: true,
            score: true,
            finishedAt: true,
          },
        },
        _count: {
          select: { testRuns: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(releaseRuns)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('List release runs error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch release runs' },
      { status: 500 }
    )
  }
}
