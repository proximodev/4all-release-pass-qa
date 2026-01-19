import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/companies/dropdown - Get minimal company data for dropdowns
 *
 * Returns all non-deleted companies (including system companies like "Unassigned")
 * for use in user and project forms.
 */
export async function GET() {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const companies = await prisma.company.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [
        { isSystem: 'asc' }, // Non-system companies first
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        isSystem: true,
      },
    })

    return NextResponse.json(companies)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get companies dropdown error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}
