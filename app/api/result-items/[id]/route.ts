import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { isValidUuid } from '@/lib/validation/common'
import { z } from 'zod'
import {
  recalculateUrlResultScore,
  recalculateTestRunScore,
  getResultItemContext,
} from '@/lib/services/scoreRecalculation'
import { IssueProvider } from '@prisma/client'

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
    const { error, user } = await requireAuth()
    if (error) return error

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid result item ID format' }, { status: 400 })
    }

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

      // Silently add misspelling words to dictionary for review
      // This seeds the dictionary with commonly ignored words
      await addSpellingWordToDictionary(resultItem, context.url, user?.id)
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

/**
 * Silently add a misspelling word to the dictionary for review.
 *
 * Only applies to:
 * - Provider: LANGUAGETOOL
 * - IssueType: misspelling OR category: TYPOS
 *
 * The word is extracted from ResultItem.meta and added with:
 * - status: REVIEW (pending approval)
 * - source: RESULT (from spelling result ignore action)
 * - sourceUrl: URL where the word was flagged
 *
 * Failures are logged but do not fail the ignore action.
 */
async function addSpellingWordToDictionary(
  resultItem: { provider: IssueProvider; meta: unknown },
  sourceUrl: string,
  userId?: string
): Promise<void> {
  try {
    // Only process LanguageTool results
    if (resultItem.provider !== IssueProvider.LANGUAGETOOL) {
      return
    }

    const meta = resultItem.meta as Record<string, unknown> | null
    if (!meta) {
      return
    }

    // Check if this is a misspelling error
    const issueType = (meta.issueType as string || '').toLowerCase()
    const category = (meta.category as string || '').toUpperCase()

    if (issueType !== 'misspelling' && category !== 'TYPOS') {
      return
    }

    // Extract the word from context
    const context = meta.context as string | undefined
    const contextOffset = meta.contextOffset as number | undefined
    const contextLength = meta.contextLength as number | undefined

    if (!context || contextOffset === undefined || contextLength === undefined) {
      return
    }

    const displayWord = context.substring(contextOffset, contextOffset + contextLength)
    const word = displayWord.toLowerCase()

    // Validate word (basic checks)
    if (word.length < 2 || word.length > 45) {
      return
    }

    // Check if word already exists
    const existing = await prisma.dictionaryWord.findUnique({
      where: { word },
    })

    if (existing) {
      // Word already in dictionary, skip silently
      return
    }

    // Add word to dictionary with REVIEW status
    await prisma.dictionaryWord.create({
      data: {
        word,
        displayWord,
        status: 'REVIEW',
        source: 'RESULT',
        sourceUrl,
        createdByUserId: userId,
      },
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DICTIONARY] Added "${displayWord}" from spelling ignore action`)
    }
  } catch (error) {
    // Log but don't fail the ignore action
    console.warn('[DICTIONARY] Failed to add word from spelling ignore:', error)
  }
}
