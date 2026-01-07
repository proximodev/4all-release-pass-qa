import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'
import {
  recalculateUrlResultScore,
  recalculateTestRunScore,
  getResultItemContext,
} from '@/lib/services/scoreRecalculation'

interface RouteParams {
  params: Promise<{ id: string }>
}

const updateResultItemSchema = z.object({
  ignored: z.boolean(),
})

/**
 * PATCH /api/result-items/[id] - Toggle ignored status
 *
 * When ignoring:
 * - Sets ResultItem.ignored = true
 * - Creates IgnoredRule record for persistence across reruns
 * - Recalculates UrlResult and TestRun scores
 *
 * When un-ignoring:
 * - Sets ResultItem.ignored = false
 * - Deletes IgnoredRule record
 * - Recalculates scores
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const validation = updateResultItemSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { ignored } = validation.data

    // Get context for this result item
    const context = await getResultItemContext(id)

    // Update the ResultItem
    const resultItem = await prisma.resultItem.update({
      where: { id },
      data: { ignored },
      include: {
        releaseRule: {
          include: {
            category: true,
          },
        },
      },
    })

    // Manage IgnoredRule record
    if (ignored) {
      // Create IgnoredRule (upsert to handle duplicates)
      await prisma.ignoredRule.upsert({
        where: {
          projectId_url_code: {
            projectId: context.projectId,
            url: context.url,
            code: context.code,
          },
        },
        create: {
          projectId: context.projectId,
          url: context.url,
          code: context.code,
        },
        update: {}, // No update needed, just ensure it exists
      })
    } else {
      // Delete IgnoredRule if it exists
      await prisma.ignoredRule.deleteMany({
        where: {
          projectId: context.projectId,
          url: context.url,
          code: context.code,
        },
      })
    }

    // Recalculate scores
    const urlResultScore = await recalculateUrlResultScore(context.urlResultId)
    const testRunScore = await recalculateTestRunScore(context.testRunId)

    return NextResponse.json({
      resultItem,
      urlResultScore,
      testRunScore,
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update result item error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to update result item' },
      { status: 500 }
    )
  }
}
