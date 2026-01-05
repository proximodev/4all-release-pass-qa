import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const updateUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  role: z.enum(['ADMIN']).optional(),
})

/**
 * GET /api/users/[id] - Get a specific user
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Get user error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/[id] - Update a user
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const validation = updateUserSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { firstName, lastName, email, role } = validation.data

    // If email is changing, check it's not already taken
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email },
      })

      if (emailTaken) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 }
        )
      }

      // Update email in Supabase Auth
      const supabaseAdmin = createAdminClient()
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.supabaseUserId,
        { email }
      )

      if (authError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Supabase auth update error:', authError)
        }
        return NextResponse.json(
          { error: 'Failed to update email in auth system' },
          { status: 400 }
        )
      }
    }

    // Update our User record
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email !== undefined && { email }),
        ...(role !== undefined && { role }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Update user error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id] - Delete a user
 *
 * Deletes both the Supabase Auth user and our User record.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user: currentUser, error } = await requireAuth()
    if (error) return error

    const { id } = await params

    // Get the user to delete
    const userToDelete = await prisma.user.findUnique({
      where: { id },
    })

    if (!userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deleting yourself
    if (userToDelete.supabaseUserId === currentUser.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    // Delete from Supabase Auth first
    const supabaseAdmin = createAdminClient()
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      userToDelete.supabaseUserId
    )

    if (authError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Supabase auth delete error:', authError)
      }
      // Continue with deletion even if auth deletion fails
      // The auth user may have been deleted already
    }

    // Delete our User record
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Delete user error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
