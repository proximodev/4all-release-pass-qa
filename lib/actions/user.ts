'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

/**
 * Server action to sync Supabase user to our database
 * Called once per session from client component
 */
export async function syncUserAction() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if already synced this session
    const cookieStore = await cookies()
    const userSynced = cookieStore.get('user-synced')

    if (userSynced) {
      return { success: true, alreadySynced: true }
    }

    // Get default company for new users (MVP: single tenant)
    const defaultCompany = await prisma.company.findFirst({
      where: { name: '4All Digital' },
    })

    if (!defaultCompany) {
      console.error('Default company not found - run seed-companies.ts')
      return { success: false, error: 'System not configured' }
    }

    // Upsert user in our database
    await prisma.user.upsert({
      where: { supabaseUserId: user.id },
      update: {
        email: user.email!,
        updatedAt: new Date(),
      },
      create: {
        supabaseUserId: user.id,
        email: user.email!,
        role: 'ADMIN', // MVP: all users are admins
        companyId: defaultCompany.id,
      },
    })

    // Set session cookie to prevent repeated upserts
    cookieStore.set('user-synced', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    })

    return { success: true, alreadySynced: false }
  } catch (error) {
    console.error('User sync error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync user'
    }
  }
}
