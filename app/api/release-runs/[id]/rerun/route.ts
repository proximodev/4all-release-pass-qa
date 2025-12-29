import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const rerunSchema = z.object({
  testType: z.enum(['PAGE_PREFLIGHT', 'PERFORMANCE', 'SPELLING', 'SCREENSHOTS']),
})

/**
 * POST /api/release-runs/[id]/rerun - Rerun a specific test type
 *
 * Option A: Deletes the existing TestRun for the given type and creates a new one.
 * The new TestRun is queued for the worker to process.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Validate request body
    const parseResult = rerunSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const { testType } = parseResult.data

    // Check if release run exists
    const releaseRun = await prisma.releaseRun.findUnique({
      where: { id },
      include: {
        testRuns: {
          where: { type: testType }
        }
      }
    })

    if (!releaseRun) {
      return NextResponse.json({ error: 'Release run not found' }, { status: 404 })
    }

    // Check if this test type was selected for this release run
    const selectedTests = releaseRun.selectedTests as string[]
    if (!selectedTests.includes(testType)) {
      return NextResponse.json(
        { error: `Test type ${testType} was not selected for this release run` },
        { status: 400 }
      )
    }

    // Delete existing test run for this type (cascades to UrlResults and ResultItems)
    if (releaseRun.testRuns.length > 0) {
      await prisma.testRun.deleteMany({
        where: {
          releaseRunId: id,
          type: testType,
        }
      })
    }

    // Create new test run with QUEUED status
    const newTestRun = await prisma.testRun.create({
      data: {
        releaseRunId: id,
        projectId: releaseRun.projectId,
        type: testType,
        status: 'QUEUED',
      }
    })

    // Update release run status to PENDING since we have a new queued test
    await prisma.releaseRun.update({
      where: { id },
      data: { status: 'PENDING' }
    })

    return NextResponse.json({
      success: true,
      testRunId: newTestRun.id,
      message: `${testType} test queued for rerun`
    })
  } catch (error) {
    console.error('Rerun test error:', error)
    return NextResponse.json(
      { error: 'Failed to rerun test' },
      { status: 500 }
    )
  }
}
