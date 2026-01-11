import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/release-runs/[id]/cancel - Cancel a release run
 *
 * Marks all QUEUED and RUNNING test runs as FAILED.
 * Updates the release run status to FAIL.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    // TODO: Add resource-level authorization when multi-tenant is implemented
    // Verify user has access via: releaseRun.project.companyId === user.companyId

    const { id } = await params

    // Check if release run exists
    const releaseRun = await prisma.releaseRun.findUnique({
      where: { id },
      include: {
        testRuns: {
          where: {
            status: { in: ['QUEUED', 'RUNNING'] }
          }
        }
      }
    })

    if (!releaseRun) {
      return NextResponse.json({ error: 'Release run not found' }, { status: 404 })
    }

    // Update test runs and release run atomically
    await prisma.$transaction([
      prisma.testRun.updateMany({
        where: {
          releaseRunId: id,
          status: { in: ['QUEUED', 'RUNNING'] }
        },
        data: {
          status: 'FAILED',
          finishedAt: new Date()
        }
      }),
      prisma.releaseRun.update({
        where: { id },
        data: { status: 'FAIL' }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Cancel release run error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to cancel release run' },
      { status: 500 }
    )
  }
}
