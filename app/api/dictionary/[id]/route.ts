import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { isValidUuid } from '@/lib/validation/common'
import { validateWord } from '@/lib/dictionary-validation'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const updateWordSchema = z.object({
  word: z.string().optional(),
  status: z.enum(['REVIEW', 'WHITELISTED']).optional(),
})

/**
 * GET /api/dictionary/[id] - Get a specific dictionary word
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid word ID format' }, { status: 400 })
    }

    const word = await prisma.dictionaryWord.findUnique({
      where: { id },
    })

    if (!word) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 })
    }

    return NextResponse.json(word)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get dictionary word error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch dictionary word' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/dictionary/[id] - Update a dictionary word
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid word ID format' }, { status: 400 })
    }

    const body = await request.json()
    const validation = updateWordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    // Check if word exists
    const existing = await prisma.dictionaryWord.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 })
    }

    const { word: newWord, status } = validation.data

    // Prepare update data
    const updateData: {
      word?: string
      displayWord?: string
      status?: 'REVIEW' | 'WHITELISTED'
    } = {}

    // If word is changing, validate and check for duplicates
    if (newWord !== undefined && newWord !== existing.displayWord) {
      const wordValidation = validateWord(newWord)

      if (!wordValidation.valid) {
        return NextResponse.json(
          { error: wordValidation.error },
          { status: 400 }
        )
      }

      // Check if new word already exists (different record)
      const duplicate = await prisma.dictionaryWord.findUnique({
        where: { word: wordValidation.word },
      })

      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { error: 'A word with this spelling already exists in the dictionary' },
          { status: 409 }
        )
      }

      updateData.word = wordValidation.word!
      updateData.displayWord = wordValidation.displayWord!
    }

    if (status !== undefined) {
      updateData.status = status
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existing)
    }

    const updated = await prisma.dictionaryWord.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update dictionary word error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to update dictionary word' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dictionary/[id] - Delete a dictionary word
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid word ID format' }, { status: 400 })
    }

    // Check if word exists
    const existing = await prisma.dictionaryWord.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 })
    }

    await prisma.dictionaryWord.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete dictionary word error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to delete dictionary word' },
      { status: 500 }
    )
  }
}
