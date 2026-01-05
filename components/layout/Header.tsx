'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { signOutAction } from '@/lib/actions/auth'
import { useState } from 'react'

export default function Header() {
  const pathname = usePathname()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const isActive = (path: string) => {
    if (path === '/releasepass') {
      return pathname.startsWith('/releasepass')
    }
    return pathname.startsWith(path)
  }

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    try {
      await signOutAction()
    } catch (error) {
      console.error('Logout error:', error)
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="bg-black border-b border-charcol">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/img/logo-4all.svg"
              alt="4All Digital"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
          </Link>

          {/* Main Navigation */}
          <nav className="flex items-center space-x-8">
            <Link
              href="/releasepass"
              className={`hover:text-brand-yellow transition-colors ${
                isActive('/releasepass') ? 'active' : ''
              }`}
            >
              ReleasePass
            </Link>
            <Link
              href="/projects"
              className={`hover:text-brand-yellow transition-colors ${
                isActive('/projects') ? 'active' : ''
              }`}
            >
              Projects
            </Link>
            <Link
              href="/utilities"
              className={`hover:text-brand-yellow transition-colors ${
                  isActive('/utilities') ? 'active' : ''
              }`}
            >
              Utilities
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center flex-row space-x-4 gap-3">
            <Link
              href="/settings"
              className="text-white hover:text-brand-yellow transition-colors flex items-center gap-x-1.5"
              aria-label="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="px-4 py-1 bg-white rounded-smif  text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
