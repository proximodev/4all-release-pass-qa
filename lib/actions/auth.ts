'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/**
 * Server action to sign out the current user
 * Provides built-in CSRF protection via Next.js Server Actions
 */
export async function signOutAction() {
  try {
    const supabase = await createClient()
    const cookieStore = await cookies()

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign out error:', error)
      return { success: false, error: error.message }
    }

    // Clear session cookie if it exists
    cookieStore.delete('user-synced')

    return { success: true }
  } catch (error) {
    console.error('Sign out action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign out'
    }
  } finally {
    // Redirect to login page after sign out
    redirect('/login')
  }
}
