import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/release-rules/optional - Get all optional rules
 *
 * Returns all rules where isOptional=true and isActive=true.
 * Used by the new project page to show available optional rules.
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const optionalRules = await prisma.releaseRule.findMany({
      where: {
        isOptional: true,
        isActive: true,
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
      ],
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const result = optionalRules.map(rule => ({
      code: rule.code,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      category: rule.category,
    }))

    return NextResponse.json(result)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get optional rules error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch optional rules' },
      { status: 500 }
    )
  }
}
