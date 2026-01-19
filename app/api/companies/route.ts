import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { companySchema } from '@/lib/validation/company'

/**
 * GET /api/companies - List all companies
 *
 * Returns non-deleted, non-system companies with user/project counts
 */
export async function GET() {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const companies = await prisma.company.findMany({
      where: {
        deletedAt: null,
        isSystem: false,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            projects: true,
          },
        },
      },
    })

    return NextResponse.json(companies)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('List companies error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/companies - Create a new company
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const body = await request.json()
    const validation = companySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { name, url } = validation.data

    const company = await prisma.company.create({
      data: {
        name,
        url,
      },
      select: {
        id: true,
        name: true,
        url: true,
        createdAt: true,
      },
    })

    return NextResponse.json(company, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create company error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    )
  }
}
