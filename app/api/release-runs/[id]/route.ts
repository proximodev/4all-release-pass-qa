import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/release-runs/[id] - Get a specific release run with full details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const releaseRun = await prisma.releaseRun.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true, siteUrl: true, sitemapUrl: true },
        },
        testRuns: {
          include: {
            urlResults: {
              include: {
                resultItems: {
                  orderBy: { severity: 'asc' },
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
    console.error('Get release run error:', error)
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    console.error('Delete release run error:', error)
    return NextResponse.json(
      { error: 'Failed to delete release run' },
      { status: 500 }
    )
  }
}
