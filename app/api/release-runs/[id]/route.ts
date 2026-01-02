import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/release-runs/[id] - Get a specific release run with summary data
 *
 * Returns release run with test runs and URL results, but NOT resultItems.
 * Use GET /api/release-runs/[id]/url-results/[urlResultId] for detailed results.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    // TODO: Add resource-level authorization when multi-tenant is implemented
    // Verify user has access via: releaseRun.project.companyId === user.companyId

    const { id } = await params

    const releaseRun = await prisma.releaseRun.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true, siteUrl: true, sitemapUrl: true },
        },
        testRuns: {
          select: {
            id: true,
            type: true,
            status: true,
            score: true,
            createdAt: true,
            finishedAt: true,
            // Exclude rawPayload - large JSON blob not needed for summary
            urlResults: {
              select: {
                id: true,
                url: true,
                viewport: true,
                issueCount: true,
                preflightScore: true,
                performanceScore: true,
                additionalMetrics: true,
                // resultItems excluded - fetch via /url-results/[id] endpoint
                _count: {
                  select: { resultItems: true },
                },
              },
            },
            _count: {
              select: { urlResults: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        manualStatuses: {
          include: {
            updatedBy: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
      },
    })

    if (!releaseRun) {
      return NextResponse.json({ error: 'Release run not found' }, { status: 404 })
    }

    return NextResponse.json(releaseRun)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get release run error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch release run' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/release-runs/[id] - Delete a release run
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    // TODO: Add resource-level authorization when multi-tenant is implemented
    // Verify user has access via: releaseRun.project.companyId === user.companyId

    const { id } = await params

    // Check if release run exists
    const releaseRun = await prisma.releaseRun.findUnique({
      where: { id },
    })

    if (!releaseRun) {
      return NextResponse.json({ error: 'Release run not found' }, { status: 404 })
    }

    // Delete release run (cascades to testRuns, issues, etc.)
    await prisma.releaseRun.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete release run error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to delete release run' },
      { status: 500 }
    )
  }
}
