import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Update all queued/running test runs to FAILED
    await prisma.testRun.updateMany({
      where: {
        releaseRunId: id,
        status: { in: ['QUEUED', 'RUNNING'] }
      },
      data: {
        status: 'FAILED',
        finishedAt: new Date()
      }
    })

    // Update release run status to FAIL
    await prisma.releaseRun.update({
      where: { id },
      data: { status: 'FAIL' }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel release run error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel release run' },
      { status: 500 }
    )
  }
}
