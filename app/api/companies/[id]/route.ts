import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { isValidUuid } from '@/lib/validation/common'
import { companySchema } from '@/lib/validation/company'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/companies/[id] - Get a specific company
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid company ID format' }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        url: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            projects: true,
          },
        },
      },
    })

    if (!company || company.isSystem) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json(company)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get company error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch company' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/companies/[id] - Update a company
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid company ID format' }, { status: 400 })
    }

    const body = await request.json()
    const validation = companySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    // Check if company exists and is not a system company
    const existingCompany = await prisma.company.findUnique({
      where: { id },
    })

    if (!existingCompany) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (existingCompany.isSystem) {
      return NextResponse.json(
        { error: 'System companies cannot be modified' },
        { status: 403 }
      )
    }

    const { name, url } = validation.data

    const company = await prisma.company.update({
      where: { id },
      data: {
        name,
        url,
      },
      select: {
        id: true,
        name: true,
        url: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(company)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update company error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/companies/[id] - Soft delete a company
 *
 * Reassigns all users and projects to the "Unassigned" system company,
 * then marks the company as deleted.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid company ID format' }, { status: 400 })
    }

    // Check if company exists
    const companyToDelete = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            projects: true,
          },
        },
      },
    })

    if (!companyToDelete) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (companyToDelete.isSystem) {
      return NextResponse.json(
        { error: 'System companies cannot be deleted' },
        { status: 403 }
      )
    }

    // Find the "Unassigned" system company
    const unassignedCompany = await prisma.company.findFirst({
      where: {
        isSystem: true,
        name: 'Unassigned',
      },
    })

    if (!unassignedCompany) {
      return NextResponse.json(
        { error: 'System company "Unassigned" not found. Please run the seed script.' },
        { status: 500 }
      )
    }

    // Use a transaction to reassign users/projects and soft delete
    await prisma.$transaction(async (tx) => {
      // Reassign users to Unassigned
      if (companyToDelete._count.users > 0) {
        await tx.user.updateMany({
          where: { companyId: id },
          data: { companyId: unassignedCompany.id },
        })
      }

      // Reassign projects to Unassigned
      if (companyToDelete._count.projects > 0) {
        await tx.project.updateMany({
          where: { companyId: id },
          data: { companyId: unassignedCompany.id },
        })
      }

      // Soft delete the company
      await tx.company.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
    })

    return NextResponse.json({
      success: true,
      reassigned: {
        users: companyToDelete._count.users,
        projects: companyToDelete._count.projects,
      },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete company error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to delete company' },
      { status: 500 }
    )
  }
}
