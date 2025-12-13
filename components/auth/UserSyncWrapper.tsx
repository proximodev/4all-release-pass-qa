'use client'

import { useEffect, useState, ReactNode } from 'react'
import { syncUserAction } from '@/lib/actions/user'
import { useRouter } from 'next/navigation'

interface UserSyncWrapperProps {
  children: ReactNode
}

/**
 * Client component that syncs Supabase user to database on mount
 * Uses Server Action to keep Prisma calls working properly with Turbopack
 */
export default function UserSyncWrapper({ children }: UserSyncWrapperProps) {
  const [isSynced, setIsSynced] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    async function syncUser() {
      try {
        const result = await syncUserAction()

        if (!mounted) return

        if (!result.success) {
          console.error('User sync failed:', result.error)
          // Redirect to login on failure
          router.push('/login')
          return
        }

        setIsSynced(true)
      } catch (err) {
        if (!mounted) return
        console.error('User sync error:', err)
        router.push('/login')
      }
    }

    syncUser()

    return () => {
      mounted = false
    }
  }, [router])

  // Always render children to avoid hooks count mismatch
  // Just hide them with opacity while syncing
  return (
    <div style={{ opacity: isSynced ? 1 : 0 }}>
      {children}
    </div>
  )
}
