import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { isValidUuid } from '@/lib/validation/common'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/release-runs/[id]/rerun-all - Rerun all tests for all URLs
 *
 * Reruns all selected test types for all URLs in the release run.
 * All existing UrlResults are deleted and TestRuns are queued for reprocessing.
 * ManualTestStatus records (Screenshots) are preserved.
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

    // Fetch release run with test runs
    const releaseRun = await prisma.releaseRun.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, companyId: true } },
        testRuns: { select: { id: true, type: true } },
      },
    })

    if (!releaseRun) {
      return NextResponse.json({ error: 'Release run not found' }, { status: 404 })
    }

    // Get URLs from release run
    const urls = releaseRun.urls as string[]

    if (releaseRun.testRuns.length === 0) {
      return NextResponse.json({ error: 'No tests to rerun' }, { status: 400 })
    }

    // Rerun all tests in transaction
    await prisma.$transaction(async (tx) => {
      for (const testRun of releaseRun.testRuns) {
        // Delete all UrlResults for this test run (cascades to ResultItems)
        await tx.urlResult.deleteMany({
          where: { testRunId: testRun.id },
        })

        // Reset test run to queued
        await tx.testRun.update({
          where: { id: testRun.id },
          data: {
            status: 'QUEUED',
            score: null,
            startedAt: null,
            finishedAt: null,
            lastHeartbeat: null,
            rawPayload: null,
            error: null,
          },
        })

        // Update or create TestRunConfig with all URLs
        await tx.testRunConfig.upsert({
          where: { testRunId: testRun.id },
          create: {
            testRunId: testRun.id,
            scope: 'CUSTOM_URLS',
            urls: urls,
          },
          update: {
            scope: 'CUSTOM_URLS',
            urls: urls,
          },
        })
      }

      // Set release run back to pending
      await tx.releaseRun.update({
        where: { id },
        data: { status: 'PENDING' },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'All tests queued for rerun',
      testTypes: releaseRun.testRuns.map(t => t.type),
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Rerun all tests error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to rerun tests' },
      { status: 500 }
    )
  }
}
