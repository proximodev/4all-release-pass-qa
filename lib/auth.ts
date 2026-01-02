import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

type AuthResult =
  | { user: User; error: null }
  | { user: null; error: NextResponse }

/**
 * Verify authentication for API routes.
 * Returns the authenticated user or an error response.
 *
 * Usage:
 * ```typescript
 * const { user, error } = await requireAuth()
 * if (error) return error
 * // user is now typed as User
 * ```
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { user, error: null }
}
