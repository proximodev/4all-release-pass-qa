import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { parseWordInput, validateWords } from '@/lib/dictionary-validation'
import { z } from 'zod'

const createWordsSchema = z.object({
  words: z.array(z.string()).min(1, 'At least one word is required'),
  status: z.enum(['REVIEW', 'WHITELISTED']).default('WHITELISTED'),
})

/**
 * GET /api/dictionary - List dictionary words with pagination and filtering
 *
 * Query params:
 * - status: 'REVIEW' | 'WHITELISTED' (optional, filter by status)
 * - search: string (optional, partial match on word)
 * - page: number (default 1)
 * - limit: number (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'REVIEW' | 'WHITELISTED' | null
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    // Build where clause
    const where: {
      status?: 'REVIEW' | 'WHITELISTED'
      word?: { contains: string; mode: 'insensitive' }
    } = {}

    if (status && (status === 'REVIEW' || status === 'WHITELISTED')) {
      where.status = status
    }

    if (search) {
      where.word = { contains: search.toLowerCase(), mode: 'insensitive' }
    }

    // Get total count and words in parallel
    const [total, words] = await Promise.all([
      prisma.dictionaryWord.count({ where }),
      prisma.dictionaryWord.findMany({
        where,
        orderBy: { word: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          word: true,
          displayWord: true,
          status: true,
          source: true,
          createdAt: true,
          createdBy: {
            select: {
              email: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      words,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('List dictionary error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch dictionary words' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dictionary - Add words to the dictionary
 *
 * Request body:
 * - words: string[] - Array of words to add
 * - status: 'REVIEW' | 'WHITELISTED' (default: WHITELISTED)
 *
 * Response:
 * - added: number - Count of words successfully added
 * - skipped: number - Count of words that already existed
 * - errors: string[] - Validation errors for invalid words
 * - words: DictionaryWord[] - Newly created words
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requireAuth()
    if (error) return error

    const body = await request.json()
    const validation = createWordsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { words: inputWords, status } = validation.data

    // Parse and flatten input (handles multi-word inputs)
    const rawWords = inputWords.flatMap(w => parseWordInput(w))

    if (rawWords.length === 0) {
      return NextResponse.json(
        { error: 'No valid words provided' },
        { status: 400 }
      )
    }

    // Validate all words
    const { valid, invalid } = validateWords(rawWords)

    // Check for duplicates in database
    const existingWords = await prisma.dictionaryWord.findMany({
      where: { word: { in: valid.map(v => v.word) } },
      select: { word: true },
    })
    const existingSet = new Set(existingWords.map(w => w.word))

    // Filter out existing words
    const newWords = valid.filter(v => !existingSet.has(v.word))
    const skipped = valid.length - newWords.length

    // Create new words
    const created = await prisma.dictionaryWord.createMany({
      data: newWords.map(({ word, displayWord }) => ({
        word,
        displayWord,
        status,
        source: 'MANUAL' as const,
        createdByUserId: user?.id,
      })),
      skipDuplicates: true,
    })

    // Fetch created words for response
    const createdWords = await prisma.dictionaryWord.findMany({
      where: { word: { in: newWords.map(w => w.word) } },
      select: {
        id: true,
        word: true,
        displayWord: true,
        status: true,
        source: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      added: created.count,
      skipped,
      errors: invalid.map(({ input, error }) => `"${input}": ${error}`),
      words: createdWords,
    }, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create dictionary words error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to create dictionary words' },
      { status: 500 }
    )
  }
}
