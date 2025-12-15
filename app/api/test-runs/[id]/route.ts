import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

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
    const { id } = await params

    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
          orderBy: { createdAt: 'desc' },
        },
        issues: {
          orderBy: { severity: 'desc' },
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
    console.error('Get test run error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch test run' },
      { status: 500 }
    )
  }
}
