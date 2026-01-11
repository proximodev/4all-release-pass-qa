import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { isValidUuid } from '@/lib/validation/common'
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
    const { error } = await requireAuth()
    if (error) return error

    // TODO: Add resource-level authorization when multi-tenant is implemented
    // Verify user has access via: releaseRun.project.companyId === user.companyId

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid release run ID format' }, { status: 400 })
    }

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

    // Delete, create, and update atomically
    const newTestRun = await prisma.$transaction(async (tx) => {
      // Delete existing test run for this type (cascades to UrlResults and ResultItems)
      if (releaseRun.testRuns.length > 0) {
        await tx.testRun.deleteMany({
          where: {
            releaseRunId: id,
            type: testType,
          }
        })
      }

      // Create new test run with QUEUED status
      const created = await tx.testRun.create({
        data: {
          releaseRunId: id,
          projectId: releaseRun.projectId,
          type: testType,
          status: 'QUEUED',
        }
      })

      // Update release run status to PENDING since we have a new queued test
      await tx.releaseRun.update({
        where: { id },
        data: { status: 'PENDING' }
      })

      return created
    })

    return NextResponse.json({
      success: true,
      testRunId: newTestRun.id,
      message: `${testType} test queued for rerun`
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Rerun test error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to rerun test' },
      { status: 500 }
    )
  }
}
