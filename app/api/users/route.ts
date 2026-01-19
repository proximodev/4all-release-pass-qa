import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const createUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN']),
  companyId: z.string().uuid('Company is required'),
})

/**
 * GET /api/users - List all users
 */
export async function GET() {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(users)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('List users error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users - Create a new user
 *
 * Creates both a Supabase Auth user and our User record.
 * Sends an invite email to the user to set their password.
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const body = await request.json()
    const validation = createUserSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues },
        { status: 400 }
      )
    }

    const { firstName, lastName, email, role, companyId } = validation.data

    // Check if user already exists in our database
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    // Create Supabase Auth user
    const supabaseAdmin = createAdminClient()
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        firstName,
        lastName,
      },
    })

    if (authError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Supabase auth error:', authError)
      }
      return NextResponse.json(
        { error: authError.message || 'Failed to create auth user' },
        { status: 400 }
      )
    }

    if (!authUser.user) {
      return NextResponse.json(
        { error: 'Failed to create auth user' },
        { status: 500 }
      )
    }

    // Create our User record
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role,
        companyId,
        supabaseUserId: authUser.user.id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
        createdAt: true,
      },
    })

    // User will use "Forgot Password" on login page to set their password

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Create user error:', error)
    }
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
