import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { isValidUuid } from '@/lib/validation/common'

/**
 * GET /api/test-runs/[id] - Get test run details
 *
 * This is a STUB implementation for Phase 3.
 * Returns test run with related data (config, project, url results, issues, screenshots).
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
      return NextResponse.json({ error: 'Invalid test run ID format' }, { status: 400 })
    }

    // TODO: Add resource-level authorization when multi-tenant is implemented
    // Verify user has access via: testRun.project.companyId === user.companyId

    const testRun = await prisma.testRun.findUnique({
      where: { id },
      include: {
        config: true,
        project: {
          select: {
            id: true,
            name: true,
            siteUrl: true,
          },
        },
        urlResults: {
          include: {
            resultItems: {
              include: {
                releaseRule: {
                  include: {
                    category: true, // Include category for grouping
                  },
                },
              },
              orderBy: [{ status: 'asc' }, { severity: 'desc' }],
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        screenshotSets: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!testRun) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(testRun)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get test run error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch test run' },
      { status: 500 }
    )
  }
}
