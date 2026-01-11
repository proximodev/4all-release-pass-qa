import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { isValidUuid } from '@/lib/validation/common'

interface RouteParams {
  params: Promise<{ id: string; urlResultId: string }>
}

/**
 * GET /api/release-runs/[id]/url-results/[urlResultId]
 *
 * Returns a single UrlResult with its resultItems.
 * Used by TestResultDetail for displaying detailed results for a selected URL.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    // TODO: Add resource-level authorization when multi-tenant is implemented
    // Verify user has access via: urlResult.testRun.project.companyId === user.companyId

    const { id: releaseRunId, urlResultId } = await params

    if (!isValidUuid(releaseRunId) || !isValidUuid(urlResultId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
    }

    // Fetch the URL result with its items
    const urlResult = await prisma.urlResult.findUnique({
      where: { id: urlResultId },
      include: {
        resultItems: {
          include: {
            releaseRule: {
              include: {
                category: true, // Include category for grouping
              },
            },
          },
          orderBy: [
            { status: 'asc' },  // FAIL first, then PASS, then SKIP
            { provider: 'asc' }, // Group by provider
          ],
        },
        testRun: {
          select: {
            id: true,
            type: true,
            releaseRunId: true,
          },
        },
      },
    })

    if (!urlResult) {
      return NextResponse.json({ error: 'URL result not found' }, { status: 404 })
    }

    // Verify this urlResult belongs to the specified release run
    if (urlResult.testRun.releaseRunId !== releaseRunId) {
      return NextResponse.json({ error: 'URL result not found' }, { status: 404 })
    }

    // Result data is immutable once written - cache aggressively
    return NextResponse.json(urlResult, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get URL result error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch URL result' },
      { status: 500 }
    )
  }
}
