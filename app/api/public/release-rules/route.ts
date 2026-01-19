import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/public/release-rules - Public endpoint for active rules grouped by category
 */
export async function GET() {
  try {
    const categories = await prisma.releaseRuleCategory.findMany({
      where: {
        isActive: true,
        name: { not: 'SYSTEM' },
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            code: true,
            name: true,
            description: true,
            severity: true,
            isOptional: true,
          },
        },
      },
    })

    // Filter out categories with no active rules
    const categoriesWithRules = categories.filter(cat => cat.rules.length > 0)

    return NextResponse.json(categoriesWithRules)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Public rules fetch error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch rules' },
      { status: 500 }
    )
  }
}
