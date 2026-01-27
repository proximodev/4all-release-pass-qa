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
  url: z.string().url(),
})

/**
 * POST /api/release-runs/[id]/rerun - Rerun a specific test type for a single URL
 *
 * Reruns are always scoped to a single page. The existing UrlResult(s) for that URL
 * are deleted, and the TestRun is queued for the worker to reprocess just that URL.
 * The aggregate score will be recalculated from all UrlResults after processing.
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

    const { testType, url } = parseResult.data

    // Check if release run exists
    const releaseRun = await prisma.releaseRun.findUnique({
      where: { id },
      include: {
        testRuns: {
          where: { type: testType },
          include: { config: true }
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

    // Validate URL is part of this release run
    const releaseRunUrls = releaseRun.urls as string[]
    if (!releaseRunUrls.includes(url)) {
      return NextResponse.json(
        { error: 'URL not found in this release run' },
        { status: 400 }
      )
    }

    const existingTestRun = releaseRun.testRuns[0]

    // Handle rerun atomically
    const testRunId = await prisma.$transaction(async (tx) => {
      if (existingTestRun) {
        // Delete only UrlResult(s) for this URL (cascades to ResultItems)
        await tx.urlResult.deleteMany({
          where: {
            testRunId: existingTestRun.id,
            url: url,
          }
        })

        // Upsert TestRunConfig with just this URL
        await tx.testRunConfig.upsert({
          where: { testRunId: existingTestRun.id },
          create: {
            testRunId: existingTestRun.id,
            scope: 'CUSTOM_URLS',
            urls: [url],
          },
          update: {
            urls: [url],
          }
        })

        // Set status to QUEUED and reset timestamps
        await tx.testRun.update({
          where: { id: existingTestRun.id },
          data: {
            status: 'QUEUED',
            startedAt: null,
            finishedAt: null,
            error: null,
          }
        })

        // Update release run status to PENDING
        await tx.releaseRun.update({
          where: { id },
          data: { status: 'PENDING' }
        })

        return existingTestRun.id
      } else {
        // No existing TestRun - create new one with config
        const newTestRun = await tx.testRun.create({
          data: {
            releaseRunId: id,
            projectId: releaseRun.projectId,
            type: testType,
            status: 'QUEUED',
            config: {
              create: {
                scope: 'CUSTOM_URLS',
                urls: [url],
              }
            }
          }
        })

        // Update release run status to PENDING
        await tx.releaseRun.update({
          where: { id },
          data: { status: 'PENDING' }
        })

        return newTestRun.id
      }
    })

    return NextResponse.json({
      success: true,
      testRunId,
      message: `${testType} test queued for rerun (${url})`
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
